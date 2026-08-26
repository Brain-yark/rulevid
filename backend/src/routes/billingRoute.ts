import { Router, Request, Response, RequestHandler } from 'express';
import { billingService } from '../services/billingService';
import { stripeService } from '../services/stripeService';
import { packageService } from '../services/packageService';
import { requireAuth } from '../middleware/authMiddleware';
import { prisma } from '../db';
import { validateRequest } from '../middleware/validateRequest';
import {
  topupSchema,
  subscribePackageSchema,
  overageConsentSchema,
  oneClickTopupSchema,
  savePaymentMethodSchema,
} from '@shared/schemas';
import { logger } from '../logger';

const router = Router();

// ─── Stripe Webhook ─────────────────────────────────────────────────────────
// Mounted with express.raw() in index.ts
export const stripeWebhookHandler = async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    logger.warn('[Webhook] Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event;
  try {
    event = stripeService.constructWebhookEvent(req.body as Buffer, signature);
  } catch (err: any) {
    logger.error({ err: err.message }, '[Webhook] Signature verification failed');
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  // ── Handle checkout.session.completed ───────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const { userId, amount, type, eventId, ticketId, priceCents, packageSlug } = session.metadata || {};

    // 1. Package Subscription fulfillment
    if (type === 'package_subscription' && userId && packageSlug) {
      logger.info(`[Webhook] checkout.session.completed — Package subscription "${packageSlug}" for user ${userId}`);
      try {
        const paymentIntentId = (session.payment_intent as string) || null;
        await packageService.applyPaidPackage(userId, packageSlug, paymentIntentId || undefined);

        if (session.customer) {
          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: session.customer as string },
          }).catch(() => null);
        }
        logger.info(`[Webhook] Package "${packageSlug}" successfully applied to user ${userId}`);
      } catch (pkgErr: any) {
        logger.error({ pkgErr: pkgErr.message }, '[Webhook] Failed to fulfill package subscription');
      }

      return res.status(200).json({ received: true });
    }

    // 2. Ticket purchase fulfillment
    if (type === 'event_ticket') {
      logger.info(`[Webhook] checkout.session.completed — Ticket purchase for event ${eventId}, user ${userId}`);

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
        } else if (eventId && userId) {
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
          }
        }

        if (userId && session.customer) {
          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: session.customer as string },
          }).catch(() => null);
        }
      } catch (ticketErr: any) {
        logger.error({ ticketErr: ticketErr.message }, '[Webhook] Failed to process ticket fulfillment');
      }

      return res.status(200).json({ received: true });
    }

    // 3. Wallet top-up fulfillment
    if (type === 'wallet_topup') {
      if (!userId || !amount) {
        return res.status(200).json({ received: true });
      }

      const topupAmount = parseFloat(amount);
      try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(200).json({ received: true });

        let walletId = user.walletId;
        const stripeCustomerId = session.customer as string;
        const updateData: any = {};
        if (stripeCustomerId && user.stripeCustomerId !== stripeCustomerId) {
          updateData.stripeCustomerId = stripeCustomerId;
        }

        if (!walletId) {
          await billingService.createLagoCustomer(userId, user.email);
          walletId = await billingService.createLagoWallet(userId);
          if (walletId) updateData.walletId = walletId;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.user.update({ where: { id: userId }, data: updateData });
        }

        if (walletId) {
          await billingService.creditWallet(walletId, topupAmount);
        }

        const updatedWallet = await billingService.getWalletBalance(userId);

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
      } catch (err: any) {
        logger.error({ err: err.message }, '[Webhook] Failed to process top-up');
      }

      return res.status(200).json({ received: true });
    }
  }

  return res.status(200).json({ received: true });
};

// ─── Public Catalog Routes ──────────────────────────────────────────────────
// GET /api/v1/billing/packages - Package Catalog Marketplace (Public for landing page & registration)
router.get('/packages', (async (_req: Request, res: Response) => {
  try {
    const packages = await packageService.getAllPackages(false);
    res.json(packages);
  } catch (error: any) {
    logger.error({ error: error.message }, '[Billing] Failed to fetch packages');
    res.status(500).json({ error: 'Failed to retrieve package catalog', message: error.message });
  }
}) as RequestHandler);

// ─── Authenticated Routes ───────────────────────────────────────────────────
router.use(requireAuth as unknown as RequestHandler);

// GET /api/v1/billing/packages/status - Current user's package status, remaining minutes, cycle info
router.get('/packages/status', (async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const status = await packageService.getUserPackageStatus(userId);
    res.json(status);
  } catch (error: any) {
    logger.error({ error: error.message }, '[Billing] Failed to fetch package status');
    res.status(500).json({ error: 'Failed to fetch package status', message: error.message });
  }
}) as RequestHandler);

