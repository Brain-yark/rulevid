export interface User {
  id: string;
  email: string;
  companyName?: string;
}

export interface Session {
  id: string;
  title: string;
  channelName: string;
  status: 'active' | 'scheduled' | 'ended';
  startedAt?: Date;
  participantCount: number;
}

export interface AgoraTokenResponse {
  token: string;
  channelName: string;
  uid: string;
  expiresAt: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}
