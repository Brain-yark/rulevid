import cron from 'node-cron';
import { prisma } from '../db';
import { socketService } from '../services/socketService';
import { packageService } from '../services/packageService';
import { billingService } from '../services/billingService';
import { agoraRecordingService } from '../services/agoraRecordingService';
import { agoraChannelService } from '../services/agoraChannelService';
import { logger } from '../logger';
import { IS_MVP_MODE } from '../config/mvpConfig';

interface GracePeriodState {
  sessionId: string;
  hostId: string;
  startedAt: number;
  expiresAt: number;
}

class BalanceMonitorJob {
  // Map of sessionId -> GracePeriodState (120s countdown)
  private activeGracePeriods = new Map<string, GracePeriodState>();
  // Map of sessionId -> last processed timestamp (ms)
  private sessionLastCheck = new Map<string, number>();
  // Map of sessionId -> accumulated participant-seconds (prevents fractional minute rounding inflation)
  private sessionAccumulatedSec = new Map<string, number>();
  // Map of sessionId -> total lifetime participant-seconds accumulated during session
  private sessionTotalParticipantSec = new Map<string, number>();

  /**
   * Main periodic monitor loop. Runs every 15 seconds for responsive in-stream warnings and overage execution.
   *
   * ACCURATE MINUTE COUNTING:
   * Instead of Math.ceil(deltaMinutes * audience) every 15s (which rounds 15s to 1 full minute per attendee),
   * we accumulate exact participant-seconds and only deduct whole completed minutes.
   * e.g. 60 checks × 15s × 1 attendee = 900 participant-seconds = 15 participant-minutes (correct)
   *   vs 60 checks × Math.ceil(0.25) = 60 participant-minutes per attendee (4× over-deduction!)
   */
  async checkActiveSessions() {
    try {
      const activeSessions = await prisma.session.findMany({
        where: { status: 'active' },
        include: {
          facilitator: {
            include: { billingPackage: true },
          },
        },
      });

      if (activeSessions.length === 0) {
        this.activeGracePeriods.clear();
        this.sessionLastCheck.clear();
        this.sessionAccumulatedSec.clear();
        return;
      }

      const now = Date.now();

      for (const session of activeSessions) {
        const sessionId = session.id;
        const hostId = session.facilitatorId;
        const host = session.facilitator;

        // Determine audience count from live socket room, fallback to recorded participantCount or 1
        const socketCount = socketService ? socketService.getAudienceCount(sessionId) : 0;
        const activeAudienceCount = Math.max(1, socketCount, session.participantCount || 0);

        // Update peak participant count in DB if new peak reached
        if (activeAudienceCount > (session.participantCount || 0)) {
          await prisma.session.update({
            where: { id: sessionId },
            data: { participantCount: activeAudienceCount },
          }).catch(() => null);
        }

        // ── Exact time delta (cap at 60s to prevent missed-check catch-up spikes) ──
        const lastCheckTime = this.sessionLastCheck.get(sessionId) || now;
        this.sessionLastCheck.set(sessionId, now);
        const deltaMs = Math.max(1000, Math.min(60000, now - lastCheckTime));
        const deltaSec = deltaMs / 1000;

        // ── Accumulate participant-seconds; deduct only whole completed participant-minutes ──
        const participantSec = deltaSec * activeAudienceCount;
        this.sessionTotalParticipantSec.set(
          sessionId,
          (this.sessionTotalParticipantSec.get(sessionId) || 0) + participantSec
        );

        const accumulated = (this.sessionAccumulatedSec.get(sessionId) || 0) + participantSec;
        const minutesToDeduct = Math.floor(accumulated / 60);
        this.sessionAccumulatedSec.set(sessionId, accumulated % 60);

        // Read current balance from host record (without waiting for deduction if 0 to deduct)
        let remaining = Math.max(0, (host.packageMinutesTotal || 0) - (host.packageMinutesUsed || 0));
        let percentRemaining = host.packageMinutesTotal > 0
          ? parseFloat(((remaining / host.packageMinutesTotal) * 100).toFixed(1))
          : 0;

        // Only write to DB when we have whole minutes to deduct
        if (minutesToDeduct > 0) {
          const deduction = await packageService.consumeParticipantMinutes(hostId, minutesToDeduct);
          remaining = deduction.remaining;
          percentRemaining = deduction.percentRemaining;

          logger.info(
            `[BalanceMonitor] Session "${session.title}" (${sessionId}) — Audience: ${activeAudienceCount} | ` +
            `Deducted: ${minutesToDeduct} pm-mins | Remaining: ${remaining} (${percentRemaining}%)`
          );
        }

        const isDepleted = remaining <= 0;
        const isLowBalance = !isDepleted && percentRemaining <= 20;
        const estimatedMinutesLeft = Math.floor(remaining / activeAudienceCount);

        // ── PATH A: Balance Hits Zero ──────────────────────────────────────────
        if (isDepleted) {
          // In MVP mode: do not cut off active streams!
          if (IS_MVP_MODE) {
            continue;
          }

          const hasCard = Boolean(host.stripePaymentMethodId && host.stripeCustomerId);
          const hasConsent = host.overageConsent;

          if (hasCard && hasConsent) {
            logger.info(`[BalanceMonitor] Balance is 0 for host ${hostId}. Auto-charging $10 overage block...`);
            try {
              const overageResult = await billingService.executeOverageBlock(hostId, sessionId);
              this.activeGracePeriods.delete(sessionId);

              socketService?.emitToHost(hostId, 'billing:overage_charged', {
                sessionId,
                amountCents: overageResult.amountCents,
                amountUsd: overageResult.amountCents / 100,
                minutesCredited: overageResult.minutesCredited,
                newBalanceRemaining: overageResult.newBalanceRemaining,
                receiptUrl: overageResult.receiptUrl,
                message: `Auto-charged $${overageResult.amountCents / 100} overage increment (${overageResult.minutesCredited.toLocaleString()} participant-minutes credited). Stream continues uninterrupted.`,
              });

              socketService?.emitToHost(hostId, 'billing:topup_success', {
                newBalance: overageResult.newBalanceRemaining,
                message: 'Overage credited successfully',
              });

              continue; // Stream continues smoothly!
            } catch (chargeErr: any) {
              logger.error({ chargeErr: chargeErr.message }, `[BalanceMonitor] Overage auto-charge failed for host ${hostId}`);
              // Fall through to grace period if auto-charge failed
            }
          }

          // No card on file OR no overage consent OR charge failed -> Enter 2-minute Grace Period
          let grace = this.activeGracePeriods.get(sessionId);
          if (!grace) {
            grace = {
              sessionId,
              hostId,
              startedAt: now,
              expiresAt: now + 120 * 1000, // 2 minutes grace period
            };
            this.activeGracePeriods.set(sessionId, grace);
            logger.warn(`[BalanceMonitor] Session ${sessionId} entered 2-minute grace period (No card/consent).`);
          }

          const secondsRemaining = Math.max(0, Math.ceil((grace.expiresAt - now) / 1000));

          if (secondsRemaining > 0) {
            const hasCard = Boolean(host.stripePaymentMethodId);
            socketService?.emitToHost(hostId, 'billing:grace_period', {
              sessionId,
              secondsRemaining,
              message: `Participant-minute balance is zero! 2-minute grace period active. Stream will end in ${secondsRemaining}s unless you top up now.`,
              canOneClickTopup: hasCard,
            });

            socketService?.emitToSession(sessionId, 'billing:grace_period', {
              sessionId,
              secondsRemaining,
              message: `Stream is in a grace period (${secondsRemaining}s remaining).`,
            });
          } else {
            // Grace period expired -> Soft Cutoff (End session gracefully)
            logger.warn(`[BalanceMonitor] Grace period expired for session ${sessionId}. Performing soft cutoff.`);

            socketService?.emitToSession(sessionId, 'billing:stream_ending', {
              sessionId,
              reason: 'grace_expired',
              message: 'This live session has concluded because the host participant-minute package was depleted.',
            });

            socketService?.emitToHost(hostId, 'billing:stream_ending', {
              sessionId,
              reason: 'depleted_balance_no_consent',
              message: 'Your stream was gracefully concluded due to depleted balance. Top up or enable auto-overage to prevent cutoffs.',
            });

            await this.endSessionGracefully(session);
            this.activeGracePeriods.delete(sessionId);
          }

          continue;
        }

        // ── PATH B: Balance is Low (<= 20% remaining) ─────────────────────────
        if (isLowBalance) {
          // Clear any stale grace period if host topped up
          this.activeGracePeriods.delete(sessionId);

          const hasCard = Boolean(host.stripePaymentMethodId && host.stripeCustomerId);

          socketService?.emitToHost(hostId, 'billing:low_balance', {
            sessionId,
            channelName: session.channelName,
            participantCount: activeAudienceCount,
            minutesRemaining: remaining,
            percentRemaining,
            estimatedMinutesLeft,
            message: `Low on minutes — ${remaining.toLocaleString()} remaining, ~${estimatedMinutesLeft} minutes left at current audience size (${activeAudienceCount} attendees)`,
            canOneClickTopup: hasCard,
            overageConsent: host.overageConsent,
          });
        } else {
          // Balance is healthy (> 20%) — clear any stale grace period
          this.activeGracePeriods.delete(sessionId);
        }
      }
    } catch (err: any) {
      logger.error({ err }, '[BalanceMonitor] Error in checkActiveSessions');
    }
  }