// POST /api/v1/billing/packages/subscribe - Select tier from marketplace
router.post('/packages/subscribe', validateRequest(subscribePackageSchema), (async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { packageSlug } = req.body;

    const pkg = await packageService.getPackageBySlug(packageSlug);
    if (!pkg) {
      return res.status(404).json({ error: `Package "${packageSlug}" not found` });
    }

    // 1. Free Tier selection
    if (pkg.slug === 'free' || (pkg.priceCents === 0 && !pkg.isCustom)) {
      const result = await packageService.subscribeFreePackage(userId);
      const freshUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { billingPackage: true },
      });
      return res.json({
        message: 'Successfully subscribed to the Free Host package (3,000 participant-minutes granted)',
        status: result.status,
        user: freshUser ? {
          id: freshUser.id,
          email: freshUser.email,
          name: freshUser.name,
          role: freshUser.role,
          billingPackageId: freshUser.billingPackageId,
          packageMinutesTotal: freshUser.packageMinutesTotal,
          packageMinutesUsed: freshUser.packageMinutesUsed,
          billingPackage: freshUser.billingPackage,
        } : undefined,
      });
    }

    // 2. Custom / Scale Tier contact
    if (pkg.isCustom) {
      return res.json({
        message: 'Scale tier requires custom negotiation. Our enterprise team will reach out to you shortly.',
        isCustom: true,
      });
    }

    // 3. Paid Tier (Starter, Growth)
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await stripeService.createPackageCheckoutSession(
      userId,
      pkg.slug,
      pkg.name,
      pkg.priceCents,
      pkg.participantMinutes,
      `${FRONTEND_URL}/billing?success=true&package=${pkg.slug}`,
      `${FRONTEND_URL}/billing?canceled=true`
    );

    return res.json({
      checkout_url: session.url,
      message: `Redirecting to secure Stripe Checkout for ${pkg.name} Package ($${pkg.priceCents / 100})`,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '[Billing] Package Subscription error');
    return res.status(500).json({ error: error.message || 'Failed to process package subscription' });
  }
}) as RequestHandler);

// POST /api/v1/billing/verify-session - Verify payment completion and fulfill services
router.post('/verify-session', (async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required for verification' });
    }

    const session = await stripeService.retrieveCheckoutSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Stripe session not found' });
    }

    const { type, packageSlug, eventId, ticketId, amount } = session.metadata || {};

    // Strictly enforce payment success
    if (session.payment_status !== 'paid') {
      logger.warn(`[Billing] Session ${sessionId} verification failed: payment_status is "${session.payment_status}"`);
      return res.status(400).json({
        success: false,
        paid: false,
        paymentStatus: session.payment_status,
        error: 'Payment was not successful. No host minutes or services have been activated.',
      });
    }

    const paymentIntentId = (session.payment_intent as string) || null;

    // Fulfill Package Subscription
    if (type === 'package_subscription' && packageSlug) {
      await packageService.applyPaidPackage(userId, packageSlug, paymentIntentId || undefined);

      if (session.customer) {
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: session.customer as string },
        }).catch(() => null);
      }

      const freshUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { billingPackage: true },
      });

      return res.json({
        success: true,
        paid: true,
        type: 'package_subscription',
        message: `Payment successful! Activated ${packageSlug.toUpperCase()} Package with ${freshUser?.packageMinutesTotal?.toLocaleString()} participant-minutes.`,
        user: {
          id: freshUser!.id,
          email: freshUser!.email,
          name: freshUser!.name,
          role: freshUser!.role,
          billingPackageId: freshUser!.billingPackageId,
          packageMinutesTotal: freshUser!.packageMinutesTotal,
          packageMinutesUsed: freshUser!.packageMinutesUsed,
          billingPackage: freshUser!.billingPackage,
        },
      });
    }

    // Fulfill Ticket Purchase
    if (type === 'event_ticket') {
      if (ticketId) {
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { status: 'paid', stripePaymentIntentId: paymentIntentId },
        });
      } else if (eventId && userId) {
        const existingTicket = await prisma.ticket.findFirst({ where: { eventId, userId } });
        if (existingTicket) {
          await prisma.ticket.update({
            where: { id: existingTicket.id },
            data: { status: 'paid', stripePaymentIntentId: paymentIntentId },
          });
        }
      }

      return res.json({
        success: true,
        paid: true,
        type: 'event_ticket',
        message: 'Ticket payment verified successfully. Access granted to live room.',
      });
    }

    return res.json({
      success: true,
      paid: true,
      message: 'Payment verified successfully.',
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '[Billing] Payment session verification error');
    return res.status(500).json({ error: 'Failed to verify checkout session' });
  }
}) as RequestHandler);

