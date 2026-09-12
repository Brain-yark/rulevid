import { Server, Socket } from 'socket.io';
import { prisma } from '../db';
import { logger } from '../logger';

export interface SessionParticipant {
  socketId: string;
  userId?: string;
  name: string;
  email?: string;
  role: string;
  agoraUid?: number;
  isHost: boolean;
  handRaised?: boolean;
  canSpeak?: boolean;
  joinedAt: string;
}

export class SocketService {
  private io: Server;
  // Map of sessionId -> (Map of socketId -> SessionParticipant)
  private sessionParticipants: Map<string, Map<string, SessionParticipant>> = new Map();
  // Set of sessionIds currently having active screen share
  private activeScreenShares: Set<string> = new Set();

  constructor(io: Server) {
    this.io = io;
    this.setupListeners();
  }

  private setupListeners() {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`[Socket] New connection: ${socket.id}`);

      // Host/User private room registration for personalized alerts
      socket.on('register_user', (userId: string) => {
        if (userId) {
          socket.join(`user:${userId}`);
          socket.join(`host:${userId}`);
          logger.info(`[Socket] Socket ${socket.id} joined rooms user:${userId} and host:${userId}`);
        }
      });

      // Join global events lobby to receive real-time event status updates (live/ended/published)
      socket.on('join_events_lobby', () => {
        socket.join('events_lobby');
      });

      // Watch a specific event for real-time status changes (used on EventDetailsPage)
      socket.on('watch_event', (eventId: string) => {
        if (eventId) {
          socket.join(`event:${eventId}`);
        }
      });

      socket.on('unwatch_event', (eventId: string) => {
        if (eventId) {
          socket.leave(`event:${eventId}`);
        }
      });

      // Join session with optional rich user profile metadata
      socket.on('join_session', (payload: string | { sessionId: string; user?: any }) => {
        const sessionId = typeof payload === 'string' ? payload : payload?.sessionId;
        const userData = typeof payload === 'object' ? payload?.user : null;

        if (!sessionId) return;

        socket.join(sessionId);
        logger.info(`[Socket] Socket ${socket.id} joined session ${sessionId}`);

        // Register participant profile
        if (!this.sessionParticipants.has(sessionId)) {
          this.sessionParticipants.set(sessionId, new Map());
        }

        const participantsMap = this.sessionParticipants.get(sessionId)!;
        const isHost = userData?.role === 'host' || userData?.isHost === true;
        const displayName = userData?.name?.trim() ||
          (isHost ? 'Host' : (userData?.email ? userData.email.split('@')[0] : `Guest_${socket.id.substring(0, 5)}`));

        participantsMap.set(socket.id, {
          socketId: socket.id,
          userId: userData?.id || userData?.userId,
          name: displayName,
          email: userData?.email,
          role: isHost ? 'host' : 'attendee',
          agoraUid: userData?.agoraUid ? Number(userData.agoraUid) : undefined,
          isHost,
          handRaised: false,
          canSpeak: isHost, // Host can always speak; attendees need permission
          joinedAt: new Date().toISOString(),
        });

        this.broadcastParticipantCount(sessionId);
        this.broadcastParticipants(sessionId);
        this.syncSessionParticipantCount(sessionId, this.getAudienceCount(sessionId));

        // If this session currently has an active screen share, notify the newcomer immediately
        if (this.activeScreenShares.has(sessionId)) {
          socket.emit('host_screen_share_started');
        }
      });

      // Leave session
      socket.on('leave_session', (sessionId: string) => {
        socket.leave(sessionId);
        this.removeParticipant(sessionId, socket.id);
        this.broadcastParticipantCount(sessionId);
        this.broadcastParticipants(sessionId);
      });

      // Screen Share: relay host sharing state to all participants
      socket.on('host_screen_share_started', (data: { sessionId: string }) => {
        if (data?.sessionId) {
          this.activeScreenShares.add(data.sessionId);
          this.io.to(data.sessionId).emit('host_screen_share_started');
        }
      });

