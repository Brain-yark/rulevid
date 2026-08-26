import axios from 'axios';
import { prisma } from '../db';
import { stripeService } from './stripeService';
import { packageService } from './packageService';

class BillingService {
  private apiUrl = process.env.LAGO_API_URL || 'http://localhost:3000';
  private apiKey = process.env.LAGO_API_KEY;

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  // ─── Wallet Balance ────────────────────────────────────────────────────────

  async getWalletBalance(facilitatorId: string): Promise<{ balance: number; currency: string }> {
    if (!this.apiKey) {
      // Calculate real USD cash wallet balance from DB transactions
      try {
        const cashTransactions = await prisma.transaction.findMany({
          where: {
            userId: facilitatorId,
            status: 'completed',
            type: { in: ['topup', 'overage', 'deduction', 'ticket_sale', 'payout'] },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (cashTransactions.length === 0) {
          return { balance: 0, currency: 'USD' };
        }

        let runningBalance = 0;
        for (const tx of cashTransactions) {
          runningBalance += tx.amount;
        }

        return {
          balance: Math.max(0, parseFloat(runningBalance.toFixed(2))),
          currency: 'USD',
        };
      } catch (dbErr) {
        return { balance: 0, currency: 'USD' };
      }
    }

    try {
      // Lago: list wallets for a customer by external_customer_id
      const response = await axios.get(
        `${this.apiUrl}/api/v1/wallets?external_customer_id=${facilitatorId}`,
        { headers: this.headers }
      );
      const wallets = response.data.wallets;
      if (!wallets || wallets.length === 0) {
        return { balance: 0, currency: 'USD' };
      }
      const wallet = wallets[0];
      return {
        balance: parseFloat(wallet.balance) ?? 0,
        currency: wallet.currency ?? 'USD',
      };
    } catch (error: any) {
      console.error('[Lago] Failed to fetch wallet balance:', error?.response?.data || error.message);
      // Fail-closed: Throw error so middleware can return 503 instead of "Insufficient Balance"
      throw new Error('Billing service connection failed');
    }
  }

  // ─── Customer & Wallet Provisioning ───────────────────────────────────────

  /**
   * Create a Lago customer for a newly registered SVSM user.
   * Uses the SVSM user UUID as the Lago external_id.
   */
  async createLagoCustomer(userId: string, email: string): Promise<void> {
    if (!this.apiKey) {
      console.warn('[Lago] Mock: skipping customer creation for', userId);
      return;
    }

    try {
      await axios.post(
        `${this.apiUrl}/api/v1/customers`,
        {
          customer: {
            external_id: userId,
            email,
            currency: 'USD',
          },
        },
        { headers: this.headers }
      );
      console.log(`[Lago] Customer created for user ${userId}`);
    } catch (error: any) {
      // Lago returns 422 if customer already exists — treat as success
      if (error?.response?.status === 422) {
        console.log(`[Lago] Customer already exists for ${userId}, continuing`);
        return;
      }
      console.error('[Lago] Failed to create customer:', error?.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a pre-paid Lago wallet for a customer.
   * Returns the Lago wallet ID to store on the SVSM User record.
   */
  async createLagoWallet(userId: string): Promise<string | null> {
    if (!this.apiKey) {
      console.warn('[Lago] Mock: skipping wallet creation for', userId);
      return null;
    }

    try {
      const response = await axios.post(
        `${this.apiUrl}/api/v1/wallets`,
        {
          wallet: {
            external_customer_id: userId,
            name: 'SVSM Credits',
            rate_amount: '1',          // 1 credit = $1 USD
            currency: 'USD',
            paid_credits: '0',         // Start with zero credits
            granted_credits: '0',
          },
        },
        { headers: this.headers }
      );
      const walletId: string = response.data.wallet.lago_id;
      console.log(`[Lago] Wallet created for user ${userId}: ${walletId}`);
      return walletId;
    } catch (error: any) {
      console.error('[Lago] Failed to create wallet:', error?.response?.data || error.message);
      return null;
    }
  }

  /**
   * Credit a Lago wallet with a given USD amount (post Stripe payment).
   * amount is in dollars (e.g. 100 = $100.00).
   */
  async creditWallet(walletId: string, amount: number): Promise<boolean> {
    if (!this.apiKey) {
      console.warn(`[Lago] Mock: crediting wallet ${walletId} with $${amount}`);
      return true;
    }

    try {
      await axios.post(
        `${this.apiUrl}/api/v1/wallet_transactions`,
        {
          wallet_transaction: {
            wallet_id: walletId,
            paid_credits: amount.toFixed(2),  // top-up with paid credits
            granted_credits: '0',
          },
        },
        { headers: this.headers }
      );
      console.log(`[Lago] Wallet ${walletId} credited with $${amount}`);
      return true;
    } catch (error: any) {
      console.error('[Lago] Failed to credit wallet:', error?.response?.data || error.message);
      return false;
    }
  }

  // ─── Auto-Charge Overage & 1-Click Topup ───────────────────────────────

  /**
   * Automatically executes a small overage increment ($10 block = 10,000 participant-minutes)
   * when the host's balance hits zero during a live session, using their pre-saved card and prior consent.
   */
  async executeOverageBlock(userId: string, sessionId?: string): Promise<{
    success: boolean;
    amountCents: number;
    minutesCredited: number;
    receiptUrl?: string | null;
    paymentIntentId?: string;
    newBalanceRemaining: number;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { billingPackage: true },
    });

    if (!user) throw new Error('User not found');
    if (!user.stripePaymentMethodId || !user.stripeCustomerId) {
      throw new Error('No pre-saved payment method found for overage charge');
    }
    if (!user.overageConsent) {
      throw new Error('Host has not consented to automatic overage charges');
    }

    const overageBlockCents = user.billingPackage?.overageBlockCents || 1000; // $10.00
    const overageBlockMinutes = user.billingPackage?.overageBlockMinutes || 10000; // 10,000 minutes

    const description = `SVSM Live Overage Block: $${(overageBlockCents / 100).toFixed(2)} for ${overageBlockMinutes.toLocaleString()} participant-minutes`;

    const paymentIntent = await stripeService.chargeSavedCard(
      user.stripeCustomerId,
      user.stripePaymentMethodId,
      overageBlockCents,
      description,
      {
        userId,
        sessionId: sessionId || '',
        type: 'auto_overage_charge',
        amountCents: overageBlockCents.toString(),
        minutesCredited: overageBlockMinutes.toString(),
      }
    );

    const chargeObj = paymentIntent.latest_charge as any;
    const receiptUrl = typeof chargeObj === 'object' ? chargeObj?.receipt_url : null;

    // Credit user's package participant-minutes
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        packageMinutesTotal: { increment: overageBlockMinutes },
      },
    });

    // Record OverageCharge
    await prisma.overageCharge.create({
      data: {
        userId,
        sessionId: sessionId || null,
        amountCents: overageBlockCents,
        minutesCredited: overageBlockMinutes,
        stripePaymentIntentId: paymentIntent.id,
        status: 'succeeded',
        receiptUrl,
        description,
      },
    });

    // Record Transaction
    await prisma.transaction.create({
      data: {
        type: 'overage_charge',
        amount: -(overageBlockCents / 100),
        currency: 'USD',
        balanceAfter: updatedUser.packageMinutesTotal - updatedUser.packageMinutesUsed,
        description,
        lagoTransactionId: paymentIntent.id,
        status: 'completed',
        userId,
      },
    });

    const newBalanceRemaining = Math.max(0, updatedUser.packageMinutesTotal - updatedUser.packageMinutesUsed);

    console.log(
      `[BillingService] Successfully charged $${overageBlockCents / 100} overage for user ${userId}. Credited ${overageBlockMinutes} mins.`
    );

    return {
      success: true,
      amountCents: overageBlockCents,
      minutesCredited: overageBlockMinutes,
      receiptUrl,
      paymentIntentId: paymentIntent.id,
      newBalanceRemaining,
    };
  }

  /**
   * 1-Click Top Up during stream or from dashboard using pre-saved card on file.
   */
  async executeOneClickTopup(userId: string, sessionId?: string, customAmountCents?: number): Promise<{
    success: boolean;
    amountCents: number;
    minutesCredited: number;
    newBalanceRemaining: number;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { billingPackage: true },
    });

