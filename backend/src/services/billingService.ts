import axios from 'axios';

class BillingService {
  private apiUrl = process.env.LAGO_API_URL || 'https://api.getlago.com';
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
      console.warn('[Lago] LAGO_API_KEY not configured, returning mock balance');
      return { balance: 124.50, currency: 'USD' };
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

  // ─── Usage Deduction ───────────────────────────────────────────────────────

  /**
   * Send a usage event to Lago for minute-based billing deduction.
   */
  async deductMinutes(facilitatorId: string, minutesUsed: number): Promise<{ status: string }> {
    if (!this.apiKey) {
      console.warn('[Lago] Mock deduction for', minutesUsed, 'minutes');
      return { status: 'mock_success' };
    }

    try {
      const event = {
        event: {
          external_customer_id: facilitatorId,
          code: 'agora_minutes',
          transaction_id: `${facilitatorId}_${Date.now()}`,
          properties: {
            amount: minutesUsed.toString(),
          },
          timestamp: Math.floor(Date.now() / 1000),
        },
      };

      const response = await axios.post(`${this.apiUrl}/api/v1/events`, event, {
        headers: this.headers,
      });
      return { status: response.status === 200 ? 'success' : 'failed' };
    } catch (error: any) {
      console.error('[Lago] Failed to send usage event:', error?.response?.data || error.message);
      return { status: 'failed' };
    }
  }
}

export const billingService = new BillingService();