      socket.on('host_screen_share_stopped', (data: { sessionId: string }) => {
        if (data?.sessionId) {
          this.activeScreenShares.delete(data.sessionId);
          this.io.to(data.sessionId).emit('host_screen_share_stopped');
        }
      });

      // Hand Raising: Attendee requests to speak
      socket.on('raise_hand', (data: { sessionId: string; userId?: string; name?: string }) => {
        const { sessionId } = data;
        const participantsMap = this.sessionParticipants.get(sessionId);
        if (participantsMap && participantsMap.has(socket.id)) {
          const participant = participantsMap.get(socket.id)!;
          participant.handRaised = true;
          this.broadcastParticipants(sessionId);
          this.io.to(sessionId).emit('hand_raised', {
            socketId: socket.id,
            userId: participant.userId,
            name: participant.name,
            agoraUid: participant.agoraUid,
          });
        }
      });

      // Hand Lowering: Cancel request to speak
      socket.on('lower_hand', (data: { sessionId: string; userId?: string }) => {
        const { sessionId } = data;
        const participantsMap = this.sessionParticipants.get(sessionId);
        if (participantsMap && participantsMap.has(socket.id)) {
          const participant = participantsMap.get(socket.id)!;
          participant.handRaised = false;
          this.broadcastParticipants(sessionId);
          this.io.to(sessionId).emit('hand_lowered', {
            socketId: socket.id,
            userId: participant.userId,
          });
        }
      });

      // Host Moderation: Grant permission to speak
      socket.on('grant_speak_permission', (data: { sessionId: string; targetSocketId?: string; targetUserId?: string }) => {
        const { sessionId, targetSocketId, targetUserId } = data;
        const participantsMap = this.sessionParticipants.get(sessionId);
        if (!participantsMap) return;

        for (const [sId, participant] of participantsMap.entries()) {
          if ((targetSocketId && sId === targetSocketId) || (targetUserId && participant.userId === targetUserId)) {
            participant.canSpeak = true;
            participant.handRaised = false;
            // Notify target specifically
            this.io.to(sId).emit('speak_permission_granted', { sessionId });
            break;
          }
        }
        this.broadcastParticipants(sessionId);
      });

      // Host Moderation: Revoke permission to speak (mute attendee)
      socket.on('revoke_speak_permission', (data: { sessionId: string; targetSocketId?: string; targetUserId?: string }) => {
        const { sessionId, targetSocketId, targetUserId } = data;
        const participantsMap = this.sessionParticipants.get(sessionId);
        if (!participantsMap) return;

        for (const [sId, participant] of participantsMap.entries()) {
          if ((targetSocketId && sId === targetSocketId) || (targetUserId && participant.userId === targetUserId)) {
            participant.canSpeak = false;
            // Notify target to mute local mic
            this.io.to(sId).emit('speak_permission_revoked', { sessionId });
            break;
          }
        }
        this.broadcastParticipants(sessionId);
      });

      // Real-time Session Chat
      socket.on('send_message', (data: { sessionId: string; user?: string; senderId?: string; role?: string; text: string; localId?: string }) => {
        if (!data || !data.sessionId || !data.text?.trim()) return;
        const participantsMap = this.sessionParticipants.get(data.sessionId);
        const participant = participantsMap?.get(socket.id);
        const senderName = data.user || participant?.name || 'Participant';
        const msgId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        // Broadcast to ALL sockets in the room (server-generated id)
        // The sender's own socket will receive this too, but the client skips it
        // because isSelf=true messages are now filtered out on the receiving end.
        this.io.to(data.sessionId).emit('message_received', {
          id: msgId,
          localId: data.localId, // Echo back so sender can deduplicate if needed
          sessionId: data.sessionId,
          user: senderName,
          senderId: data.senderId || participant?.userId || socket.id,
          senderSocketId: socket.id, // Include socket id for self-detection
          role: data.role || participant?.role || 'attendee',
          text: data.text.trim(),
          timestamp: new Date().toISOString(),
        });
      });

