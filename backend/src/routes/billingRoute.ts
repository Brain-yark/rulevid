import { Router, Request, Response } from 'express';
import { billingService } from '../services/billingService';
import { stripeService } from '../services/stripeService';
import { requireAuth } from '../middleware/authMiddleware';
import { prisma } from '../db';
import { validateRequest } from '../middleware/validateRequest';
import { topupSchema } from '../../../shared/schemas';

const router = Router();

// ─── Stripe Webhook ─────────────────────────────────────────────────────────
// NOTE: This route must use raw body parsing (mounted in index.ts before express.json).
// It is intentionally NOT behind requireAuth — Stripe calls it directly.
export const stripeWebhookHandler = async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    console.warn('[Webhook] Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event;
  try {
    event = stripeService.constructWebhookEvent(req.body as Buffer, signature);
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  // ── Handle events ──────────────────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const { userId, amount, type, eventId, ticketId, priceCents } = session.metadata || {};

    if (type === 'event_ticket') {
      console.log(`[Webhook] checkout.session.completed — Ticket purchase for event ${eventId}, user ${userId}, ticket ${ticketId}`);

      try {
        const paymentIntentId = (session.payment_intent as string) || null;

        if (ticketId) {
          await prisma.ticket.update({
            where: { id: ticketId },
            data: {
              status: 'paid',
              stripeCheckoutSessionId: session.id,
              stripePaymentIntentId: paymentIntentId,
            },
          });
          console.log(`[Webhook] Ticket ${ticketId} updated to paid`);
        } else if (eventId && userId) {
          // Fallback if ticketId wasn't in metadata
          const existingTicket = await prisma.ticket.findFirst({
            where: { eventId, userId },
          });

          if (existingTicket) {
            await prisma.ticket.update({
              where: { id: existingTicket.id },
              data: {
                status: 'paid',
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId: paymentIntentId,
              },
            });
            console.log(`[Webhook] Existing ticket ${existingTicket.id} updated to paid`);
          } else {
            await prisma.ticket.create({
              data: {
                eventId,
                userId,
                status: 'paid',
                amountCents: priceCents ? parseInt(priceCents, 10) : session.amount_total || 0,
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId: paymentIntentId,
              },
            });
            console.log(`[Webhook] New paid ticket created for event ${eventId} and user ${userId}`);
          }
        }

        // Save stripe customer ID if present
        if (userId && session.customer) {
          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: session.customer as string },
          }).catch(() => null);
        }
      } catch (ticketErr) {
        console.error('[Webhook] Failed to process ticket fulfillment:', ticketErr);
      }

      return res.status(200).json({ received: true });
    }

    if (type === 'wallet_topup') {
      if (!userId || !amount) {
        console.warn('[Webhook] Missing userId or amount in wallet_topup metadata');
        return res.status(200).json({ received: true });
      }

      const topupAmount = parseFloat(amount);
      console.log(`[Webhook] checkout.session.completed — user ${userId} paid $${topupAmount}`);

      try {
        // 1. Fetch user to get walletId
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          console.error(`[Webhook] User ${userId} not found in DB`);
          return res.status(200).json({ received: true }); // Return 200 so Stripe doesn't retry
        }

        // 2. Ensure we have a Lago wallet — provision if missing
        // Also update stripeCustomerId if not already set
        let walletId = user.walletId;
        const stripeCustomerId = session.customer as string;
        
        const updateData: any = {};
        if (stripeCustomerId && user.stripeCustomerId !== stripeCustomerId) {
          updateData.stripeCustomerId = stripeCustomerId;
        }

        if (!walletId) {
          console.log(`[Webhook] No walletId for ${userId}, provisioning now...`);
          await billingService.createLagoCustomer(userId, user.email);
          walletId = await billingService.createLagoWallet(userId);
          if (walletId) {
            updateData.walletId = walletId;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.user.update({ where: { id: userId }, data: updateData });
        }

        // 3. Credit the Lago wallet
        if (walletId) {
          await billingService.creditWallet(walletId, topupAmount);
        } else {
          console.warn(`[Webhook] Could not credit wallet for ${userId} — walletId unavailable`);
        }

        // 4. Fetch updated balance for accurate Transaction record
        const updatedWallet = await billingService.getWalletBalance(userId);

        // 5. Record Transaction in SVSM DB
        await prisma.transaction.create({
          data: {
            type: 'topup',
            amount: topupAmount,
            currency: 'USD',
            balanceAfter: updatedWallet.balance,
            description: `Stripe top-up via Checkout Session ${session.id}`,
            lagoTransactionId: walletId ?? undefined,
            status: 'completed',
            userId,
          },
        });

        console.log(`[Webhook] Successfully processed top-up of $${topupAmount} for user ${userId}`);
      } catch (err) {
        console.error('[Webhook] Failed to process top-up:', err);
      }

      return res.status(200).json({ received: true });
    }

    console.warn(`[Webhook] Unrecognized checkout session type: ${type}`);
  } else {
    console.log(`[Webhook] Unhandled event type: ${event.type}`);
  }

  return res.status(200).json({ received: true });
};

// ─── Authenticated Routes ───────────────────────────────────────────────────
router.use(requireAuth);

// GET /api/v1/billing/balance
router.get('/balance', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const balance = await billingService.getWalletBalance(userId);
    res.json(balance);
  } catch (error) {
    console.error('[Billing] Failed to fetch balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// POST /api/v1/billing/topup
router.post('/topup', validateRequest(topupSchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { amount } = req.body;

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

    const session = await stripeService.createTopupSession(
      userId,
      Number(amount),
      `${FRONTEND_URL}/wallet?success=true`,
      `${FRONTEND_URL}/wallet?canceled=true`
    );

    res.json({
      checkout_url: session.url,
      message: 'Redirecting to secure Stripe Checkout',
    });
    return;
  } catch (error) {
    console.error('[Billing] Top-up Error:', error);
    res.status(500).json({ error: 'Failed to initiate top-up' });
    return;
  }
});

// GET /api/v1/billing/transactions
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(transactions);
    return;
  } catch (error) {
    console.error('[Billing] Failed to fetch transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
    return;
  }
});

// GET /api/v1/billing/portal
router.get('/portal', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.stripeCustomerId) {
      res.status(400).json({ 
        error: 'No Stripe customer record found. Please complete a top-up first to register your billing details.' 
      });
      return;
    }

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const portalSession = await stripeService.createPortalSession(
      user.stripeCustomerId,
      `${FRONTEND_URL}/wallet`
    );

    res.json({ url: portalSession.url });
    return;
  } catch (error) {
    console.error('[Billing] Portal Error:', error);
    res.status(500).json({ error: 'Failed to create billing portal session' });
    return;
  }
});

export default router;
