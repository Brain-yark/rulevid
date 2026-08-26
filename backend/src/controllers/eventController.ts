import { Request, Response } from 'express';
import { prisma } from '../db';
import { generateAgoraToken } from '../services/agoraTokenService';
import { agoraRecordingService } from '../services/agoraRecordingService';
import { agoraChatService } from '../services/agoraChatService';
import { stripeService } from '../services/stripeService';
import { packageService } from '../services/packageService';
import { billingService } from '../services/billingService';

export const EARLY_START_BUFFER_MINUTES = 15;
export const EARLY_START_BUFFER_MS = EARLY_START_BUFFER_MINUTES * 60 * 1000;

/**
 * Calculates whether an event has entered its allowed live window.
 */
export const getEventTimingStatus = (startsAt: Date | string) => {
  const now = Date.now();
  const eventStartsAtMs = new Date(startsAt).getTime();
  const earliestStartMs = eventStartsAtMs - EARLY_START_BUFFER_MS;
  const canStartLive = now >= earliestStartMs;
  return {
    now,
    eventStartsAtMs,
    earliestStartMs,
    canStartLive,
    earliestStartAt: new Date(earliestStartMs).toISOString(),
    startsAt: new Date(eventStartsAtMs).toISOString(),
  };
};

/**
 * Sanitizes an email into a valid Agora Chat username.
 * e.g., user@example.com -> user_example_com
 */
const getChatUsername = (email: string) => {
  return email.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
};

/**
 * Helper to fetch user email if not in JWT payload.
 */
const resolveUserEmail = async (userId: string, emailFromJwt?: string) => {
  if (emailFromJwt) return emailFromJwt;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email || 'user@example.com';
};

/**
 * POST /api/v1/events
 * Create a new event (Host only).
 */
export const createEvent = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, description, startsAt, priceCents = 0, capacity = null } = req.body;

    if (!title || !startsAt) {
      return res.status(400).json({ error: 'Title and start date/time are required' });
    }

    // Check if user has selected a host billing package (Free, Starter, Growth, Scale)
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      const hostUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!hostUser?.billingPackageId && hostUser?.packageMinutesTotal === 0) {
        return res.status(403).json({
          error: 'Billing package selection required',
          requiresPackage: true,
          message: 'All hosts must select a billing tier (Free, Starter, Growth, or Scale) from the marketplace before hosting events.',
        });
      }
    }

    // Automatically elevate user role to host if creating an event
    await prisma.user.update({
      where: { id: userId },
      data: { role: user.role === 'admin' || user.role === 'super_admin' ? user.role : 'host' },
    }).catch(() => null);

    const event = await prisma.event.create({
      data: {
        title,
        description: description || null,
        startsAt: new Date(startsAt),
        priceCents: Math.max(0, parseInt(priceCents, 10) || 0),
        capacity: capacity ? parseInt(capacity, 10) : null,
        facilitatorId: userId,
        status: 'draft',
      },
      include: {
        facilitator: {
          select: { id: true, email: true, name: true, companyName: true },
        },
      },
    });

    const timing = getEventTimingStatus(event.startsAt);

    return res.status(201).json({
      ...event,
      canStartLive: timing.canStartLive,
      earliestStartAt: timing.earliestStartAt,
    });
  } catch (error: any) {
    console.error('[Event] Creation error:', error);
    return res.status(500).json({ error: 'Failed to create event', details: error.message });
  }
};

/**
 * GET /api/v1/events
 * List events. If view === 'mine', returns host's events with sales metrics.
 * Otherwise returns public published/live events.
 */
