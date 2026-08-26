import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { billingService } from '../services/billingService';
import { AuthResponse, UserRole, User } from '../../../shared/types';

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

    // Only 'user' and 'host' are self-registerable roles.
    // Moderators must be assigned by a host from the dashboard.
    // Admin/super_admin are system-assigned or seeded.
    const requestedRole = (req.body.role || 'user').toString().toLowerCase().trim();
    const validSelfRegisterRoles: UserRole[] = ['user', 'host'];
    const assignedRole: UserRole = (validSelfRegisterRoles as string[]).includes(requestedRole)
      ? (requestedRole as UserRole)
      : 'user';

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        name: name?.trim() || null,
        role: assignedRole,
        companyName: companyName?.trim() || null,
        status: 'active',
        emailVerified: false,
        lastLoginAt: new Date(),
      },
    });

    // Provision Lago customer + wallet if host or requested
    let finalWalletId: string | null = null;
    if (assignedRole === 'host') {
      try {
        await billingService.createLagoCustomer(user.id, user.email);
        finalWalletId = await billingService.createLagoWallet(user.id);
        if (finalWalletId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { walletId: finalWalletId },
          });
          console.log(`[Auth] Lago provisioning complete for host ${user.email}`);
        }
      } catch (lagoErr) {
        console.error('[Auth] Lago provisioning failed (non-fatal):', lagoErr);
      }
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const authResponse: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        role: user.role as UserRole,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt?.toISOString(),
        companyName: user.companyName || undefined,
        pricingTier: user.pricingTier,
        status: user.status,
        walletId: finalWalletId ?? undefined,
      },
      token,
    };

    return res.status(201).json(authResponse);
  } catch (error) {
    console.error('[Auth] Register error:', error);
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

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
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

