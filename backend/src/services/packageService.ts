import { prisma } from '../db';
import { BillingPackage, UserPackageStatus } from '@shared/types';
import { logger } from '../logger';

const DEFAULT_PACKAGES = [
  {
    id: 'pkg-free-001',
    name: 'Free',
    slug: 'free',
    participantMinutes: 3000,
    priceCents: 0,
    effectiveRatePer1k: '—',
    roughlyCovers: '~1 small event (e.g. 1hr, 50 attendees)',
    overageBlockCents: 1000,
    overageBlockMinutes: 10000,
    description: 'Perfect for getting started, testing RuleVid, and hosting small interactive sessions.',
    isActive: true,
    isCustom: false,
  },
  {
    id: 'pkg-starter-002',
    name: 'Starter',
    slug: 'starter',
    participantMinutes: 30000,
    priceCents: 3000,
    effectiveRatePer1k: '$1.00/1k',
    roughlyCovers: '~10 events of 50 attendees/hr',
    overageBlockCents: 1000,
    overageBlockMinutes: 10000,
    description: 'Ideal for growing community hosts, creators, and recurring weekly meetups.',
    isActive: true,
    isCustom: false,
  },
  {
    id: 'pkg-growth-003',
    name: 'Growth',
    slug: 'growth',
    participantMinutes: 150000,
    priceCents: 13000,
    effectiveRatePer1k: '$0.87/1k',
    roughlyCovers: '~50 events of 50 attendees/hr',
    overageBlockCents: 1000,
    overageBlockMinutes: 10000,
    description: 'Best value for high-volume masterclasses, workshops, and multi-track conferences.',
    isActive: true,
    isCustom: false,
  },
  {
    id: 'pkg-scale-004',
    name: 'Scale',
    slug: 'scale',
    participantMinutes: 750000,
    priceCents: 0,
    effectiveRatePer1k: 'negotiated',
    roughlyCovers: 'high-volume enterprise hosts',
    overageBlockCents: 1000,
    overageBlockMinutes: 10000,
    description: 'Custom tailored enterprise infrastructure with dedicated bitrate allocation & custom SLA.',
    isActive: true,
    isCustom: true,
  },
];

export class PackageService {
  /**
   * Ensures default packages exist in the database.
   */
  async ensureDefaultPackages(): Promise<void> {
    try {
      const count = await prisma.billingPackage.count();
      if (count === 0) {
        logger.info('[PackageService] Seeding default billing packages...');
        for (const pkg of DEFAULT_PACKAGES) {
          await prisma.billingPackage.upsert({
            where: { slug: pkg.slug },
            update: {},
            create: pkg,
          });
        }
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, '[PackageService] Could not auto-seed packages');
    }
  }

