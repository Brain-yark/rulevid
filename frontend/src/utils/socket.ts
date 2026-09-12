import { io, Socket } from 'socket.io-client';
import { API_BASE } from '../config';

let globalSocket: Socket | null = null;

/**
 * Returns a shared, persistent Socket.io client instance for real-time updates across pages.
 * Handles automatic user room registration upon connection/reconnection.
 */
export const getGlobalSocket = (): Socket => {
  if (!globalSocket) {
    globalSocket = io(API_BASE || undefined, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    const registerUser = () => {
      try {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (storedUser?.id) {
          globalSocket?.emit('register_user', storedUser.id);
        }
      } catch {
        // Non-fatal
      }
    };

    globalSocket.on('connect', () => {
      registerUser();
    });

    // Also attempt registration immediately if already connected
    if (globalSocket.connected) {
      registerUser();
    }
  } else if (globalSocket.disconnected) {
    globalSocket.connect();
  }

  return globalSocket;
};

/**
 * Disconnects the global socket instance.
 */
export const disconnectGlobalSocket = () => {
  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
  }
};
