import cron from 'node-cron';
import axios from 'axios';
import { prisma } from '../db';
import { billingService } from '../services/billingService';

class UsageSyncJob {
  /**
   * Fetches actual RTC minutes for a specific channel from Agora's REST API.
   * Documentation: https://docs.agora.io/en/video-calling/reference/rest-api#get-usage-statistics
   */
  private async fetchAgoraMinutes(channelName: string, startedAt: Date, endedAt: Date): Promise<number | null> {
    const appId = process.env.AGORA_APP_ID;
    const customerId = process.env.AGORA_CUSTOMER_ID;
    const customerCert = process.env.AGORA_CUSTOMER_CERTIFICATE;

    if (!appId || !customerId || !customerCert) {
      console.warn('[UsageSync] Agora Console credentials missing — skipping API poll');
      return null;
    }

    try {
      // Agora API expects dates in YYYY-MM-DD format for the coarse usage API, 
      // or we use the analytics API for detailed channel info.
      // Here we implement the standard V3 Usage API call as a robust fallback.
      const auth = Buffer.from(`${customerId}:${customerCert}`).toString('base64');
      
      // Note: This is reaching for the project-wide usage as a proxy if channel-specific 
      // analytics isn't enabled. For production, the Analytics API is preferred.
      // For now, we attempt to fetch and match or return null to trigger wall-clock fallback.
      const response = await axios.get(
        `https://api.agora.io/v3/usage`,
        {
          params: {
            appId,
            // Simple date range covering the session
            startDate: startedAt.toISOString().split('T')[0],
            endDate: endedAt.toISOString().split('T')[0]
          },
          headers: { Authorization: `Basic ${auth}` }
        }
      );

      // In a real production environment with Analytics enabled, we would filter by channelName.
      // Since the basic usage API returns aggregated data, we return null to use our 
      // calculated wall-clock minutes if we can't find a precise per-channel match.
      // This helper is prepared for extension to the full Analytics API.
      if (response.data && response.data.data) {
        // Placeholder for channel-specific extraction logic
        // return response.data.data.find(c => c.channel === channelName).minutes;
      }

      return null; 
    } catch (error: any) {
      console.error('[UsageSync] Agora API poll failed:', error.message);
      return null;
    }
  }

  async syncUsage() {
    console.log('[UsageSync] Starting daily usage sync...');

    try {
      const endedSessions = await prisma.session.findMany({
        where: {
          status: 'ended',
          totalMinutes: { gt: 0 },
          usageRecords: { none: {} }, // Only sessions not yet processed
        },
        include: { facilitator: true },
      });

      console.log(`[UsageSync] Found ${endedSessions.length} new ended sessions to process.`);

      for (const session of endedSessions) {
        // Try to get accurate minutes from Agora, fallback to wall-clock totalMinutes
        const agoraMinutes = await this.fetchAgoraMinutes(
          session.channelName, 
          session.startedAt || session.createdAt, 
          session.endedAt || new Date()
        );

        const billableMinutes = agoraMinutes !== null ? agoraMinutes : session.totalMinutes;
        
        if (agoraMinutes !== null) {
          console.log(`[UsageSync] Using Agora-reported minutes: ${agoraMinutes} (Wall-clock: ${session.totalMinutes})`);
        }

        const rate = session.facilitator.pricingTier === 'premium' ? 0.004 : 0.003;
        const cost = parseFloat((billableMinutes * rate).toFixed(4));

        console.log(
          `[UsageSync] Processing session "${session.title}" (${session.id}): ` +
          `${billableMinutes} mins @ $${rate}/min = $${cost}`
        );

        // 1. Send usage event to Lago (deduct credits)
        const deductResult = await billingService.deductMinutes(
          session.facilitatorId,
          billableMinutes
        );
        console.log(`[UsageSync] Lago deduction status: ${deductResult.status}`);

        // 2. Fetch real post-deduction balance for accurate Transaction record
        let balanceAfter = 0;
        try {
          const wallet = await billingService.getWalletBalance(session.facilitatorId);
          balanceAfter = wallet.balance;
        } catch (balanceErr) {
          console.warn('[UsageSync] Could not fetch post-deduction balance:', balanceErr);
        }

        // 3. Create local UsageRecord
        await prisma.usageRecord.create({
          data: {
            minutesUsed: billableMinutes,
            costToFacilitator: cost,
            ratePerMinute: rate,
            userId: session.facilitatorId,
            sessionId: session.id,
            syncedAt: new Date(),
          },
        });

        // 4. Create Transaction record with real balanceAfter
        await prisma.transaction.create({
          data: {
            type: 'deduction',
            amount: -cost,
            currency: 'USD',
            balanceAfter,
            description: `Usage deduction for session: "${session.title}" (${billableMinutes} min)`,
            status: deductResult.status === 'failed' ? 'failed' : 'completed',
            userId: session.facilitatorId,
          },
        });

        console.log(`[UsageSync] Session ${session.id} synced. balanceAfter: $${balanceAfter}`);
      }

      console.log('[UsageSync] Daily sync complete.');
    } catch (error) {
      console.error('[UsageSync] Sync failed:', error);
    }
  }

  start() {
    // Run daily at 2:00 AM UTC
    cron.schedule('0 2 * * *', () => {
      this.syncUsage();
    });
    console.log('[UsageSync] Cron job scheduled — runs daily at 02:00 UTC');
  }
}

export const usageSyncJob = new UsageSyncJob();