  /**
   * Returns all active billing packages (or all if includeInactive is true).
   */
  async getAllPackages(includeInactive = false): Promise<BillingPackage[]> {
    await this.ensureDefaultPackages();
    const packages = await prisma.billingPackage.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { priceCents: 'asc' },
    });
    return packages as BillingPackage[];
  }

  /**
   * Find package by slug (e.g. 'free', 'starter', 'growth', 'scale').
   */
  async getPackageBySlug(slug: string): Promise<BillingPackage | null> {
    await this.ensureDefaultPackages();
    let pkg = await prisma.billingPackage.findUnique({
      where: { slug },
    });
    if (!pkg) {
      const def = DEFAULT_PACKAGES.find(p => p.slug === slug);
      if (def) {
        try {
          pkg = await prisma.billingPackage.create({ data: def });
        } catch {
          pkg = await prisma.billingPackage.findUnique({ where: { slug } });
        }
      }
    }
    return pkg as BillingPackage | null;
  }

  /**
   * Computes the current user's package status, handling monthly cycle rollover if expired.
   */
  async getUserPackageStatus(userId: string): Promise<UserPackageStatus> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { billingPackage: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    let packageMinutesTotal = user.packageMinutesTotal;
    let packageMinutesUsed = user.packageMinutesUsed;
    let cycleStartedAt = user.packageCycleStartedAt;
    let cycleExpiresAt = user.packageCycleExpiresAt;

    const now = new Date();

    // Check if 30-day billing cycle has expired and should reset
    if (cycleExpiresAt && now > cycleExpiresAt) {
      logger.info(`[PackageService] User ${userId} monthly cycle expired. Resetting used minutes.`);
      cycleStartedAt = now;
      cycleExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      packageMinutesUsed = 0;

      // If user has an active recurring package, refresh their monthly minutes allowance
      if (user.billingPackage) {
        packageMinutesTotal = user.billingPackage.participantMinutes;
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          packageMinutesUsed: 0,
          packageMinutesTotal,
          packageCycleStartedAt: cycleStartedAt,
          packageCycleExpiresAt: cycleExpiresAt,
        },
      });
    }

    const packageMinutesRemaining = Math.max(0, packageMinutesTotal - packageMinutesUsed);
    const percentRemaining = packageMinutesTotal > 0
      ? Math.min(100, Math.max(0, parseFloat(((packageMinutesRemaining / packageMinutesTotal) * 100).toFixed(1))))
      : 0;

    const isDepleted = packageMinutesRemaining <= 0;
    const isLowBalance = !isDepleted && percentRemaining <= 20;

    let daysUntilReset: number | null = null;
    if (cycleExpiresAt) {
      const diffMs = cycleExpiresAt.getTime() - now.getTime();
      daysUntilReset = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      hasPackage: Boolean(user.billingPackageId),
      package: user.billingPackage as BillingPackage | null,
      packageMinutesTotal,
      packageMinutesUsed,
      packageMinutesRemaining,
      percentRemaining,
      isLowBalance,
      isDepleted,
      overageConsent: user.overageConsent,
      hasSavedCard: Boolean(user.stripePaymentMethodId),
      packageCycleStartedAt: cycleStartedAt ? cycleStartedAt.toISOString() : null,
      packageCycleExpiresAt: cycleExpiresAt ? cycleExpiresAt.toISOString() : null,
      daysUntilReset,
    };
  }

  /**
   * Subscribes a user to the Free package.
   * Free tier grants 3,000 participant-minutes for 30 days and elevates role to host.
   */
  async subscribeFreePackage(userId: string): Promise<{ success: boolean; status: UserPackageStatus }> {
    const freePkg = await this.getPackageBySlug('free');
    if (!freePkg) {
      throw new Error('Free package is not configured in the marketplace');
    }

    const now = new Date();
    const cycleExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const nextRole = (user.role === 'admin' || user.role === 'super_admin') ? user.role : 'host';

    await prisma.user.update({
      where: { id: userId },
      data: {
        billingPackageId: freePkg.id,
        packageMinutesTotal: freePkg.participantMinutes,
        packageMinutesUsed: 0,
        packageCycleStartedAt: now,
        packageCycleExpiresAt: cycleExpiresAt,
        role: nextRole,
      },
    });

    // Record 0 transaction for audit
    await prisma.transaction.create({
      data: {
        type: 'package_subscription',
        amount: 0,
        currency: 'USD',
        balanceAfter: 0,
        description: `Subscribed to Free Tier (3,000 participant-minutes)`,
        status: 'completed',
        userId,
      },
    });

    const status = await this.getUserPackageStatus(userId);
    return { success: true, status };
  }

  /**
   * Applies a purchased package to the user account upon payment confirmation.
   */
  async applyPaidPackage(userId: string, packageSlug: string, paymentIntentId?: string): Promise<UserPackageStatus> {
    const pkg = await this.getPackageBySlug(packageSlug);
    if (!pkg) {
      throw new Error(`Package ${packageSlug} not found`);
    }

    const now = new Date();
    const cycleExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const nextRole = (user.role === 'admin' || user.role === 'super_admin') ? user.role : 'host';

    await prisma.user.update({
      where: { id: userId },
      data: {
        billingPackageId: pkg.id,
        packageMinutesTotal: pkg.participantMinutes,
        packageMinutesUsed: 0,
        packageCycleStartedAt: now,
        packageCycleExpiresAt: cycleExpiresAt,
        role: nextRole,
      },
    });

    await prisma.transaction.create({
      data: {
        type: 'package_subscription',
        amount: pkg.priceCents / 100,
        currency: 'USD',
        balanceAfter: 0,
        description: `Subscribed to ${pkg.name} Package (${pkg.participantMinutes.toLocaleString()} participant-minutes)`,
        lagoTransactionId: paymentIntentId || undefined,
        status: 'completed',
        userId,
      },
    });

    return this.getUserPackageStatus(userId);
  }

  /**
   * Consumes participant-minutes in real-time or post-session.
   */
  async consumeParticipantMinutes(userId: string, participantMinutesToDeduct: number): Promise<{
    newUsed: number;
    remaining: number;
    percentRemaining: number;
    isDepleted: boolean;
    isLowBalance: boolean;
  }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        packageMinutesUsed: { increment: participantMinutesToDeduct },
      },
    });

    const remaining = Math.max(0, updatedUser.packageMinutesTotal - updatedUser.packageMinutesUsed);
    const percentRemaining = updatedUser.packageMinutesTotal > 0
      ? parseFloat(((remaining / updatedUser.packageMinutesTotal) * 100).toFixed(1))
      : 0;

    const isDepleted = remaining <= 0;
    const isLowBalance = !isDepleted && percentRemaining <= 20;

    return {
      newUsed: updatedUser.packageMinutesUsed,
      remaining,
      percentRemaining,
      isDepleted,
      isLowBalance,
    };
  }

  async deductMinutes(userId: string, minutes: number) {
    return await this.consumeParticipantMinutes(userId, minutes);
  }

  /**
   * Evaluates a host's real-time live balance against their current audience size.
   */
  async checkHostLiveBalance(facilitatorId: string, currentAudienceSize: number) {
    const status = await this.getUserPackageStatus(facilitatorId);
    const audience = Math.max(1, currentAudienceSize);
    const estimatedMinutesLeft = Math.floor(status.packageMinutesRemaining / audience);

    return {
      ...status,
      audienceSize: audience,
      estimatedMinutesLeft,
      warningMessage: status.isLowBalance
        ? `Low on minutes — ${status.packageMinutesRemaining.toLocaleString()} remaining, ~${estimatedMinutesLeft} minutes left at current audience size (${audience} attendees)`
        : null,
    };
  }
}

export const packageService = new PackageService();
