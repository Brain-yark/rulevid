import { Server, Socket } from 'socket.io';
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
      });

      // Leave session
      socket.on('leave_session', (sessionId: string) => {
        socket.leave(sessionId);
        this.removeParticipant(sessionId, socket.id);
        this.broadcastParticipantCount(sessionId);
        this.broadcastParticipants(sessionId);
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

      // Text Chat fallback
      socket.on('send_message', (data: { sessionId: string; user: string; text: string }) => {
        this.io.to(data.sessionId).emit('message_received', {
          id: Date.now(),
          user: data.user,
          text: data.text,
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
}

export let socketService: SocketService;

export const initSocketService = (io: Server) => {
  socketService = new SocketService(io);
  return socketService;
};