  /**
   * Gracefully ends a live session when grace period expires.
   * Records totalMinutes from wall-clock start -> end.
   */
  private async endSessionGracefully(session: any) {
    try {
      let recordingUrl = session.recordingUrl;
      if (session.recordingResourceId && session.recordingSid) {
        const stopResult = await agoraRecordingService.stopRecording(
          session.channelName,
          '999',
          session.recordingResourceId,
          session.recordingSid
        );
        if (stopResult) {
          recordingUrl = stopResult;
        }
      }

      // 1. Kick all participants on Agora RTC server-side to terminate channel immediately
      await agoraChannelService.kickAllFromChannel(session.channelName);

      // 2. Broadcast stream ended to any connected sockets
      socketService?.broadcastStreamEnded(session.id, 'This live session has concluded.');

      const endedAt = new Date();
      const startedAt = session.startedAt || session.createdAt;
      const durationMs = endedAt.getTime() - startedAt.getTime();
      const wallClockMinutes = Math.max(1, Math.round(durationMs / 60000));
      const peakParticipants = Math.max(1, session.participantCount || 1);

      // Total Participant-Minutes matching Agora RTC billable minutes:
      const lifetimeSec = this.sessionTotalParticipantSec.get(session.id) || 0;
      const accumulatedParticipantMins = Math.round(lifetimeSec / 60);
      const totalMinutes = Math.max(
        wallClockMinutes,
        accumulatedParticipantMins,
        Math.round((durationMs * peakParticipants) / 60000)
      );

      await prisma.session.update({
        where: { id: session.id },
        data: {
          status: 'ended',
          endedAt,
          totalMinutes,
          participantCount: peakParticipants,
          recordingUrl,
        },
      });

      // Clean up accumulator state for this session
      this.cleanupSession(session.id);

      logger.info(`[BalanceMonitor] Session ${session.id} ended gracefully. Total participant-minutes: ${totalMinutes} (Wall-clock: ${wallClockMinutes}m, Peak: ${peakParticipants})`);
    } catch (e: any) {
      logger.error({ e }, `[BalanceMonitor] Failed to end session ${session.id} gracefully`);
    }
  }

  public getSessionParticipantMinutes(sessionId: string): number {
    const totalSec = this.sessionTotalParticipantSec.get(sessionId) || 0;
    return Math.round(totalSec / 60);
  }

  public cleanupSession(sessionId: string) {
    this.sessionLastCheck.delete(sessionId);
    this.sessionAccumulatedSec.delete(sessionId);
    this.sessionTotalParticipantSec.delete(sessionId);
    this.activeGracePeriods.delete(sessionId);
  }

  /**
   * Start the balance monitor cron jobs.
   */
  start() {
    // Check active session balances every 15 seconds
    cron.schedule('*/15 * * * * *', () => {
      this.checkActiveSessions();
    });

    logger.info('[BalanceMonitor] Live balance monitor job started (runs every 15s)');
  }
}

export const balanceMonitorJob = new BalanceMonitorJob();
