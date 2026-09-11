import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../db';
import { billingService } from '../services/billingService';
import { packageService } from '../services/packageService';
import { stripeService } from '../services/stripeService';
import { emailService } from '../services/emailService';
import { AuthResponse, UserRole, User } from '@shared/types';
import { logger } from '../logger';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, companyName, role = 'user' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Strict MVP Policy: Public self-registration is strictly for attendees ('user').
    // Host accounts are provisioned exclusively by the Super Admin (max 3 hosts allowed).
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        name: name?.trim() || null,
        role: 'user',
        companyName: companyName?.trim() || null,
        status: 'active',
        emailVerified: false,
        verificationToken,
        verificationExpiresAt,
        lastLoginAt: null,
      },
    });

    // Send verification email via Resend
    await emailService.sendVerificationEmail(user.email, user.name, verificationToken);

    return res.status(201).json({
      message: 'Account created! Please check your email to confirm your account before logging in.',
      requiresVerification: true,
      email: user.email,
    });
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

    // Require email verification for all non-superadmin users
    if (user.role !== 'super_admin' && !user.emailVerified) {
      return res.status(403).json({
        error: 'Please confirm your email address before signing in. Check your inbox for the confirmation link.',
        requiresVerification: true,
        email: user.email,
      });
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

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    if (user.verificationExpiresAt && user.verificationExpiresAt < new Date()) {
      return res.status(400).json({
        error: 'Verification link has expired. Please request a new verification email.',
        expired: true,
        email: user.email,
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpiresAt: null,
      },
    });

    // Send welcome confirmation email
    emailService.sendWelcomeEmail(user.email, user.name).catch((err) => {
      logger.warn({ error: err.message }, '[Auth] Failed sending welcome email after verification');
    });

    return res.json({
      message: 'Email verified successfully! You can now log in.',
      success: true,
      email: user.email,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '[Auth] verifyEmail error');
    return res.status(500).json({ error: 'Failed to verify email' });
  }
};

export const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      // Don't leak email existence
      return res.json({
        message: 'If an account exists with this email, a verification link has been sent.',
        success: true,
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'This email is already verified. You can sign in directly.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationExpiresAt,
      },
    });

    await emailService.sendVerificationEmail(user.email, user.name, verificationToken);

    return res.json({
      message: 'A fresh verification email has been sent. Please check your inbox.',
      success: true,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '[Auth] resendVerification error');
    return res.status(500).json({ error: 'Failed to resend verification email' });
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