export const getEvents = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { view, status, search } = req.query;

    const isHostView = view === 'mine' && !!userId;

    const whereClause: any = {};

    if (isHostView) {
      const userRole = (req as any).user?.role || 'user';
      if (['host', 'admin', 'moderator'].includes(userRole)) {
        // Fetch current user's company Name
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        if (currentUser?.companyName) {
          const companyUsers = await prisma.user.findMany({
            where: { companyName: currentUser.companyName },
            select: { id: true },
          });
          const companyUserIds = companyUsers.map(u => u.id);
          whereClause.facilitatorId = { in: companyUserIds };
        } else {
          whereClause.facilitatorId = userId;
        }
      } else {
        whereClause.facilitatorId = userId;
      }
      
      if (status) {
        whereClause.status = status as string;
      }
    } else {
      // Public view only shows published, live, or ended events
      whereClause.status = status ? (status as string) : { in: ['published', 'live', 'ended'] };
    }

    if (search) {
      whereClause.title = { contains: search as string, mode: 'insensitive' };
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      include: {
        facilitator: {
          select: { id: true, email: true, name: true, companyName: true },
        },
        session: {
          select: { id: true, channelName: true, status: true, participantCount: true },
        },
        _count: {
          select: {
            tickets: {
              where: { status: 'paid' },
            },
          },
        },
      },
      orderBy: { startsAt: 'desc' },
    });

    // Enhance events with stats & scheduling timing
    const enhancedEvents = await Promise.all(
      events.map(async (ev) => {
        const paidTickets = await prisma.ticket.aggregate({
          where: { eventId: ev.id, status: 'paid' },
          _sum: { amountCents: true },
          _count: { id: true },
        });

        let hasPurchasedTicket = false;
        if (userId) {
          const userTicket = await prisma.ticket.findFirst({
            where: { eventId: ev.id, userId, status: 'paid' },
          });
          hasPurchasedTicket = !!userTicket;
        }

        const timing = getEventTimingStatus(ev.startsAt);

        return {
          ...ev,
          paidTicketsCount: paidTickets._count.id || 0,
          totalRevenueCents: paidTickets._sum.amountCents || 0,
          hasPurchasedTicket,
          isHost: userId ? ev.facilitatorId === userId : false,
          canStartLive: timing.canStartLive,
          earliestStartAt: timing.earliestStartAt,
        };
      })
    );

    return res.json(enhancedEvents);
  } catch (error: any) {
    console.error('[Event] List error:', error);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
};

/**
 * GET /api/v1/events/:id
 * Get single event details, including capacity, ticket count, buyer ticket state, and timing.
 */
export const getEventById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    const event = await prisma.event.findUnique({
      where: { id: id as string },
      include: {
        facilitator: {
          select: { id: true, email: true, name: true, companyName: true },
        },
        session: {
          select: { id: true, channelName: true, status: true, agoraChatRoomId: true },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const paidTicketsStats = await prisma.ticket.aggregate({
      where: { eventId: id as string, status: 'paid' },
      _sum: { amountCents: true },
      _count: { id: true },
    });

    const isHost = userId ? event.facilitatorId === userId : false;

    let userTicket = null;
    if (userId) {
      userTicket = await prisma.ticket.findFirst({
        where: { eventId: id as string, userId, status: 'paid' },
      });
    }

    const timing = getEventTimingStatus(event.startsAt);

    return res.json({
      ...event,
      paidTicketsCount: paidTicketsStats._count.id || 0,
      totalRevenueCents: paidTicketsStats._sum.amountCents || 0,
      isHost,
      canStartLive: timing.canStartLive,
      earliestStartAt: timing.earliestStartAt,
      hasPurchasedTicket: !!userTicket,
      userTicket: userTicket || null,
    });
  } catch (error: any) {
    console.error('[Event] Get single error:', error);
    return res.status(500).json({ error: 'Failed to fetch event' });
  }
};

/**
 * PATCH /api/v1/events/:id/publish
 * Host publishes a draft event to make it publicly discoverable/purchasable.
 */
export const publishEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const event = await prisma.event.findUnique({ where: { id: id as string } });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.facilitatorId !== userId) {
      return res.status(403).json({ error: 'Only the host can publish this event' });
    }

    const updated = await prisma.event.update({
      where: { id: id as string },
      data: { status: 'published' },
      include: { facilitator: { select: { id: true, email: true, companyName: true } } },
    });

    return res.json(updated);
  } catch (error: any) {
    console.error('[Event] Publish error:', error);
    return res.status(500).json({ error: 'Failed to publish event' });
  }
};

/**
 * POST /api/v1/events/:id/checkout
 * Buyer initiates ticket checkout via Stripe Checkout (or instant free ticket).
 */
