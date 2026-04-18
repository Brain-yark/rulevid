export interface User {
  id: string;
  email: string;
  companyName?: string;
  pricingTier: string;
  status: string;
  walletId?: string;
}

export interface Session {
  id: string;
  title: string;
  channelName: string;
  status: 'active' | 'scheduled' | 'ended';
  startedAt?: Date;
  endedAt?: Date;
  participantCount: number;
  totalMinutes: number;
  recordingUrl?: string;
  facilitatorId: string;
}

export interface AgoraTokenResponse {
  token: string;
  channelName: string;
  uid: number; // Changed to number to match backend service
  expiresAt: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Transaction {
  id: string;
  type: 'topup' | 'deduction';
  amount: number;
  currency: string;
  balanceAfter: number;
  description?: string;
  status: string;
  createdAt: string;
}
