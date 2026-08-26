import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

/**
 * Checks that the host has an active billing package with remaining participant-minutes
 * before allowing a new session to start.
 *
 * This middleware gates on PARTICIPANT-MINUTES (not cash USD), since the platform
 * uses a pre-paid package model: Free (3,000 pm), Starter (10,000 pm), etc.
 *
 * Super admins and admins bypass this check entirely.
 */
export const checkBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user?.role || 'user';

    // Super admins and admins always bypass billing checks
    if (userRole === 'super_admin' || userRole === 'admin') {
      return next();
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Require an active billing package
    if (!user.billingPackageId) {
      return res.status(402).json({
        error: 'No billing package selected',
        requiresPackage: true,
        message: 'Please choose a hosting package from the billing marketplace before starting a live session.',
      });
    }

    const remaining = Math.max(0, (user.packageMinutesTotal || 0) - (user.packageMinutesUsed || 0));

    // Block only if balance is completely zero AND no overage consent/card on file
    if (remaining <= 0 && (!user.stripePaymentMethodId || !user.overageConsent)) {
      return res.status(402).json({
        error: 'Participant-minutes depleted',
        requiresTopup: true,
        message: `Your participant-minute balance is 0. Please top up your package or enable automatic overage protection to start a new session.`,
        minutesRemaining: 0,
      });
    }

    // Attach balance info for downstream controllers
    (req as any).minutesRemaining = remaining;
    next();
  } catch (error) {
    console.error('[BalanceCheck] Middleware error:', error);
    // Fail-open in development so Agora isn't blocked by billing errors
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }
    return res.status(503).json({
      error: 'Billing service temporarily unavailable. Please try again.',
    });
  }
};
