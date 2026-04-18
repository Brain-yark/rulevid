import cron from 'node-cron';
import axios from 'axios';
import { prisma } from '../db';
import { billingService } from '../services/billingService';

class UsageSyncJob {
  private agoraApiUrl = 'https://api.agora.io/dev/v3/usage';
  private customerId = process.env.AGORA_CUSTOMER_ID;
  private apiKey = process.env.AGORA_API_KEY;
  private apiSecret = process.env.AGORA_API_SECRET;

  private getAuthHeader() {
    if (!this.apiKey || !this.apiSecret) return '';
    const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
    return `Basic ${auth}`;
  }

  async syncUsage() {
    console.log('[UsageSync] Starting daily usage sync...');
    
    // In a real implementation, we would query yesterday's usage
    // const yesterday = new Date();
    // yesterday.setDate(yesterday.getDate() - 1);
    
    // For now, we will simulate finding recent active sessions that ended
    try {
      const endedSessions = await prisma.session.findMany({
        where: {
          status: 'ended',
          totalMinutes: { gt: 0 },
          usageRecords: { none: {} } // Only process sessions without a usage record yet
        },
        include: { facilitator: true }
      });

      console.log(`[UsageSync] Found ${endedSessions.length} new ended sessions to process.`);

      for (const session of endedSessions) {
        const rate = session.facilitator.pricingTier === 'premium' ? 0.004 : 0.003;
        const cost = session.totalMinutes * rate;

        console.log(`[UsageSync] Processing session ${session.id}: ${session.totalMinutes} mins @ $${rate} = $${cost}`);

        // 1. Deduct from Lago
        await billingService.deductMinutes(session.facilitatorId, session.totalMinutes);

        // 2. Create local usage record
        await prisma.usageRecord.create({
          data: {
            minutesUsed: session.totalMinutes,
            costToFacilitator: cost,
            ratePerMinute: rate,
            userId: session.facilitatorId,
            sessionId: session.id,
            syncedAt: new Date()
          }
        });

        // 3. Create transaction record
        await prisma.transaction.create({
          data: {
             type: 'deduction',
             amount: -cost,
             balanceAfter: 0, // In real life we'd calculate this or fetch from Lago
             description: `Usage deduction for session: ${session.title}`,
             userId: session.facilitatorId,
             status: 'completed'
          }
        });

        console.log(`[UsageSync] Successfully synced session ${session.id}`);
      }
    } catch (error) {
      console.error('[UsageSync] Sync failed:', error);
    }
  }

  start() {
    // Run daily at 2 AM UTC as per blueprint
    cron.schedule('0 2 * * *', () => {
      this.syncUsage();
    });
    console.log('[UsageSync] Cron job scheduled (0 2 * * *)');
  }
}

export const usageSyncJob = new UsageSyncJob();