// POST /api/v1/billing/setup-intent - Generate SetupIntent to save a card for 1-click topup and overages
router.post('/setup-intent', (async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const userEmail = (req as any).user.email;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      customerId = await stripeService.getOrCreateCustomer(userId, userEmail, user.name || undefined);
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const setupIntent = await stripeService.createSetupIntent(customerId, userId);
    return res.json({
      clientSecret: setupIntent.client_secret,
      customerId,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '[Billing] SetupIntent creation failed');
    return res.status(500).json({ error: 'Failed to create SetupIntent' });
  }
}) as RequestHandler);

// POST /api/v1/billing/payment-method - Save pre-authorized PaymentMethod on user profile
router.post('/payment-method', validateRequest(savePaymentMethodSchema), (async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { paymentMethodId } = req.body;

    await prisma.user.update({
      where: { id: userId },
      data: { stripePaymentMethodId: paymentMethodId },
    });

    return res.json({
      message: 'Payment method successfully saved on file',
      hasSavedCard: true,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '[Billing] Failed to save payment method');
    return res.status(500).json({ error: 'Failed to save payment method' });
  }
}) as RequestHandler);

// POST /api/v1/billing/overage-consent - Toggle overage auto-charge consent
router.post('/overage-consent', validateRequest(overageConsentSchema), (async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { consent, paymentMethodId } = req.body;

    const updateData: any = { overageConsent: Boolean(consent) };
    if (paymentMethodId) {
      updateData.stripePaymentMethodId = paymentMethodId;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        overageConsent: true,
        stripePaymentMethodId: true,
      },
    });

    return res.json({
      message: updatedUser.overageConsent
        ? 'Automatic overage protection enabled ($10 block auto-charge when balance hits 0)'
        : 'Automatic overage protection disabled (2-minute grace period before cutoff will apply)',
      overageConsent: updatedUser.overageConsent,
      hasSavedCard: Boolean(updatedUser.stripePaymentMethodId),
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '[Billing] Failed to update overage consent');
    return res.status(500).json({ error: 'Failed to update overage consent' });
  }
}) as RequestHandler);

// POST /api/v1/billing/one-click-topup - 1-Click Top Up (In-stream or Dashboard)
router.post('/one-click-topup', validateRequest(oneClickTopupSchema), (async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { sessionId } = req.body;

    const result = await billingService.executeOneClickTopup(userId, sessionId);

    return res.json({
      message: `Successfully topped up $${result.amountCents / 100} (+${result.minutesCredited.toLocaleString()} participant-minutes)`,
      newBalanceRemaining: result.newBalanceRemaining,
      minutesCredited: result.minutesCredited,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '[Billing] 1-Click Top-Up failed');
    return res.status(400).json({ error: error.message || '1-Click Top-Up failed' });
  }
}) as RequestHandler);

// GET /api/v1/billing/overages - History of overage charges
router.get('/overages', (async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const overages = await prisma.overageCharge.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json(overages);
  } catch (error: any) {
    logger.error({ error: error.message }, '[Billing] Failed to fetch overages');
    return res.status(500).json({ error: 'Failed to fetch overage history' });
  }
}) as RequestHandler);

// GET /api/v1/billing/balance - Standard wallet balance
router.get('/balance', (async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const balance = await billingService.getWalletBalance(userId);
    res.json(balance);
  } catch (error: any) {
    logger.error({ error: error.message }, '[Billing] Failed to fetch balance');
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
}) as RequestHandler);

// POST /api/v1/billing/topup - Custom top-up via Stripe Checkout
router.post('/topup', validateRequest(topupSchema), (async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { amount } = req.body;

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

    const session = await stripeService.createTopupSession(
      userId,
      Number(amount),
      `${FRONTEND_URL}/billing?success=true`,
      `${FRONTEND_URL}/billing?canceled=true`
    );

    res.json({
      checkout_url: session.url,
      message: 'Redirecting to secure Stripe Checkout',
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '[Billing] Top-up Error');
    res.status(500).json({ error: 'Failed to initiate top-up' });
  }
}) as RequestHandler);

// GET /api/v1/billing/transactions
router.get('/transactions', (async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(transactions);
  } catch (error: any) {
    logger.error({ error: error.message }, '[Billing] Failed to fetch transactions');
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}) as RequestHandler);

// GET /api/v1/billing/portal - Stripe Billing Portal
router.get('/portal', (async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.stripeCustomerId) {
      res.status(400).json({
        error: 'No Stripe customer record found. Please add a payment method or top up first.',
      });
      return;
    }

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const portalSession = await stripeService.createPortalSession(
      user.stripeCustomerId,
      `${FRONTEND_URL}/billing`
    );

    res.json({ url: portalSession.url });
  } catch (error: any) {
    logger.error({ error: error.message }, '[Billing] Portal Error');
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
}) as RequestHandler);

export default router;
