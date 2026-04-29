import { Server, Socket } from 'socket.io';

export class SocketService {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    this.setupListeners();
  }

  private setupListeners() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`[Socket] New connection: ${socket.id}`);

      socket.on('join_session', (sessionId: string) => {
        socket.join(sessionId);
        console.log(`[Socket] Socket ${socket.id} joined session ${sessionId}`);
        this.broadcastParticipantCount(sessionId);
      });

      socket.on('send_message', (data: { sessionId: string; user: string; text: string }) => {
        console.log(`[Socket] Message from ${data.user} in ${data.sessionId}: ${data.text}`);
        this.io.to(data.sessionId).emit('message_received', {
          id: Date.now(),
          user: data.user,
          text: data.text,
          timestamp: new Date().toISOString(),
        });
      });

      socket.on('disconnecting', () => {
        // Broadcast participant count update before the socket actually leaves the rooms
        socket.rooms.forEach((room) => {
          if (room !== socket.id) {
            // Give a tiny offset to calculate count after disconnect
            setTimeout(() => this.broadcastParticipantCount(room), 100);
          }
        });
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] Disconnected: ${socket.id}`);
      });
    });
  }

  private broadcastParticipantCount(sessionId: string) {
    const count = this.io.sockets.adapter.rooms.get(sessionId)?.size || 0;
    console.log(`[Socket] Session ${sessionId} participant count: ${count}`);
    this.io.to(sessionId).emit('count_updated', { count });
  }
}

export let socketService: SocketService;

export const initSocketService = (io: Server) => {
  socketService = new SocketService(io);
  return socketService;
};