    if (!user) throw new Error('User not found');
    if (!user.stripePaymentMethodId || !user.stripeCustomerId) {
      throw new Error('No pre-saved payment method on file. Please add a card in your billing settings.');
    }

    const amountCents = customAmountCents || user.billingPackage?.overageBlockCents || 1000;
    const minutesCredited = user.billingPackage?.overageBlockMinutes || 10000;

    const description = `SVSM 1-Click Top-Up: $${(amountCents / 100).toFixed(2)} (+${minutesCredited.toLocaleString()} participant-minutes)`;

    const paymentIntent = await stripeService.chargeSavedCard(
      user.stripeCustomerId,
      user.stripePaymentMethodId,
      amountCents,
      description,
      {
        userId,
        sessionId: sessionId || '',
        type: 'one_click_topup',
        amountCents: amountCents.toString(),
        minutesCredited: minutesCredited.toString(),
      }
    );

    const chargeObj = paymentIntent.latest_charge as any;
    const receiptUrl = typeof chargeObj === 'object' ? chargeObj?.receipt_url : null;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        packageMinutesTotal: { increment: minutesCredited },
      },
    });

    await prisma.overageCharge.create({
      data: {
        userId,
        sessionId: sessionId || null,
        amountCents,
        minutesCredited,
        stripePaymentIntentId: paymentIntent.id,
        status: 'succeeded',
        receiptUrl,
        description,
      },
    });

    await prisma.transaction.create({
      data: {
        type: 'topup',
        amount: amountCents / 100,
        currency: 'USD',
        balanceAfter: updatedUser.packageMinutesTotal - updatedUser.packageMinutesUsed,
        description,
        lagoTransactionId: paymentIntent.id,
        status: 'completed',
        userId,
      },
    });

    const newBalanceRemaining = Math.max(0, updatedUser.packageMinutesTotal - updatedUser.packageMinutesUsed);

    return {
      success: true,
      amountCents,
      minutesCredited,
      newBalanceRemaining,
    };
  }

  async deductMinutes(userId: string, minutes: number) {
    return await packageService.deductMinutes(userId, minutes);
  }
}

export const billingService = new BillingService();