      socket.on('disconnecting', () => {
        socket.rooms.forEach((room) => {
          if (room !== socket.id) {
            this.removeParticipant(room, socket.id);
            setTimeout(() => {
              this.broadcastParticipantCount(room);
              this.broadcastParticipants(room);
            }, 100);
          }
        });
      });

      socket.on('disconnect', () => {
        logger.info(`[Socket] Disconnected: ${socket.id}`);
      });
    });
  }

  private removeParticipant(sessionId: string, socketId: string) {
    const participantsMap = this.sessionParticipants.get(sessionId);
    if (participantsMap) {
      participantsMap.delete(socketId);
      if (participantsMap.size === 0) {
        this.sessionParticipants.delete(sessionId);
      }
    }
  }

  /**
   * Broadcast real-time participant count to session viewers.
   */
  public broadcastParticipantCount(sessionId: string) {
    const count = this.getAudienceCount(sessionId);
    this.io.to(sessionId).emit('count_updated', { count });
  }

  /**
   * Broadcast rich list of participants (with names, roles, speaking flags).
   */
  public broadcastParticipants(sessionId: string) {
    const participantsMap = this.sessionParticipants.get(sessionId);
    const participants = participantsMap ? Array.from(participantsMap.values()) : [];
    this.io.to(sessionId).emit('participants_updated', participants);
  }

  /**
   * Get active participant / audience count in a session room.
   */
  public getAudienceCount(sessionId: string): number {
    return this.io.sockets.adapter.rooms.get(sessionId)?.size || 0;
  }

  /**
   * Emit a targeted alert to a specific host (e.g. Low Balance Warning, Overage receipt).
   */
  public emitToHost(hostId: string, event: string, data: any) {
    this.io.to(`host:${hostId}`).emit(event, data);
  }

  /**
   * Emit an alert to a specific user.
   */
  public emitToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit an event to all participants in a session (e.g. Grace Period countdown, Stream Ending).
   */
  public emitToSession(sessionId: string, event: string, data: any) {
    this.io.to(sessionId).emit(event, data);
  }

  /**
   * Broadcast stream_ended to all participants in a session so their browsers
   * cleanly unmount Agora tracks, stop sending/receiving RTC packets, and leave the room.
   */
  public broadcastStreamEnded(sessionId: string, message: string = 'This live session has concluded.') {
    this.io.to(sessionId).emit('stream_ended', { sessionId, message });
    this.io.to(sessionId).emit('billing:stream_ending', { sessionId, message });
    logger.info({ sessionId }, '[SocketService] Broadcasted stream_ended to session participants');
  }

  /**
   * Broadcast an event status change (e.g. published -> live -> ended) to all connected clients
   * watching that event, so they can update their UI without a page reload.
   */
  public broadcastEventStatusChange(eventId: string, status: string, sessionId?: string) {
    // Broadcast to the global events room (all logged-in clients watching the events list)
    this.io.to('events_lobby').emit('event_status_changed', { eventId, status, sessionId });
    // Also broadcast directly to the event-specific watch room
    this.io.to(`event:${eventId}`).emit('event_status_changed', { eventId, status, sessionId });
    logger.info({ eventId, status }, '[SocketService] Broadcasted event_status_changed');
  }

  /**
   * Persists peak audience size to the database for reliable billing & analytics.
   */
  public async syncSessionParticipantCount(sessionId: string, count: number) {
    if (!sessionId || count <= 0) return;
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { participantCount: true },
      });
      if (session && count > session.participantCount) {
        await prisma.session.update({
          where: { id: sessionId },
          data: { participantCount: count },
        });
      }
    } catch (e: any) {
      // Non-fatal
    }
  }
}

export let socketService: SocketService;

export const initSocketService = (io: Server) => {
  socketService = new SocketService(io);
  return socketService;
};

