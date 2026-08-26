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
   * Create a Checkout Session for an event ticket.
   * Metadata (userId, eventId, ticketId, type: 'event_ticket') is used by webhook handler.
   */
  async createTicketCheckoutSession(
    userId: string,
    eventId: string,
    ticketId: string,
    eventTitle: string,
    priceCents: number,
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
                name: `Ticket: ${eventTitle}`,
                description: `Live access ticket to "${eventTitle}" on SVSM Live`,
              },
              unit_amount: priceCents, // In cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId,
          eventId,
          ticketId,
          type: 'event_ticket',
          priceCents: priceCents.toString(),
        },
      });

      return session;
    } catch (error) {
      console.error('[Stripe] Ticket session creation error:', error);
      throw new Error('Failed to create Stripe ticket checkout session');
    }
  }

  /**
   * Create or retrieve a Stripe Customer ID for a user.
   */
  async getOrCreateCustomer(userId: string, email: string, name?: string): Promise<string> {
    try {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        return customers.data[0].id;
      }
      const newCustomer = await stripe.customers.create({
        email,
        name: name || undefined,
        metadata: { userId },
      });
      return newCustomer.id;
    } catch (error) {
      console.error('[Stripe] Failed to get or create customer:', error);
      throw error;
    }
  }

  async retrieveCheckoutSession(sessionId: string) {
    try {
      return await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      console.error('[Stripe] Failed to retrieve checkout session:', error);
      throw error;
    }
  }

  /**
   * Create a Checkout Session for a billing package (participant-minutes plan).
   */
  async createPackageCheckoutSession(
    userId: string,
    packageSlug: string,
    packageName: string,
    priceCents: number,
    participantMinutes: number,
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
                name: `RuleVid Host Package: ${packageName}`,
                description: `${participantMinutes.toLocaleString()} monthly participant-minutes with $10 overage protection`,
              },
              unit_amount: priceCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl.includes('{CHECKOUT_SESSION_ID}') ? successUrl : `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: {
          userId,
          type: 'package_subscription',
          packageSlug,
          priceCents: priceCents.toString(),
          participantMinutes: participantMinutes.toString(),
        },
      });

      return session;
    } catch (error) {
      console.error('[Stripe] Package checkout session creation error:', error);
      throw new Error('Failed to create Stripe package checkout session');
    }
  }

  /**
   * Create a SetupIntent to securely collect and save a credit card for 1-click topup and overage.
   */
  async createSetupIntent(customerId: string, userId: string) {
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        metadata: { userId },
      });
      return setupIntent;
    } catch (error) {
      console.error('[Stripe] SetupIntent creation error:', error);
      throw new Error('Failed to create SetupIntent');
    }
  }

  /**
   * Charge a saved payment method off-session (e.g. for 1-click topup or automatic $10 overage block).
   */
  async chargeSavedCard(
    customerId: string,
    paymentMethodId: string,
    amountCents: number,
    description: string,
    metadata: Record<string, string>
  ) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description,
        metadata,
      });

      return paymentIntent;
    } catch (error: any) {
      console.error('[Stripe] Off-session payment charge failed:', error.message);
      throw error;
    }
  }

  /**
   * Verify and parse a Stripe webhook event from the raw request body and signature.
   * Throws if the signature is invalid — caller should return 400.
   */
  constructWebhookEvent(rawBody: Buffer, signature: string): any {
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

