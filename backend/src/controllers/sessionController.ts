import { Request, Response } from 'express';
import { prisma } from '../db';
import { generateAgoraToken, refreshAgoraToken } from '../services/agoraTokenService';
import { agoraRecordingService } from '../services/agoraRecordingService';
import { agoraChatService } from '../services/agoraChatService';

/**
 * Sanitizes an email into a valid Agora Chat username.
 * e.g., user@example.com -> user_example_com
 */
const getChatUsername = (email: string) => {
  return email.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
};

export const createSession = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    let userEmail = (req as any).user.email;
    const { title } = req.body;

    if (!userEmail) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      userEmail = user?.email;
    }

    if (!userEmail) {
      return res.status(401).json({ error: 'User email not found' });
    }

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const sessionId = Math.random().toString(36).substring(2, 10);
    const channelName = `f_${userId}_${sessionId}_${Date.now()}`;

    const tokenData = generateAgoraToken(channelName, userId, 'publisher');

    // ─── Agora Chat Room Creation ───────────────────────────────────────────
    const chatUsername = getChatUsername(userEmail);
    await agoraChatService.registerUser(chatUsername);
    const agoraChatRoomId = await agoraChatService.createChatRoom(title, chatUsername);

    const session = await prisma.session.create({
      data: {
        title,
        channelName,
        facilitatorId: userId,
        status: 'scheduled',
        agoraChatRoomId,
      },
    });

    return res.status(201).json({
      session,
      agoraToken: tokenData.token,
      expiresAt: tokenData.expiresAt,
      uid: tokenData.uid
    });
  } catch (error) {
    console.error('Session Creation Error:', error);
    return res.status(500).json({ error: 'Failed to create session' });
  }
};

export const getSessions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user?.role || 'user';
    const { search, status, excludeStatus, view } = req.query;

    const whereClause: any = {};

    if (view === 'all' || view === 'active' || userRole === 'user') {
      // Public / attendee view: return active live sessions
      whereClause.status = status ? (status as string) : 'active';
    } else {
      // Host personal studio view: returns their own sessions
      whereClause.facilitatorId = userId;
      if (status) {
        whereClause.status = status as string;
      } else if (excludeStatus) {
        whereClause.status = { not: excludeStatus as string };
      }
    }

    if (search) {
      whereClause.title = { contains: search as string, mode: 'insensitive' };
    }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      include: {
        facilitator: {
          select: { id: true, email: true, name: true, companyName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(sessions);
  } catch (error) {
    console.error('Fetch Sessions Error:', error);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

export const joinSession = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const userEmail = (req as any).user.email;
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id: id as string }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'ended') {
      return res.status(400).json({
        error: 'Session has ended',
        message: 'This session has concluded and cannot be entered or restarted.'
      });
    }

    const tokenData = generateAgoraToken(session.channelName, userId, 'publisher');

    // ─── Agora Chat Integration ─────────────────────────────────────────────
    const chatUsername = getChatUsername(userEmail);
    await agoraChatService.registerUser(chatUsername);
    const chatToken = agoraChatService.generateUserToken(chatUsername);

    // Update status to active if joining
    if (session.status === 'scheduled') {
      await prisma.session.update({
        where: { id: id as string },
        data: { status: 'active', startedAt: new Date() }
      });

      // ─── Start Agora Cloud Recording ───────────────────────────────────────
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
          await prisma.session.update({
            where: { id: id as string },
            data: { 
              recordingResourceId: resourceId,
              recordingSid: startResult.sid
            }
          });
        }
      }
    }

    return res.json({
      session,
      agoraToken: tokenData.token,
      expiresAt: tokenData.expiresAt,
      uid: tokenData.uid,
      chatToken,
      chatUsername,
      agoraChatRoomId: session.agoraChatRoomId
    });
  } catch (error) {
    console.error('Join Session Error:', error);
    return res.status(500).json({ error: 'Failed to join session' });
  }
};

export const endSession = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id: id as string }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.facilitatorId !== userId) {
      return res.status(403).json({ error: 'Only the facilitator can end this session' });
    }

    if (session.status === 'ended') {
      return res.status(400).json({ error: 'Session already ended' });
    }

    // ─── Stop Agora Cloud Recording ─────────────────────────────────────────
    let recordingUrl = session.recordingUrl;
    if (session.recordingResourceId && session.recordingSid) {
      const stopResult = await agoraRecordingService.stopRecording(
        session.channelName,
        '999',
        session.recordingResourceId,
        session.recordingSid
      );
      if (stopResult) {
        recordingUrl = stopResult;
      }
    }

    const endedAt = new Date();
    const startedAt = session.startedAt || session.createdAt;
    const durationMs = endedAt.getTime() - startedAt.getTime();
    // Use Math.round so analytics totalMinutes matches billing deduction math
    const totalMinutes = Math.round(durationMs / 60000);

    const updatedSession = await prisma.session.update({
      where: { id: id as string },
      data: {
        status: 'ended',
        endedAt,
        totalMinutes,
        recordingUrl
      }
    });

    return res.json(updatedSession);
  } catch (error) {
    console.error('End Session Error:', error);
    return res.status(500).json({ error: 'Failed to end session' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id: id as string }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'ended') {
      return res.status(400).json({ error: 'Cannot refresh token for an ended session' });
    }

    const tokenData = refreshAgoraToken(session.channelName, userId);

    return res.json({
      agoraToken: tokenData.token,
      expiresAt: tokenData.expiresAt,
      uid: tokenData.uid,
    });
  } catch (error) {
    console.error('Token Refresh Error:', error);
    return res.status(500).json({ error: 'Failed to refresh token' });
  }
};
