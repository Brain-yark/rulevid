import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { billingService } from '../services/billingService';
import { AuthResponse } from '../../../shared/types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, companyName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        companyName,
      },
    });

    // ── Provision Lago customer + wallet (non-blocking — registration succeeds even on failure) ──
    let finalWalletId: string | null = null;
    try {
      await billingService.createLagoCustomer(user.id, user.email);
      finalWalletId = await billingService.createLagoWallet(user.id);
      if (finalWalletId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { walletId: finalWalletId },
        });
        console.log(`[Auth] Lago provisioning complete for ${user.email}`);
      }
    } catch (lagoErr) {
      console.error('[Auth] Lago provisioning failed (non-fatal):', lagoErr);
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    const authResponse: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
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

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    const authResponse: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        companyName: user.companyName || undefined,
        pricingTier: user.pricingTier,
        status: user.status,
        walletId: user.walletId || undefined,
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
    // Extract and verify token (reusing authMiddleware pattern)
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

    const authResponse: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        companyName: user.companyName || undefined,
        pricingTier: user.pricingTier,
        status: user.status,
        walletId: user.walletId || undefined,
      },
      token,
    };

    return res.json(authResponse);
  } catch (error) {
    console.error('[Auth] getMe error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
