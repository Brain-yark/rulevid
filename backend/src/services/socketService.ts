import { Server, Socket } from 'socket.io';
import { logger } from '../logger';

export class SocketService {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    this.setupListeners();
  }

  private setupListeners() {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`[Socket] New connection: ${socket.id}`);

      // Host/User private room registration for personalized alerts (e.g. low balance warnings)
      socket.on('register_user', (userId: string) => {
        if (userId) {
          socket.join(`user:${userId}`);
          socket.join(`host:${userId}`);
          logger.info(`[Socket] Socket ${socket.id} joined rooms user:${userId} and host:${userId}`);
        }
      });

      socket.on('join_session', (sessionId: string) => {
        socket.join(sessionId);
        logger.info(`[Socket] Socket ${socket.id} joined session ${sessionId}`);
        this.broadcastParticipantCount(sessionId);
      });

      socket.on('leave_session', (sessionId: string) => {
        socket.leave(sessionId);
        this.broadcastParticipantCount(sessionId);
      });

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
            setTimeout(() => this.broadcastParticipantCount(room), 100);
          }
        });
      });

      socket.on('disconnect', () => {
        logger.info(`[Socket] Disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Broadcast real-time participant count to session viewers.
   */
  public broadcastParticipantCount(sessionId: string) {
    const count = this.getAudienceCount(sessionId);
    this.io.to(sessionId).emit('count_updated', { count });
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