export const createTicketCheckout = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const event = await prisma.event.findUnique({ where: { id: id as string } });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.status !== 'published' && event.status !== 'live') {
      return res.status(400).json({ error: 'Tickets are not currently on sale for this event' });
    }

    // Check capacity
    if (event.capacity) {
      const paidCount = await prisma.ticket.count({
        where: { eventId: id as string, status: 'paid' },
      });
      if (paidCount >= event.capacity) {
        return res.status(400).json({ error: 'Event is sold out' });
      }
    }

    // Check if user already owns a paid ticket
    const existingPaid = await prisma.ticket.findFirst({
      where: { eventId: id as string, userId, status: 'paid' },
    });

    if (existingPaid) {
      return res.json({
        message: 'You already hold a ticket for this event',
        ticket: existingPaid,
        alreadyOwned: true,
      });
    }

    // If free event ($0), instantly issue paid ticket without Stripe
    if (event.priceCents === 0) {
      const ticket = await prisma.ticket.create({
        data: {
          eventId: id as string,
          userId,
          status: 'paid',
          amountCents: 0,
        },
      });
      return res.json({
        message: 'Free ticket registered successfully',
        ticket,
        isFree: true,
      });
    }

    // Create a pending ticket record
    const ticket = await prisma.ticket.create({
      data: {
        eventId: id as string,
        userId,
        status: 'pending',
        amountCents: event.priceCents,
      },
    });

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const successUrl = `${FRONTEND_URL}/events/${event.id}?payment=success&ticketId=${ticket.id}`;
    const cancelUrl = `${FRONTEND_URL}/events/${event.id}?payment=cancelled`;

    const session = await stripeService.createTicketCheckoutSession(
      userId,
      event.id,
      ticket.id,
      event.title,
      event.priceCents,
      successUrl,
      cancelUrl
    );

    // Update ticket with checkout session ID
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    return res.json({
      checkoutUrl: session.url,
      ticketId: ticket.id,
      sessionId: session.id,
    });
  } catch (error: any) {
    console.error('[Event] Ticket Checkout Error:', error);
    return res.status(500).json({ error: 'Failed to initiate ticket checkout' });
  }
};

/**
 * POST /api/v1/events/:id/start
 * Host goes live: strictly validates scheduled date/time condition (cannot go live before allowed prep buffer window),
 * creates or activates Session, creates Agora Chat Room, sets status = 'live', returns host RTC credentials.
 */
