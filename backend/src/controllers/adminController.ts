import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { billingService } from '../services/billingService';
import { UserRole } from '../../../shared/types';
import { logger } from '../logger';

export const getOverviewStats = async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      userRoleCounts,
      totalSessions,
      activeSessions,
      totalEvents,
      eventStatusCounts,
      ticketsPaid,
      totalUsageMinutes,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true },
      }),
      prisma.session.count(),
      prisma.session.count({ where: { status: 'active' } }),
      prisma.event.count(),
      prisma.event.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.ticket.aggregate({
        where: { status: 'paid' },
        _sum: { amountCents: true },
        _count: { id: true },
      }),
      prisma.session.aggregate({
        _sum: { totalMinutes: true },
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          companyName: true,
        },
      }),
    ]);

    const roleBreakdown: Record<string, number> = {
      user: 0,
      host: 0,
      moderator: 0,
      admin: 0,
      super_admin: 0,
    };
    userRoleCounts.forEach((rc) => {
      roleBreakdown[rc.role] = rc._count.role;
    });

    const eventBreakdown: Record<string, number> = {
      draft: 0,
      published: 0,
      live: 0,
      ended: 0,
      cancelled: 0,
    };
    eventStatusCounts.forEach((ec) => {
      eventBreakdown[ec.status] = ec._count.status;
    });

    const totalRevenueCents = ticketsPaid._sum.amountCents || 0;
    const totalTicketsSold = ticketsPaid._count.id || 0;
    const totalMinutes = totalUsageMinutes._sum.totalMinutes || 0;

    return res.json({
      overview: {
        totalUsers,
        roleBreakdown,
        totalSessions,
        activeSessions,
        totalEvents,
        eventBreakdown,
        totalRevenueCents,
        totalRevenueUsd: totalRevenueCents / 100,
        totalTicketsSold,
        totalMinutes,
      },
      recentUsers,
    });
  } catch (error: any) {
    logger.error({ error }, '[Admin] getOverviewStats error');
    return res.status(500).json({ error: 'Failed to retrieve overview stats' });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const page = typeof req.query.page === 'string' ? req.query.page : '1';
    const limit = typeof req.query.limit === 'string' ? req.query.limit : '50';

    const take = parseInt(limit, 10) || 50;
    const skip = ((parseInt(page, 10) || 1) - 1) * take;

    const where: any = {};
    if (role && role !== 'all') {
      where.role = role;
    }
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          pricingTier: true,
          companyName: true,
          walletId: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          _count: {
            select: {
              sessions: true,
              eventsHosted: true,
              tickets: true,
              transactions: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({
      users,
      pagination: {
        total,
        page: parseInt(page, 10) || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    logger.error({ error }, '[Admin] getUsers error');
    return res.status(500).json({ error: 'Failed to retrieve users' });
  }
};

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { role } = req.body;

    const validRoles: UserRole[] = ['user', 'host', 'moderator', 'admin', 'super_admin'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        error: `Invalid role specified. Valid roles are: ${validRoles.join(', ')}`,
      });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Provision Lago wallet if promoted to host/admin/super_admin and doesn't have one
    let walletId = targetUser.walletId;
    if ((role === 'host' || role === 'admin' || role === 'super_admin') && !walletId) {
      try {
        await billingService.createLagoCustomer(targetUser.id, targetUser.email);
        walletId = await billingService.createLagoWallet(targetUser.id);
      } catch (lagoErr) {
        logger.warn({ lagoErr }, '[Admin] Lago wallet provision failed on role elevation (non-fatal)');
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        role,
        ...(walletId ? { walletId } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        walletId: true,
        companyName: true,
      },
    });

    logger.info(`[Admin] User ${updatedUser.email} role updated to ${role} by admin ${(req as any).user?.email}`);

    return res.json({
      message: `User role successfully updated to ${role}`,
      user: updatedUser,
    });
  } catch (error: any) {
    logger.error({ error }, '[Admin] updateUserRole error');
    return res.status(500).json({ error: 'Failed to update user role' });
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    const validStatuses = ['active', 'suspended', 'pending'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Valid values: ${validStatuses.join(', ')}`,
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });

    logger.info(`[Admin] User ${updatedUser.email} status updated to ${status}`);

    return res.json({
      message: `User status updated to ${status}`,
      user: updatedUser,
    });
  } catch (error: any) {
    logger.error({ error }, '[Admin] updateUserStatus error');
    return res.status(500).json({ error: 'Failed to update user status' });
  }
};

export const getAllEvents = async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const page = typeof req.query.page === 'string' ? req.query.page : '1';
    const limit = typeof req.query.limit === 'string' ? req.query.limit : '50';

    const take = parseInt(limit, 10) || 50;
    const skip = ((parseInt(page, 10) || 1) - 1) * take;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search && search.trim().length > 0) {
      where.title = { contains: search.trim(), mode: 'insensitive' };
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        take,
        skip,
        orderBy: { startsAt: 'desc' },
        include: {
          facilitator: {
            select: { id: true, email: true, name: true, companyName: true },
          },
          session: {
            select: { id: true, status: true, participantCount: true, totalMinutes: true },
          },
          _count: {
            select: { tickets: true },
          },
        },
      }),
      prisma.event.count({ where }),
    ]);

    return res.json({
      events,
      pagination: {
        total,
        page: parseInt(page, 10) || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    logger.error({ error }, '[Admin] getAllEvents error');
    return res.status(500).json({ error: 'Failed to retrieve events' });
  }
};

export const getAllSessions = async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const page = typeof req.query.page === 'string' ? req.query.page : '1';
    const limit = typeof req.query.limit === 'string' ? req.query.limit : '50';

    const take = parseInt(limit, 10) || 50;
    const skip = ((parseInt(page, 10) || 1) - 1) * take;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          facilitator: {
            select: { id: true, email: true, name: true, companyName: true },
          },
          event: {
            select: { id: true, title: true, status: true, priceCents: true },
          },
        },
      }),
      prisma.session.count({ where }),
    ]);

    return res.json({
      sessions,
      pagination: {
        total,
        page: parseInt(page, 10) || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    logger.error({ error }, '[Admin] getAllSessions error');
    return res.status(500).json({ error: 'Failed to retrieve sessions' });
  }
};

export const getAllTransactions = async (req: Request, res: Response) => {
  try {
    const page = typeof req.query.page === 'string' ? req.query.page : '1';
    const limit = typeof req.query.limit === 'string' ? req.query.limit : '50';

    const take = parseInt(limit, 10) || 50;
    const skip = ((parseInt(page, 10) || 1) - 1) * take;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, name: true, companyName: true, role: true },
          },
        },
      }),
      prisma.transaction.count(),
    ]);

    return res.json({
      transactions,
      pagination: {
        total,
        page: parseInt(page, 10) || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    logger.error({ error }, '[Admin] getAllTransactions error');
    return res.status(500).json({ error: 'Failed to retrieve transactions' });
  }
};

export const ensureSuperAdmin = async () => {
  const superAdminEmail = 'superadmin@svsm.io';
  const superAdminPassword = 'SuperAdmin@2026!';

  try {
    const existing = await prisma.user.findUnique({
      where: { email: superAdminEmail },
    });

    if (!existing) {
      const passwordHash = await bcrypt.hash(superAdminPassword, 10);
      const superAdmin = await prisma.user.create({
        data: {
          email: superAdminEmail,
          passwordHash,
          name: 'Master Super Admin',
          role: 'super_admin',
          companyName: 'SVSM Global Administration',
          status: 'active',
          emailVerified: true,
          pricingTier: 'premium',
        },
      });
      logger.info(`[Admin] Initial Super Admin created: ${superAdmin.email}`);
    } else if (existing.role !== 'super_admin') {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'super_admin', status: 'active' },
      });
      logger.info(`[Admin] User ${existing.email} updated to role: super_admin`);
    }
  } catch (err: any) {
    logger.error({ err }, '[Admin] Error ensuring Super Admin account exists');
  }
};

export const seedSuperAdminHandler = async (_req: Request, res: Response) => {
  try {
    await ensureSuperAdmin();
    return res.json({
      message: 'Super Admin credentials confirmed and ready.',
      credentials: {
        email: 'superadmin@svsm.io',
        password: 'SuperAdmin@2026!',
        role: 'super_admin',
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to seed super admin' });
  }
};
