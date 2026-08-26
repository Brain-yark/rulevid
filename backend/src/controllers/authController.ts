import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { billingService } from '../services/billingService';
import { packageService } from '../services/packageService';
import { stripeService } from '../services/stripeService';
import { AuthResponse, UserRole, User } from '@shared/types';
import { logger } from '../logger';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, companyName, role = 'user', packageSlug } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const requestedRole = (role || 'user').toString().toLowerCase().trim();
    const validSelfRegisterRoles: UserRole[] = ['user', 'host'];
    const assignedRole: UserRole = (validSelfRegisterRoles as string[]).includes(requestedRole)
      ? (requestedRole as UserRole)
      : 'user';

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already taken' });
    }

    const selectedSlug = packageSlug || 'free';
    const isPaidSignup = assignedRole === 'host' && (selectedSlug === 'starter' || selectedSlug === 'growth');

    // If paid host signup, account starts as 'user' until Stripe payment confirms
    const initialRole: UserRole = isPaidSignup ? 'user' : assignedRole;

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        name: name?.trim() || null,
        role: initialRole,
        companyName: companyName?.trim() || null,
        status: 'active',
        emailVerified: false,
        lastLoginAt: new Date(),
      },
    });

    let checkoutUrl: string | undefined = undefined;

    // If host registering:
    if (assignedRole === 'host') {
      if (selectedSlug === 'free') {
        try {
          await packageService.subscribeFreePackage(user.id);
          logger.info(`[Auth] Free host package subscribed for ${user.email}`);
        } catch (pkgErr: any) {
          logger.warn({ pkgErr: pkgErr.message }, '[Auth] Free package subscription error (non-fatal)');
        }
      } else if (isPaidSignup) {
        try {
          const pkg = await packageService.getPackageBySlug(selectedSlug);
          if (pkg) {
            const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
            const session = await stripeService.createPackageCheckoutSession(
              user.id,
              pkg.slug,
              pkg.name,
              pkg.priceCents,
              pkg.participantMinutes,
              `${FRONTEND_URL}/billing?success=true&package=${pkg.slug}`,
              `${FRONTEND_URL}/billing?canceled=true`
            );
            checkoutUrl = session.url || undefined;
          }
        } catch (stripeErr: any) {
          logger.warn({ stripeErr: stripeErr.message }, '[Auth] Stripe package checkout creation error');
        }
      }

      // Provision Lago wallet
      try {
        await billingService.createLagoCustomer(user.id, user.email);
        const finalWalletId = await billingService.createLagoWallet(user.id);
        if (finalWalletId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { walletId: finalWalletId },
          });
        }
      } catch (lagoErr: any) {
        logger.warn({ lagoErr: lagoErr.message }, '[Auth] Lago provisioning failed (non-fatal)');
      }
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { billingPackage: true },
    });

    const authResponse: AuthResponse & { checkoutUrl?: string } = {
      user: {
        id: freshUser!.id,
        email: freshUser!.email,
        name: freshUser!.name || undefined,
        role: freshUser!.role as UserRole,
        emailVerified: freshUser!.emailVerified,
        lastLoginAt: freshUser!.lastLoginAt?.toISOString(),
        companyName: freshUser!.companyName || undefined,
        pricingTier: freshUser!.pricingTier,
        status: freshUser!.status,
        walletId: freshUser!.walletId ?? undefined,
        billingPackageId: freshUser!.billingPackageId ?? undefined,
        billingPackage: freshUser!.billingPackage as any,
        packageMinutesTotal: freshUser!.packageMinutesTotal,
        packageMinutesUsed: freshUser!.packageMinutesUsed,
        packageCycleStartedAt: freshUser!.packageCycleStartedAt?.toISOString(),
        packageCycleExpiresAt: freshUser!.packageCycleExpiresAt?.toISOString(),
        overageConsent: freshUser!.overageConsent,
      },
      token,
      ...(checkoutUrl ? { checkoutUrl } : {}),
    };

    return res.status(201).json(authResponse);
  } catch (error: any) {
    logger.error({ error: error.message }, '[Auth] Register error');
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      include: { billingPackage: true },
    });

    const token = jwt.sign(
      { userId: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const authResponse: AuthResponse = {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name || undefined,
        role: updatedUser.role as UserRole,
        emailVerified: updatedUser.emailVerified,
        lastLoginAt: updatedUser.lastLoginAt?.toISOString(),
        companyName: updatedUser.companyName || undefined,
        pricingTier: updatedUser.pricingTier,
        status: updatedUser.status,
        walletId: updatedUser.walletId || undefined,
        billingPackageId: updatedUser.billingPackageId || undefined,
        billingPackage: updatedUser.billingPackage as any,
        packageMinutesTotal: updatedUser.packageMinutesTotal,
        packageMinutesUsed: updatedUser.packageMinutesUsed,
        packageCycleStartedAt: updatedUser.packageCycleStartedAt?.toISOString(),
        packageCycleExpiresAt: updatedUser.packageCycleExpiresAt?.toISOString(),
        overageConsent: updatedUser.overageConsent,
      },
      token,
    };

    return res.json(authResponse);
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { billingPackage: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    const authResponse: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        bio: (user as any).bio || undefined,
        avatarUrl: (user as any).avatarUrl || undefined,
        location: (user as any).location || undefined,
        websiteUrl: (user as any).websiteUrl || undefined,
        role: user.role as UserRole,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt?.toISOString(),
        companyName: user.companyName || undefined,
        pricingTier: user.pricingTier,
        status: user.status,
        walletId: user.walletId || undefined,
        billingPackageId: user.billingPackageId || undefined,
        billingPackage: user.billingPackage as any,
        packageMinutesTotal: user.packageMinutesTotal,
        packageMinutesUsed: user.packageMinutesUsed,
        packageCycleStartedAt: user.packageCycleStartedAt?.toISOString(),
        packageCycleExpiresAt: user.packageCycleExpiresAt?.toISOString(),
        overageConsent: user.overageConsent,
        createdAt: user.createdAt?.toISOString(),
      },
      token,
    };

    return res.json(authResponse);
  } catch (error) {
    console.error('[Auth] getMe error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name,
      bio,
      avatarUrl,
      location,
      websiteUrl,
      companyName,
      currentPassword,
      newPassword,
    } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData: any = {};

    if (name !== undefined) updateData.name = name.trim() || null;
    if (bio !== undefined) updateData.bio = bio.trim() || null;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl.trim() || null;
    if (location !== undefined) updateData.location = location.trim() || null;
    if (websiteUrl !== undefined) updateData.websiteUrl = websiteUrl.trim() || null;
    if (companyName !== undefined) updateData.companyName = companyName.trim() || null;

    // Handle password change if requested
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set a new password' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Incorrect current password' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const sanitizedUser: User = {
      id: updated.id,
      email: updated.email,
      name: updated.name || undefined,
      bio: (updated as any).bio || undefined,
      avatarUrl: (updated as any).avatarUrl || undefined,
      location: (updated as any).location || undefined,
      websiteUrl: (updated as any).websiteUrl || undefined,
      role: updated.role as UserRole,
      emailVerified: updated.emailVerified,
      lastLoginAt: updated.lastLoginAt?.toISOString(),
      companyName: updated.companyName || undefined,
      pricingTier: updated.pricingTier,
      status: updated.status,
      walletId: updated.walletId || undefined,
      billingPackageId: updated.billingPackageId || undefined,
      packageMinutesTotal: updated.packageMinutesTotal,
      packageMinutesUsed: updated.packageMinutesUsed,
      overageConsent: updated.overageConsent,
      createdAt: updated.createdAt?.toISOString(),
    };

    return res.json({
      message: 'Profile updated successfully',
      user: sanitizedUser,
    });
  } catch (error: any) {
    console.error('[Auth] updateProfile error:', error);
    return res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
};