export const startEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const userEmail = await resolveUserEmail(userId, (req as any).user?.email);

    const event = await prisma.event.findUnique({
      where: { id: id as string },
      include: { session: true },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.facilitatorId !== userId) {
      return res.status(403).json({ error: 'Only the host can start this event' });
    }

    if (event.status === 'ended' || event.status === 'cancelled') {
      return res.status(400).json({
        error: 'Event has concluded',
        message: 'This event has already ended or been cancelled and cannot be started again.',
      });
    }

    // ── CIA Integrity & Schedule Check ──────────────────────────────────────
    const timing = getEventTimingStatus(event.startsAt);
    if (!timing.canStartLive) {
      const formattedStart = new Date(event.startsAt).toLocaleString();
      const formattedEarliest = new Date(timing.earliestStartMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return res.status(400).json({
        error: 'Event cannot be started before scheduled time',
        message: `This event is scheduled for ${formattedStart}. To maintain system integrity, hosts can only start the live room up to ${EARLY_START_BUFFER_MINUTES} minutes before scheduled start (from ${formattedEarliest}).`,
        startsAt: event.startsAt,
        earliestStartAt: timing.earliestStartAt,
      });
    }

    // ── Billing Package & Balance Check ────────────────────────────────────
    const isSuperOrAdmin = (req as any).user?.role === 'admin' || (req as any).user?.role === 'super_admin';
    if (!isSuperOrAdmin) {
      const hostUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!hostUser?.billingPackageId && (hostUser?.packageMinutesTotal || 0) === 0) {
        return res.status(403).json({
          error: 'Billing package selection required',
          requiresPackage: true,
          message: 'Please choose a host package from the billing marketplace before going live.',
        });
      }

      const remaining = Math.max(0, (hostUser?.packageMinutesTotal || 0) - (hostUser?.packageMinutesUsed || 0));
      if (remaining <= 0 && (!hostUser?.stripePaymentMethodId || !hostUser?.overageConsent)) {
        return res.status(402).json({
          error: 'Insufficient participant-minutes',
          requiresTopup: true,
          message: 'Your participant-minute balance is 0. Please top up your package or enable automatic overage protection to start this live stream.',
        });
      }
    }

    let session = event.session;

    if (!session) {
      const channelName = `e_${event.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}_${Date.now()}`;

      // Agora Chat setup
      const chatUsername = getChatUsername(userEmail);
      await agoraChatService.registerUser(chatUsername);
      const agoraChatRoomId = await agoraChatService.createChatRoom(event.title, chatUsername);

      session = await prisma.session.create({
        data: {
          title: event.title,
          channelName,
          facilitatorId: userId,
          status: 'active',
          startedAt: new Date(),
          agoraChatRoomId,
        },
      });

      await prisma.event.update({
        where: { id: id as string },
        data: {
          sessionId: session.id,
          status: 'live',
        },
      });
    } else {
      // Re-activate only if session is still in progress (not ended)
      // If the previous session is ended, create a fresh one for a re-run
      if (session.status === 'ended') {
        const channelName = `e_${event.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}_${Date.now()}`;
        const chatUsername = getChatUsername(userEmail);
        await agoraChatService.registerUser(chatUsername);
        const agoraChatRoomId = await agoraChatService.createChatRoom(event.title, chatUsername);

        session = await prisma.session.create({
          data: {
            title: event.title,
            channelName,
            facilitatorId: userId,
            status: 'active',
            startedAt: new Date(),
            agoraChatRoomId,
          },
        });

        await prisma.event.update({
          where: { id: id as string },
          data: { sessionId: session.id, status: 'live' },
        });
      } else if (session.status !== 'active') {
        // Scheduled -> activate without creating a duplicate
        session = await prisma.session.update({
          where: { id: session.id },
          data: { status: 'active', startedAt: session.startedAt || new Date() },
        });
        if (event.status !== 'live') {
          await prisma.event.update({
            where: { id: id as string },
            data: { status: 'live' },
          });
        }
      } else {
        // Already active — just ensure event is marked live
        if (event.status !== 'live') {
          await prisma.event.update({
            where: { id: id as string },
            data: { status: 'live' },
          });
        }
      }
    }

    // Start Agora Cloud Recording if configured
    if (session && !session.recordingSid) {
      const recordingUid = '999';
      const resourceId = await agoraRecordingService.acquireResource(session.channelName, recordingUid);
      if (resourceId) {
        const recordingToken = generateAgoraToken(session.channelName, 'recording_agent', 'publisher', 3600, 999);
        const startResult = await agoraRecordingService.startRecording(
          session.channelName,
          recordingUid,
          recordingToken.token,
          resourceId
        );
        if (startResult) {
          session = await prisma.session.update({
            where: { id: session.id },
            data: {
              recordingResourceId: resourceId,
              recordingSid: startResult.sid,
            },
          });
        }
      }
    }

    const tokenData = generateAgoraToken(session.channelName, userId, 'publisher');
    const chatUsername = getChatUsername(userEmail);
    await agoraChatService.registerUser(chatUsername);
    const chatToken = agoraChatService.generateUserToken(chatUsername);

    return res.json({
      event: { ...event, status: 'live', sessionId: session.id, canStartLive: true, earliestStartAt: timing.earliestStartAt },
      session,
      agoraToken: tokenData.token,
      expiresAt: tokenData.expiresAt,
      uid: tokenData.uid,
      chatToken,
      chatUsername,
      agoraChatRoomId: session.agoraChatRoomId,
      isHost: true,
      hasTicket: true,
    });
  } catch (error: any) {
    console.error('[Event] Start Event Error:', error);
    return res.status(500).json({ error: 'Failed to start event live session' });
  }
};

/**
 * POST /api/v1/events/:id/join
 * Server-authoritative entitlement & schedule check:
 * - Host? -> Allowed (publisher) within start window
 * - Paid ticket holder? -> Allowed (subscriber/attendee) when event is live
 * - Otherwise -> 403 Forbidden
 */
