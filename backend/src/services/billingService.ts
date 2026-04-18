import axios from 'axios';

class BillingService {
  private apiUrl = process.env.LAGO_API_URL || 'https://api.getlago.com';
  private apiKey = process.env.LAGO_API_KEY;

  async getWalletBalance(facilitatorId: string) {
    if (!this.apiKey) {
      console.warn('LAGO_API_KEY not configured, returning mock balance');
      return { balance: 124.50, currency: 'USD' };
    }
    
    try {
      const response = await axios.get(`${this.apiUrl}/api/v1/wallets/${facilitatorId}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return {
        balance: response.data.wallet.balance_cents / 100,
        currency: response.data.wallet.currency
      };
    } catch (error) {
      console.error('Failed to fetch Lago balance:', error);
      return { balance: 0, currency: 'USD' };
    }
  }

  async deductMinutes(facilitatorId: string, minutesUsed: number) {
    if (!this.apiKey) {
      console.warn('LAGO_API_KEY not configured, mock deduction for:', minutesUsed);
      return { status: 'mock_success' };
    }

    try {
      const event = {
        event: {
          external_customer_id: facilitatorId,
          code: 'agora_minutes',
          transaction_id: `${facilitatorId}_${Date.now()}`,
          properties: {
            amount: minutesUsed.toString()
          },
          timestamp: Math.floor(Date.now() / 1000)
        }
      };
      
      const response = await axios.post(`${this.apiUrl}/api/v1/events`, event, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return { status: response.status === 200 ? 'success' : 'failed' };
    } catch (error) {
      console.error('Failed to send Lago usage event:', error);
      return { status: 'failed' };
    }
  }
}

export const billingService = new BillingService();
