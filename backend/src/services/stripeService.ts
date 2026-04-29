import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-01-27.acacia' as any,
});

export class StripeService {
  /**
   * Create a Checkout Session for a wallet top-up.
   * The metadata (userId, amount) is used by the webhook handler to credit the wallet.
   */
  async createTopupSession(
    userId: string,
    amount: number,
    successUrl: string,
    cancelUrl: string
  ) {
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'SVSM Wallet Credits',
                description: `Add $${amount}.00 to your SVSM streaming wallet`,
              },
              unit_amount: Math.round(amount * 100), // Stripe expects cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId,
          type: 'wallet_topup',
          amount: amount.toString(),
        },
      });

      return session;
    } catch (error) {
      console.error('[Stripe] Session creation error:', error);
      throw new Error('Failed to create Stripe session');
    }
  }

  /**
   * Verify and parse a Stripe webhook event from the raw request body and signature.
   * Throws if the signature is invalid — caller should return 400.
   */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    // This throws a Stripe.errors.StripeSignatureVerificationError on failure
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }

  /**
   * Create a Customer Portal session for managing billing.
   */
  async createPortalSession(customerId: string, returnUrl: string) {
    try {
      return await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
    } catch (error) {
      console.error('[Stripe] Portal session creation error:', error);
      throw new Error('Failed to create Stripe portal session');
    }
  }
}

export const stripeService = new StripeService();