export const joinEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user?.role || 'user';
    const userEmail = await resolveUserEmail(userId, (req as any).user?.email);

    const event = await prisma.event.findUnique({
      where: { id: id as string },
      include: { session: true },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const isHost = event.facilitatorId === userId || userRole === 'admin' || userRole === 'super_admin';

    // Entitlement Check:
    let hasTicket = isHost;
    let ticket = null;

    if (!isHost) {
      ticket = await prisma.ticket.findFirst({
        where: { eventId: id as string, userId, status: 'paid' },
      });
      hasTicket = !!ticket;
    }

    if (!hasTicket) {
      return res.status(403).json({
        error: 'Ticket required',
        message: 'You must purchase a paid ticket to join this live event.',
        eventId: event.id,
      });
    }

    // Check event status
    if (event.status === 'draft') {
      return res.status(400).json({ error: 'This event is still in draft mode.' });
    }

    if (event.status === 'ended' || event.status === 'cancelled') {
      return res.status(400).json({
        error: 'Event has ended',
        message: 'This event has concluded and is no longer accessible. Nobody can enter or restart an ended event.',
      });
    }

    // If event is scheduled / published but not live yet:
    if (event.status === 'published' && !event.sessionId) {
      const timing = getEventTimingStatus(event.startsAt);

      if (isHost) {
        // If host tries to join before earliest start window, do NOT auto-start prematurely
        if (!timing.canStartLive) {
          return res.status(200).json({
            event: {
              ...event,
              canStartLive: false,
              earliestStartAt: timing.earliestStartAt,
            },
            isHost: true,
            hasTicket: true,
            status: 'scheduled',
            startsAt: event.startsAt,
            earliestStartAt: timing.earliestStartAt,
            message: `Event is scheduled for ${new Date(event.startsAt).toLocaleString()}. You can start the live broadcast starting ${EARLY_START_BUFFER_MINUTES} minutes before scheduled start time.`,
          });
        }
        // If within the allowed window, host auto-starts the live stream
        return startEvent(req, res);
      } else {
        return res.status(200).json({
          event: {
            ...event,
            canStartLive: timing.canStartLive,
            earliestStartAt: timing.earliestStartAt,
          },
          isHost: false,
          hasTicket: true,
          status: 'scheduled',
          startsAt: event.startsAt,
          earliestStartAt: timing.earliestStartAt,
          message: 'Your ticket is confirmed! The live room is waiting for the host to go live.',
        });
      }
    }

    const session = event.session;
    if (!session) {
      return res.status(500).json({ error: 'Live session not initialized for this event' });
    }

    // CIA Access Control: Host is publisher; attendee publisher/subscriber based on room
    const agoraRole = isHost ? 'publisher' : 'publisher';
    const tokenData = generateAgoraToken(session.channelName, userId, agoraRole);

    // Agora Chat Credentials
    const chatUsername = getChatUsername(userEmail);
    await agoraChatService.registerUser(chatUsername);
    const chatToken = agoraChatService.generateUserToken(chatUsername);

    return res.json({
      event,
      session,
      isHost,
      hasTicket: true,
      role: userRole,
      agoraToken: tokenData.token,
      expiresAt: tokenData.expiresAt,
      uid: tokenData.uid,
      chatToken,
      chatUsername,
      agoraChatRoomId: session.agoraChatRoomId,
    });
  } catch (error: any) {
    console.error('[Event] Join Error:', error);
    return res.status(500).json({ error: 'Failed to join live event' });
  }
};

/**
 * POST /api/v1/events/:id/end
 * Host ends live event: marks event as ended, stops recording, and ends live session.
 */
export const endEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const event = await prisma.event.findUnique({
      where: { id: id as string },
      include: { session: true },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.facilitatorId !== userId) {
      return res.status(403).json({ error: 'Only the host can end this event' });
    }

    if (event.status === 'ended') {
      return res.status(400).json({ error: 'Event already ended' });
    }

    let recordingUrl = event.session?.recordingUrl;

    // Stop Agora Cloud Recording if session exists
    if (event.session && event.session.recordingResourceId && event.session.recordingSid) {
      const stopResult = await agoraRecordingService.stopRecording(
        event.session.channelName,
        '999',
        event.session.recordingResourceId,
        event.session.recordingSid
      );
      if (stopResult) {
        recordingUrl = stopResult;
      }
    }

    const endedAt = new Date();

    if (event.session) {
      const startedAt = event.session.startedAt || event.session.createdAt;
      const durationMs = endedAt.getTime() - startedAt.getTime();
      // Use Math.round so analytics totalMinutes matches billing deduction math
      const totalMinutes = Math.round(durationMs / 60000);

      await prisma.session.update({
        where: { id: event.session.id },
        data: {
          status: 'ended',
          endedAt,
          totalMinutes,
          recordingUrl,
        },
      });
    }

    const updatedEvent = await prisma.event.update({
      where: { id: id as string },
      data: { status: 'ended' },
      include: {
        session: true,
        facilitator: { select: { id: true, email: true, companyName: true } },
      },
    });

    return res.json({
      message: 'Event ended successfully',
      event: updatedEvent,
    });
  } catch (error: any) {
    console.error('[Event] End Event Error:', error);
    return res.status(500).json({ error: 'Failed to end event' });
  }
};

