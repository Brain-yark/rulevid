import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Users,
  Video,
  DollarSign,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Key,
  Calendar,
  Layers,
  ArrowUpRight,
  UserCheck,
} from 'lucide-react';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import type { UserRole } from '../../../shared/types';

interface OverviewStats {
  totalUsers: number;
  roleBreakdown: Record<string, number>;
  totalSessions: number;
  activeSessions: number;
  totalEvents: number;
  eventBreakdown: Record<string, number>;
  totalRevenueCents: number;
  totalRevenueUsd: number;
  totalTicketsSold: number;
  totalMinutes: number;
}

interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  status: string;
  pricingTier: string;
  companyName?: string;
  walletId?: string;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  _count: {
    sessions: number;
    eventsHosted: number;
    tickets: number;
    transactions: number;
  };
}

interface AdminEvent {
  id: string;
  title: string;
  description?: string;
  startsAt: string;
  status: string;
  priceCents: number;
  capacity?: number;
  facilitator: {
    id: string;
    email: string;
    name?: string;
    companyName?: string;
  };
  session?: {
    id: string;
    status: string;
    participantCount: number;
    totalMinutes: number;
  };
  _count: {
    tickets: number;
  };
}

interface AdminSession {
  id: string;
  title: string;
  channelName: string;
  status: string;
  participantCount: number;
  totalMinutes: number;
  startedAt?: string;
  endedAt?: string;
  facilitator: {
    id: string;
    email: string;
    name?: string;
    companyName?: string;
  };
  event?: {
    id: string;
    title: string;
    status: string;
    priceCents: number;
  };
}

interface AdminTransaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  balanceAfter: number;
  description?: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name?: string;
    role: string;
  };
}

interface SuperAdminPageProps {
  onJoinRoom?: (sessionId: string) => void;
}

