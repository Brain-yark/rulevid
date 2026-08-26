export type UserRole = 'user' | 'host' | 'moderator' | 'admin' | 'super_admin';

export interface User {
  id: string;
  email: string;
  name?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  websiteUrl?: string;
  role: UserRole;
  emailVerified?: boolean;
  lastLoginAt?: string;
  companyName?: string;
  pricingTier: string;
  status: string;
  walletId?: string;
  createdAt?: string;
}

export interface UserProfileUpdateRequest {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  websiteUrl?: string;
  companyName?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface HostAnalyticsEventItem {
  id: string;
  title: string;
  startsAt: string;
  status: EventStatus;
  priceCents: number;
  capacity: number | null;
  paidTicketsCount: number;
  totalRevenueCents: number;
  fillRatePercent: number;
}

export interface HostAnalyticsRecentSale {
  ticketId: string;
  eventId: string;
  eventTitle: string;
  buyerName: string;
  buyerEmail: string;
  amountCents: number;
  purchasedAt: string;
}

export interface HostAnalytics {
  totalRevenueCents: number;
  totalTicketsSold: number;
  totalEventsHosted: number;
  activeLiveEventsCount: number;
  upcomingEventsCount: number;
  completedEventsCount: number;
  averageTicketPriceCents: number;
  averageFillRatePercent: number;
  totalBroadcastMinutes: number;
  eventsBreakdown: HostAnalyticsEventItem[];
  recentSales: HostAnalyticsRecentSale[];
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

export type EventStatus = 'draft' | 'published' | 'live' | 'ended' | 'cancelled';
export type TicketStatus = 'pending' | 'paid' | 'refunded' | 'cancelled';

export interface Event {
  id: string;
  facilitatorId: string;
  facilitator?: {
    id: string;
    email: string;
    name?: string;
    companyName?: string;
  };
  title: string;
  description?: string;
  startsAt: string;
  status: EventStatus;
  priceCents: number;
  capacity?: number | null;
  sessionId?: string | null;
  ticketsCount?: number;
  paidTicketsCount?: number;
  totalRevenueCents?: number;
  hasPurchasedTicket?: boolean;
  isHost?: boolean;
  canStartLive?: boolean;
  earliestStartAt?: string;
  userTicket?: Ticket | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  eventId: string;
  event?: Event;
  userId: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  status: TicketStatus;
  amountCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface JoinEventResponse {
  event: Event;
  session?: Session;
  isHost: boolean;
  hasTicket: boolean;
  role?: string;
  agoraToken?: string;
  expiresAt?: number;
  uid?: number;
  chatToken?: string;
  chatUsername?: string;
  agoraChatRoomId?: string;
  message?: string;
  startsAt?: string;
  earliestStartAt?: string;
}