/**
 * PUT /api/v1/events/:id
 * Host updates an event's details.
 */
export const updateEvent = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).user.userId;
    const updateData = req.body;

    const event = await prisma.event.findUnique({
      where: { id },
      include: { facilitator: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    const userRole = currentUser?.role || 'user';
    const isOwner = event.facilitatorId === userId;
    const isSameCompany = currentUser?.companyName && event.facilitator?.companyName === currentUser.companyName;
    const isAuthorized = isOwner || (['host', 'admin', 'moderator'].includes(userRole) && isSameCompany);

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the host or company administrators can update this event' });
    }

    if (['live', 'ended', 'cancelled'].includes(event.status)) {
      return res.status(400).json({ error: 'Cannot edit an event that is live, ended, or cancelled' });
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        title: updateData.title !== undefined ? updateData.title : event.title,
        description: updateData.description !== undefined ? updateData.description : event.description,
        startsAt: updateData.startsAt ? new Date(updateData.startsAt) : event.startsAt,
        priceCents: updateData.priceCents !== undefined ? updateData.priceCents : event.priceCents,
        capacity: updateData.capacity !== undefined ? updateData.capacity : event.capacity,
      },
    });

    return res.json(updatedEvent);
  } catch (error: any) {
    console.error('[Event] Update Event Error:', error);
    return res.status(500).json({ error: 'Failed to update event' });
  }
};

/**
 * DELETE /api/v1/events/:id
 * Host deletes or cancels an event.
 */
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).user.userId;

    const event = await prisma.event.findUnique({
      where: { id },
      include: { tickets: true, facilitator: true },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    const userRole = currentUser?.role || 'user';
    const isOwner = event.facilitatorId === userId;
    const isSameCompany = currentUser?.companyName && event.facilitator?.companyName === currentUser.companyName;
    const isAuthorized = isOwner || (['host', 'admin', 'moderator'].includes(userRole) && isSameCompany);

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the host or company administrators can delete this event' });
    }

    if (['live', 'ended'].includes(event.status)) {
      return res.status(400).json({ error: 'Cannot delete a live or ended event' });
    }

    const paidTickets = (event.tickets || []).filter((t: any) => t.status === 'paid');

    if (paidTickets.length > 0) {
      // If there are paid tickets, we cannot hard-delete. We must soft-delete/cancel.
      const updatedEvent = await prisma.event.update({
        where: { id },
        data: { status: 'cancelled' },
      });
      return res.json({ message: 'Event cancelled. (Has paid tickets that require refunds)', event: updatedEvent });
    } else {
      // Hard delete if no paid tickets
      await prisma.ticket.deleteMany({ where: { eventId: id } });
      if (event.sessionId) {
        await prisma.event.update({ where: { id }, data: { sessionId: null } });
        await prisma.session.delete({ where: { id: event.sessionId } });
      }
      await prisma.event.delete({ where: { id } });
      return res.json({ message: 'Event successfully deleted' });
    }
  } catch (error: any) {
    console.error('[Event] Delete Event Error:', error);
    return res.status(500).json({ error: 'Failed to delete event' });
  }
};

/**
 * GET /api/v1/events/analytics/host
 * Retrieves deep host performance analytics, revenue breakdown, and attendance rates.
 */