const SuperAdminPage: React.FC<SuperAdminPageProps> = ({ onJoinRoom }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'events' | 'sessions' | 'transactions' | 'credentials'>('overview');
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filter states
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('all');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/overview`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load overview data');
      const data = await res.json();
      setStats(data.overview);
    } catch (err: any) {
      toast.error('Overview Error', err.message);
    }
  }, [toast]);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (userRoleFilter !== 'all') params.append('role', userRoleFilter);
      if (userStatusFilter !== 'all') params.append('status', userStatusFilter);
      if (userSearchQuery.trim()) params.append('search', userSearchQuery.trim());

      const res = await fetch(`${API_BASE}/api/v1/admin/users?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load users list');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      toast.error('User Fetch Error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userRoleFilter, userStatusFilter, userSearchQuery, toast]);

  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/admin/events`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load platform events');
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err: any) {
      toast.error('Events Fetch Error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/admin/sessions`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load sessions monitor');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err: any) {
      toast.error('Sessions Fetch Error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/admin/transactions`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load transactions ledger');
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err: any) {
      toast.error('Transactions Error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'events') fetchEvents();
    else if (activeTab === 'sessions') fetchSessions();
    else if (activeTab === 'transactions') fetchTransactions();
  }, [activeTab, fetchUsers, fetchEvents, fetchSessions, fetchTransactions]);

  const handleRoleChange = async (userId: string, newRole: UserRole, userEmail: string) => {
    try {
      setUpdatingUserId(userId);
      const res = await fetch(`${API_BASE}/api/v1/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user role');

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );

      toast.success(
        'Role Updated',
        `User ${userEmail} role elevated/assigned to "${newRole.toUpperCase()}".`
      );
      fetchOverview();
    } catch (err: any) {
      toast.error('Role Update Failed', err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: string, userEmail: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      setUpdatingUserId(userId);
      const res = await fetch(`${API_BASE}/api/v1/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user status');

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u))
      );

      if (nextStatus === 'active') {
        toast.success('Account Reactivated', `User ${userEmail} is now active.`);
      } else {
        toast.warning('Account Suspended', `User ${userEmail} has been suspended.`);
      }
    } catch (err: any) {
      toast.error('Status Update Failed', err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const refreshAll = () => {
    fetchOverview();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'events') fetchEvents();
    if (activeTab === 'sessions') fetchSessions();
    if (activeTab === 'transactions') fetchTransactions();
    toast.info('Refreshed', 'Super Admin data synchronized.');
  };

  return (
    <div className="admin-page-container">
      {/* Header Bar */}
      <div className="admin-header-card glass-card">
        <div className="admin-header-title-row">
          <div className="admin-title-badge">
            <ShieldAlert size={28} className="shield-icon" />
            <div>
              <h2>Super Admin Command Center</h2>
              <p className="admin-subtitle">
                Master Governance &amp; Platform Operations Portal
              </p>
            </div>
          </div>

          <div className="admin-header-actions">
            <button className="admin-btn-refresh" onClick={refreshAll} disabled={isLoading}>
              <RefreshCw size={16} className={isLoading ? 'spin-icon' : ''} />
              <span>Sync System Data</span>
            </button>
          </div>
        </div>

        {/* Quick Navigation Tabs */}
        <div className="admin-nav-tabs">
          <button
            className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Layers size={17} />
            <span>Overview &amp; KPIs</span>
          </button>

          <button
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={17} />
            <span>User Governance</span>
            {stats && <span className="tab-pill">{stats.totalUsers}</span>}
          </button>

          <button
            className={`admin-tab-btn ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            <Calendar size={17} />
            <span>Platform Events</span>
            {stats && <span className="tab-pill">{stats.totalEvents}</span>}
          </button>

          <button
            className={`admin-tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            <Video size={17} />
            <span>Active Sessions</span>
            {stats && stats.activeSessions > 0 && (
              <span className="tab-pill live-pill">{stats.activeSessions} Live</span>
            )}
          </button>

          <button
            className={`admin-tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            <DollarSign size={17} />
            <span>Financial Ledger</span>
          </button>

          <button
            className={`admin-tab-btn ${activeTab === 'credentials' ? 'active' : ''}`}
            onClick={() => setActiveTab('credentials')}
          >
            <Key size={17} />
            <span>Super Admin Credentials</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="admin-body">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="overview-section animate-fade-in">
            <div className="stats-kpi-grid">
              <div className="kpi-card glass-card border-indigo">
                <div className="kpi-icon-wrap bg-indigo">
                  <Users size={24} />
                </div>
                <div className="kpi-data">
                  <span className="kpi-label">Total Users</span>
                  <strong className="kpi-value">{stats?.totalUsers || 0}</strong>
                  <div className="kpi-sub-breakdown">
                    <span>Hosts: {stats?.roleBreakdown?.host || 0}</span>
                    <span>Attendees: {stats?.roleBreakdown?.user || 0}</span>
                    <span>Admins: {(stats?.roleBreakdown?.admin || 0) + (stats?.roleBreakdown?.super_admin || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="kpi-card glass-card border-emerald">
                <div className="kpi-icon-wrap bg-emerald">
                  <DollarSign size={24} />
                </div>
                <div className="kpi-data">
                  <span className="kpi-label">Platform Ticket Revenue</span>
                  <strong className="kpi-value">${(stats?.totalRevenueUsd || 0).toFixed(2)}</strong>
                  <span className="kpi-sub">{stats?.totalTicketsSold || 0} tickets sold</span>
                </div>
              </div>

              <div className="kpi-card glass-card border-rose">
                <div className="kpi-icon-wrap bg-rose">
                  <Video size={24} />
                </div>
                <div className="kpi-data">
                  <span className="kpi-label">Active Agora Sessions</span>
                  <strong className="kpi-value">{stats?.activeSessions || 0}</strong>
                  <span className="kpi-sub">{stats?.totalSessions || 0} total sessions lifetime</span>
                </div>
              </div>

              <div className="kpi-card glass-card border-amber">
                <div className="kpi-icon-wrap bg-amber">
                  <Calendar size={24} />
                </div>
                <div className="kpi-data">
                  <span className="kpi-label">Total Events</span>
                  <strong className="kpi-value">{stats?.totalEvents || 0}</strong>
                  <div className="kpi-sub-breakdown">
                    <span>Published: {stats?.eventBreakdown?.published || 0}</span>
                    <span>Live: {stats?.eventBreakdown?.live || 0}</span>
                    <span>Drafts: {stats?.eventBreakdown?.draft || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick action banners */}
            <div className="quick-actions-row">
              <div className="quick-action-card glass-card" onClick={() => setActiveTab('users')}>
                <div className="qa-icon"><UserCheck size={24} /></div>
                <div className="qa-text">
                  <strong>Manage Roles &amp; Permissions</strong>
                  <p>Elevate users to Facilitator / Host or assign Super Admin rights</p>
                </div>
                <ArrowUpRight size={18} className="qa-arrow" />
              </div>

              <div className="quick-action-card glass-card" onClick={() => setActiveTab('credentials')}>
                <div className="qa-icon"><Key size={24} /></div>
                <div className="qa-text">
                  <strong>Master Credentials &amp; Infrastructure</strong>
                  <p>View pre-seeded root credentials, Agora IDs, and Lago status</p>
                </div>
                <ArrowUpRight size={18} className="qa-arrow" />
              </div>
            </div>
          </div>
        )}

        {/* USERS GOVERNANCE TAB */}
        {activeTab === 'users' && (
          <div className="users-section animate-fade-in">
            {/* Filter controls */}
            <div className="filter-bar glass-card">
              <div className="search-input-wrap">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search user by email, name, or company..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                />
              </div>

              <div className="filter-selects">
                <div className="filter-item">
                  <label>Filter by Role:</label>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => {
                      setUserRoleFilter(e.target.value);
                    }}
                  >
                    <option value="all">All Roles</option>
                    <option value="user">Attendee (User)</option>
                    <option value="host">Facilitator / Host</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Platform Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                <div className="filter-item">
                  <label>Filter by Status:</label>
                  <select
                    value={userStatusFilter}
                    onChange={(e) => {
                      setUserStatusFilter(e.target.value);
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <button className="filter-apply-btn" onClick={fetchUsers}>
                  Apply Filters
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="table-wrapper glass-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User / Identity</th>
                    <th>Assigned Role</th>
                    <th>Account Status</th>
                    <th>Hosted Events</th>
                    <th>Sessions</th>
                    <th>Tickets</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="no-data-cell">
                        No users found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className={updatingUserId === u.id ? 'row-updating' : ''}>
                        <td>
                          <div className="user-cell">
                            <strong>{u.name || 'Unnamed User'}</strong>
                            <span className="user-email-sub">{u.email}</span>
                            {u.companyName && (
                              <span className="user-company-badge">🏢 {u.companyName}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="role-dropdown-wrap">
                            <select
                              className={`role-select role-badge-${u.role}`}
                              value={u.role}
                              disabled={updatingUserId === u.id}
                              onChange={(e) =>
                                handleRoleChange(u.id, e.target.value as UserRole, u.email)
                              }
                            >
                              <option value="user">👤 Attendee (User)</option>
                              <option value="host">👑 Facilitator / Host</option>
                              <option value="moderator">🛡️ Moderator</option>
                              <option value="admin">⚡ Admin</option>
                              <option value="super_admin">🔥 Super Admin</option>
                            </select>
                          </div>
                        </td>
                        <td>
                          <button
                            className={`status-pill pill-${u.status}`}
                            onClick={() => handleStatusToggle(u.id, u.status, u.email)}
                            disabled={updatingUserId === u.id}
                            title="Click to toggle status"
                          >
                            {u.status === 'active' ? (
                              <>
                                <CheckCircle size={14} /> Active
                              </>
                            ) : (
                              <>
                                <XCircle size={14} /> Suspended
                              </>
                            )}
                          </button>
                        </td>
                        <td className="center-cell">{u._count?.eventsHosted || 0}</td>
                        <td className="center-cell">{u._count?.sessions || 0}</td>
                        <td className="center-cell">{u._count?.tickets || 0}</td>
                        <td className="date-cell">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="action-cell">
                            {u.role !== 'host' && (
                              <button
                                className="action-btn-promote"
                                onClick={() => handleRoleChange(u.id, 'host', u.email)}
                                title="Promote to Facilitator / Host"
                              >
                                Make Host
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PLATFORM EVENTS TAB */}
        {activeTab === 'events' && (
          <div className="events-section animate-fade-in">
            <div className="table-wrapper glass-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Event Title</th>
                    <th>Facilitator</th>
                    <th>Start Time</th>
                    <th>Status</th>
                    <th>Price</th>
                    <th>Tickets Sold</th>
                    <th>Agora Session</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="no-data-cell">
                        No platform events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    events.map((ev) => (
                      <tr key={ev.id}>
                        <td>
                          <strong>{ev.title}</strong>
                          {ev.description && (
                            <p className="table-sub-desc">{ev.description.substring(0, 70)}...</p>
                          )}
                        </td>
                        <td>
                          <span className="user-email-sub">{ev.facilitator?.email}</span>
                          {ev.facilitator?.name && <div>{ev.facilitator.name}</div>}
                        </td>
                        <td>{new Date(ev.startsAt).toLocaleString()}</td>
                        <td>
                          <span className={`event-status-pill status-${ev.status}`}>
                            {ev.status.toUpperCase()}
                          </span>
                        </td>
                        <td>{ev.priceCents > 0 ? `$${(ev.priceCents / 100).toFixed(2)}` : 'FREE'}</td>
                        <td className="center-cell">{ev._count?.tickets || 0}</td>
                        <td>
                          {ev.session ? (
                            <span className="session-link-pill">
                              Room: {ev.session.id.substring(0, 8)}... ({ev.session.participantCount} users)
                            </span>
                          ) : (
                            <span className="muted-text">Pending Room</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SESSIONS TAB */}
        {activeTab === 'sessions' && (
          <div className="sessions-section animate-fade-in">
            <div className="table-wrapper glass-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Session Title / Room</th>
                    <th>Facilitator</th>
                    <th>Status</th>
                    <th>Live Participants</th>
                    <th>Duration (Minutes)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="no-data-cell">
                        No Agora RTC sessions recorded.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.title}</strong>
                          <span className="user-email-sub">Channel: {s.channelName}</span>
                        </td>
                        <td>{s.facilitator?.email}</td>
                        <td>
                          <span className={`session-status-pill status-${s.status}`}>
                            {s.status === 'active' ? '🔴 LIVE' : s.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="center-cell">
                          <strong>{s.participantCount}</strong>
                        </td>
                        <td className="center-cell">{s.totalMinutes} min</td>
                        <td>
                          {onJoinRoom && (
                            <button
                              className="action-btn-join"
                              onClick={() => onJoinRoom(s.id)}
                            >
                              Join Room
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {activeTab === 'transactions' && (
          <div className="transactions-section animate-fade-in">
            <div className="table-wrapper glass-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="no-data-cell">
                        No financial transactions recorded.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          <strong>{tx.user?.email}</strong>
                          <span className="user-email-sub">({tx.user?.role})</span>
                        </td>
                        <td>
                          <span className={`tx-type-pill ${tx.type}`}>{tx.type.toUpperCase()}</span>
                        </td>
                        <td>
                          <strong>${tx.amount.toFixed(2)}</strong> {tx.currency}
                        </td>
                        <td>
                          <span className={`status-pill pill-${tx.status}`}>{tx.status}</span>
                        </td>
                        <td>{tx.description || 'Wallet / Platform ledger entry'}</td>
                        <td>{new Date(tx.createdAt).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MASTER CREDENTIALS TAB */}
        {activeTab === 'credentials' && (
          <div className="credentials-section animate-fade-in">
            <div className="credentials-grid">
              <div className="credential-card glass-card border-super">
                <div className="cred-card-header">
                  <ShieldAlert size={24} className="cred-icon" />
                  <div>
                    <h3>Super Admin Root Credentials</h3>
                    <p>Pre-seeded master credentials for complete system governance</p>
                  </div>
                </div>

                <div className="cred-details">
                  <div className="cred-row">
                    <span className="cred-label">Login Email:</span>
                    <code className="cred-value">superadmin@svsm.io</code>
                    <button
                      className="copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText('superadmin@svsm.io');
                        toast.success('Copied', 'Super Admin email copied to clipboard!');
                      }}
                    >
                      Copy
                    </button>
                  </div>

                  <div className="cred-row">
                    <span className="cred-label">Password:</span>
                    <code className="cred-value">SuperAdmin@2026!</code>
                    <button
                      className="copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText('SuperAdmin@2026!');
                        toast.success('Copied', 'Super Admin password copied to clipboard!');
                      }}
                    >
                      Copy
                    </button>
                  </div>

                  <div className="cred-row">
                    <span className="cred-label">Assigned Role:</span>
                    <span className="super-badge">super_admin (Full Access)</span>
                  </div>
                </div>

                <div className="cred-footer-note">
                  🛡️ Super Admins can elevate any user to Host or Admin, moderate any live session, and access financial records.
                </div>
              </div>

              <div className="credential-card glass-card">
                <div className="cred-card-header">
                  <Clock size={24} className="cred-icon-blue" />
                  <div>
                    <h3>Integrated Platform Services</h3>
                    <p>Connected RTC, Payment, &amp; Billing Engines</p>
                  </div>
                </div>

                <div className="cred-details">
                  <div className="cred-row">
                    <span className="cred-label">Agora RTC Engine:</span>
                    <span className="status-indicator online">Connected (App ID: 81aeffb...da3a)</span>
                  </div>
                  <div className="cred-row">
                    <span className="cred-label">Stripe Payments:</span>
                    <span className="status-indicator online">Test Mode Active (pk_test_51RzIY...)</span>
                  </div>
                  <div className="cred-row">
                    <span className="cred-label">Lago Usage Metering:</span>
                    <span className="status-indicator online">Docker Gateway Synced</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .admin-page-container {
          max-width: 1300px;
          margin: 0 auto;
          padding: 1.5rem 1rem 3rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .admin-header-card {
          padding: 1.75rem;
          border-radius: 20px;
          background: rgba(18, 22, 34, 0.7);
        }

        .admin-header-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.75rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .admin-title-badge {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .shield-icon {
          color: #f43f5e;
          filter: drop-shadow(0 0 12px rgba(244, 63, 94, 0.5));
        }

        .admin-title-badge h2 {
          font-size: 1.65rem;
          font-weight: 800;
          color: #f8fafc;
          margin: 0 0 0.25rem 0;
          letter-spacing: -0.02em;
        }

        .admin-subtitle {
          color: #94a3b8;
          font-size: 0.95rem;
          margin: 0;
        }

        .admin-btn-refresh {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem 1.25rem;
          border-radius: 12px;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.35);
          color: #a5b4fc;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .admin-btn-refresh:hover {
          background: rgba(99, 102, 241, 0.25);
          color: white;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
        }

        .spin-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        .admin-nav-tabs {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          overflow-x: auto;
          padding-bottom: 0.25rem;
        }

        .admin-tab-btn {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.65rem 1.15rem;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #94a3b8;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .admin-tab-btn:hover {
          color: #f1f5f9;
          background: rgba(255, 255, 255, 0.07);
        }

        .admin-tab-btn.active {
          color: #ffffff;
          background: rgba(99, 102, 241, 0.22);
          border-color: rgba(99, 102, 241, 0.5);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
        }

        .tab-pill {
          background: rgba(255, 255, 255, 0.1);
          padding: 0.15rem 0.5rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .tab-pill.live-pill {
          background: #ef4444;
          color: white;
          animation: pulse 1.5s infinite;
        }

        /* KPI Cards */
        .stats-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .kpi-card {
          padding: 1.5rem;
          border-radius: 18px;
          display: flex;
          align-items: flex-start;
          gap: 1.25rem;
          background: rgba(18, 22, 34, 0.7);
        }

        .border-indigo { border-left: 4px solid #6366f1; }
        .border-emerald { border-left: 4px solid #10b981; }
        .border-rose { border-left: 4px solid #f43f5e; }
        .border-amber { border-left: 4px solid #f59e0b; }
        .border-super { border-left: 4px solid #f43f5e; }

        .kpi-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .bg-indigo { background: rgba(99, 102, 241, 0.2); color: #818cf8; }
        .bg-emerald { background: rgba(16, 185, 129, 0.2); color: #34d399; }
        .bg-rose { background: rgba(244, 63, 94, 0.2); color: #fb7185; }
        .bg-amber { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }

        .kpi-data {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .kpi-label {
          font-size: 0.82rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
        }

        .kpi-value {
          font-size: 1.85rem;
          font-weight: 800;
          color: #f8fafc;
          line-height: 1.2;
        }

        .kpi-sub {
          font-size: 0.8rem;
          color: #64748b;
        }

        .kpi-sub-breakdown {
          display: flex;
          gap: 0.6rem;
          font-size: 0.75rem;
          color: #94a3b8;
          margin-top: 0.25rem;
        }

        /* Quick actions */
        .quick-actions-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.25rem;
        }

        .quick-action-card {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          padding: 1.5rem;
          border-radius: 18px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: rgba(18, 22, 34, 0.7);
        }

        .quick-action-card:hover {
          background: rgba(255, 255, 255, 0.05);
          transform: translateY(-2px);
        }

        .qa-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(99, 102, 241, 0.15);
          color: #818cf8;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .qa-text strong {
          display: block;
          font-size: 1rem;
          color: #f8fafc;
          margin-bottom: 0.2rem;
        }

        .qa-text p {
          font-size: 0.82rem;
          color: #94a3b8;
          margin: 0;
        }

        .qa-arrow {
          margin-left: auto;
          color: #64748b;
        }

        /* Filter bar */
        .filter-bar {
          padding: 1.25rem;
          border-radius: 16px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.25rem;
          background: rgba(18, 22, 34, 0.7);
        }

        .search-input-wrap {
          position: relative;
          flex: 1;
          min-width: 260px;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }

        .search-input-wrap input {
          width: 100%;
          padding: 0.65rem 1rem 0.65rem 2.5rem;
          background: rgba(10, 12, 18, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: white;
          font-size: 0.9rem;
        }

        .search-input-wrap input:focus {
          outline: none;
          border-color: #6366f1;
        }

        .filter-selects {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .filter-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: #94a3b8;
        }

        .filter-item select {
          padding: 0.55rem 0.85rem;
          background: rgba(10, 12, 18, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: white;
          font-size: 0.85rem;
        }

        .filter-apply-btn {
          padding: 0.55rem 1.1rem;
          background: #6366f1;
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-apply-btn:hover {
          background: #4f46e5;
        }

        /* Table */
        .table-wrapper {
          border-radius: 18px;
          overflow-x: auto;
          background: rgba(18, 22, 34, 0.7);
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }

        .admin-table th {
          text-align: left;
          padding: 1rem 1.25rem;
          background: rgba(10, 12, 18, 0.4);
          color: #94a3b8;
          font-weight: 600;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .admin-table td {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          color: #cbd5e1;
        }

        .admin-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .row-updating {
          opacity: 0.5;
          pointer-events: none;
        }

        .user-cell {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .user-email-sub {
          font-size: 0.8rem;
          color: #94a3b8;
        }

        .user-company-badge {
          font-size: 0.75rem;
          color: #60a5fa;
        }

        .role-dropdown-wrap select {
          padding: 0.4rem 0.75rem;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          background: rgba(10, 12, 18, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #f8fafc;
          cursor: pointer;
        }

        .role-select.role-badge-super_admin {
          border-color: #f43f5e;
          color: #f43f5e;
        }

        .role-select.role-badge-admin {
          border-color: #f59e0b;
          color: #fbbf24;
        }

        .role-select.role-badge-host {
          border-color: #6366f1;
          color: #818cf8;
        }

        .role-select.role-badge-moderator {
          border-color: #3b82f6;
          color: #60a5fa;
        }

        .role-select.role-badge-user {
          border-color: #10b981;
          color: #34d399;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.3rem 0.7rem;
          border-radius: 20px;
          font-size: 0.78rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .pill-active {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .pill-suspended {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .center-cell {
          text-align: center;
        }

        .date-cell {
          font-size: 0.82rem;
          color: #64748b;
        }

        .action-btn-promote {
          padding: 0.35rem 0.75rem;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #818cf8;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
        }

        .action-btn-promote:hover {
          background: rgba(99, 102, 241, 0.3);
          color: white;
        }

        .action-btn-join {
          padding: 0.35rem 0.85rem;
          background: #6366f1;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        }

        .no-data-cell {
          text-align: center;
          padding: 3rem !important;
          color: #64748b;
          font-style: italic;
        }

        /* Credentials Section */
        .credentials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
          gap: 1.5rem;
        }

        .credential-card {
          padding: 1.75rem;
          border-radius: 20px;
          background: rgba(18, 22, 34, 0.7);
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .cred-card-header {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .cred-icon {
          color: #f43f5e;
        }

        .cred-icon-blue {
          color: #60a5fa;
        }

        .cred-card-header h3 {
          font-size: 1.2rem;
          font-weight: 700;
          color: #f8fafc;
          margin: 0 0 0.2rem 0;
        }

        .cred-card-header p {
          font-size: 0.82rem;
          color: #94a3b8;
          margin: 0;
        }

        .cred-details {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .cred-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.85rem 1rem;
          background: rgba(10, 12, 18, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .cred-label {
          font-size: 0.85rem;
          color: #94a3b8;
        }

        .cred-value {
          font-family: monospace;
          color: #38bdf8;
          font-size: 0.95rem;
          font-weight: 600;
        }

        .copy-btn {
          padding: 0.3rem 0.7rem;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #cbd5e1;
          border-radius: 6px;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .copy-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }

        .super-badge {
          background: rgba(244, 63, 94, 0.15);
          color: #f43f5e;
          border: 1px solid rgba(244, 63, 94, 0.3);
          padding: 0.25rem 0.6rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 700;
        }

        .cred-footer-note {
          font-size: 0.82rem;
          color: #94a3b8;
          line-height: 1.4;
          padding-top: 0.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .status-indicator {
          font-size: 0.85rem;
          font-weight: 500;
        }

        .status-indicator.online {
          color: #34d399;
        }
      `}</style>
    </div>
  );
};

export default SuperAdminPage;
