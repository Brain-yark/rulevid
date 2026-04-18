import { Request, Response } from 'express';
import { prisma } from '../db';
import { generateAgoraToken } from '../services/agoraTokenService';

export const createSession = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const sessionId = Math.random().toString(36).substring(2, 10);
    const channelName = `f_${userId}_${sessionId}_${Date.now()}`;

    const tokenData = generateAgoraToken(channelName, userId, 'publisher');

    const session = await prisma.session.create({
      data: {
        title,
        channelName,
        facilitatorId: userId,
        status: 'scheduled',
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
    const sessions = await prisma.session.findMany({
      where: { facilitatorId: userId },
      orderBy: { createdAt: 'desc' }
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
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const tokenData = generateAgoraToken(session.channelName, userId, 'publisher');

    // Update status to active if joining
    if (session.status === 'scheduled') {
      await prisma.session.update({
        where: { id },
        data: { status: 'active', startedAt: new Date() }
      });
    }

    return res.json({
      session,
      agoraToken: tokenData.token,
      expiresAt: tokenData.expiresAt,
      uid: tokenData.uid
    });
  } catch (error) {
    console.error('Join Session Error:', error);
    return res.status(500).json({ error: 'Failed to join session' });
  }
};