export const getHostAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    let facilitatorIds = [userId];

    if (currentUser?.companyName) {
      const companyUsers = await prisma.user.findMany({
        where: { companyName: currentUser.companyName },
        select: { id: true },
      });
      facilitatorIds = companyUsers.map(u => u.id);
    }

    // Fetch all events for this host
    const events = await prisma.event.findMany({
      where: { facilitatorId: { in: facilitatorIds } },
      include: {
        session: { select: { totalMinutes: true, status: true } },
        tickets: {
          where: { status: 'paid' },
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { startsAt: 'desc' },
    });

    // Fetch ALL sessions for this host (both standalone studio sessions & event streams)
    const allHostSessions = await prisma.session.findMany({
      where: { facilitatorId: { in: facilitatorIds } },
      select: { totalMinutes: true, status: true, startedAt: true, endedAt: true },
    });

    let totalRevenueCents = 0;
    let totalTicketsSold = 0;
    let activeLiveEventsCount = 0;
    let upcomingEventsCount = 0;
    let completedEventsCount = 0;

    // Calculate total live broadcast minutes across all sessions
    let totalBroadcastMinutes = 0;
    for (const sess of allHostSessions) {
      if (sess.totalMinutes && sess.totalMinutes > 0) {
        totalBroadcastMinutes += sess.totalMinutes;
      }
    }

    let fillRateSum = 0;
    let fillRateCount = 0;

    const allRecentSales: any[] = [];

    const eventsBreakdown = events.map((ev) => {
      const paidTickets = ev.tickets || [];
      const eventRevenue = paidTickets.reduce((sum, t) => sum + (t.amountCents || 0), 0);
      const ticketsCount = paidTickets.length;

      totalRevenueCents += eventRevenue;
      totalTicketsSold += ticketsCount;

      if (ev.status === 'live') activeLiveEventsCount++;
      else if (ev.status === 'published') upcomingEventsCount++;
      else if (ev.status === 'ended') completedEventsCount++;

      let fillRatePercent = 0;
      if (ev.capacity && ev.capacity > 0) {
        fillRatePercent = Math.min(100, Math.round((ticketsCount / ev.capacity) * 100));
        fillRateSum += fillRatePercent;
        fillRateCount++;
      }

      paidTickets.forEach((t) => {
        allRecentSales.push({
          ticketId: t.id,
          eventId: ev.id,
          eventTitle: ev.title,
          buyerName: t.user?.name || t.user?.email?.split('@')[0] || 'Attendee',
          buyerEmail: t.user?.email || 'attendee@example.com',
          amountCents: t.amountCents,
          purchasedAt: t.createdAt.toISOString(),
        });
      });

      return {
        id: ev.id,
        title: ev.title,
        startsAt: ev.startsAt.toISOString(),
        status: ev.status as any,
        priceCents: ev.priceCents,
        capacity: ev.capacity,
        paidTicketsCount: ticketsCount,
        totalRevenueCents: eventRevenue,
        fillRatePercent,
      };
    });

    allRecentSales.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
    const recentSales = allRecentSales.slice(0, 25);

    const averageTicketPriceCents = totalTicketsSold > 0
      ? Math.round(totalRevenueCents / totalTicketsSold)
      : 0;

    const averageFillRatePercent = fillRateCount > 0
      ? Math.round(fillRateSum / fillRateCount)
      : 0;

    // Fetch live package status and wallet balance
    let packageStatusData: any = null;
    let walletBalance = 0;
    try {
      packageStatusData = await packageService.getUserPackageStatus(userId);
      const wallet = await billingService.getWalletBalance(userId);
      walletBalance = wallet.balance;
    } catch (e) {
      // Non-fatal
    }

    return res.json({
      totalRevenueCents,
      totalTicketsSold,
      totalEventsHosted: events.length,
      activeLiveEventsCount,
      upcomingEventsCount,
      completedEventsCount,
      averageTicketPriceCents,
      averageFillRatePercent,
      totalBroadcastMinutes,
      packageMinutesTotal: packageStatusData?.packageMinutesTotal || 0,
      packageMinutesUsed: packageStatusData?.packageMinutesUsed || 0,
      packageMinutesRemaining: packageStatusData?.packageMinutesRemaining || 0,
      packageName: packageStatusData?.package?.name || (packageStatusData?.hasPackage ? 'Host Plan' : 'Free Tier'),
      walletBalance,
      eventsBreakdown,
      recentSales,
    });
  } catch (error: any) {
    console.error('[Event] Host Analytics Error:', error);
    return res.status(500).json({ error: 'Failed to fetch host analytics', details: error.message });
  }
};
