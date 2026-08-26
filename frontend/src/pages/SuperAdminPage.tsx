import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Users,
  Video,
  DollarSign,
  Search,
  RefreshCw,
  CheckCircle,
  Clock,
  Key,
  Calendar,
  Layers,
  Sparkles,
  Package,
  Edit,
  Plus,
  Zap,
  X,
} from 'lucide-react';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import type { UserRole, BillingPackage } from '../../../shared/types';

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
  billingPackageId?: string;
  packageMinutesTotal?: number;
  packageMinutesUsed?: number;
  overageConsent?: boolean;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  billingPackage?: BillingPackage;
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

interface AdminBillingPackage {
  id: string;
  name: string;
  slug: string;
  participantMinutes: number;
  priceCents: number;
  effectiveRatePer1k?: string;
  roughlyCovers?: string;
  overageBlockCents: number;
  overageBlockMinutes: number;
  description?: string;
  isActive: boolean;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
  };
}

interface AdminOverageRecord {
  id: string;
  userId: string;
  sessionId?: string;
  amountCents: number;
  minutesCredited: number;
  stripePaymentIntentId?: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name?: string;
    companyName?: string;
  };
}

interface SuperAdminPageProps {
  onJoinRoom?: (sessionId: string) => void;
}

const SuperAdminPage: React.FC<SuperAdminPageProps> = ({ onJoinRoom }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'packages' | 'events' | 'sessions' | 'transactions' | 'credentials'>('overview');
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [packages, setPackages] = useState<AdminBillingPackage[]>([]);
  const [overages, setOverages] = useState<AdminOverageRecord[]>([]);
  const [overageSummary, setOverageSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filter states
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('all');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Package Editing & Creating State
  const [editingPackage, setEditingPackage] = useState<AdminBillingPackage | null>(null);
  const [isCreatingPackage, setIsCreatingPackage] = useState(false);
  const [pkgName, setPkgName] = useState('');
  const [pkgSlug, setPkgSlug] = useState('');
  const [pkgMinutes, setPkgMinutes] = useState('30000');
  const [pkgPriceUsd, setPkgPriceUsd] = useState('30');
  const [pkgEffectiveRate, setPkgEffectiveRate] = useState('$1.00/1k');
  const [pkgRoughlyCovers, setPkgRoughlyCovers] = useState('~10 events of 50 attendees/hr');
  const [pkgOverageBlockUsd, setPkgOverageBlockUsd] = useState('10');
  const [pkgOverageBlockMins, setPkgOverageBlockMins] = useState('10000');
  const [pkgDescription, setPkgDescription] = useState('');
  const [pkgIsActive, setPkgIsActive] = useState(true);
  const [pkgIsCustom, setPkgIsCustom] = useState(false);
  const [isSavingPkg, setIsSavingPkg] = useState(false);

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

  const fetchPackages = useCallback(async () => {
    try {
      setIsLoading(true);
      const [resPkg, resOverage] = await Promise.all([
        fetch(`${API_BASE}/api/v1/admin/packages`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/api/v1/admin/overages`, { headers: getAuthHeaders() }),
      ]);

      if (resPkg.ok) {
        const data = await resPkg.json();
        setPackages(data.packages || []);
      }
      if (resOverage.ok) {
        const overageData = await resOverage.json();
        setOverages(overageData.overages || []);
        setOverageSummary(overageData.summary || null);
      }
    } catch (err: any) {
      toast.error('Packages Fetch Error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

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
    else if (activeTab === 'packages') fetchPackages();
    else if (activeTab === 'events') fetchEvents();
    else if (activeTab === 'sessions') fetchSessions();
    else if (activeTab === 'transactions') fetchTransactions();
  }, [activeTab, fetchUsers, fetchPackages, fetchEvents, fetchSessions, fetchTransactions]);

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

  // ── Package CRUD Operations ──
  const openEditPackage = (pkg: AdminBillingPackage) => {
    setEditingPackage(pkg);
    setIsCreatingPackage(false);
    setPkgName(pkg.name);
    setPkgSlug(pkg.slug);
    setPkgMinutes(pkg.participantMinutes.toString());
    setPkgPriceUsd((pkg.priceCents / 100).toString());
    setPkgEffectiveRate(pkg.effectiveRatePer1k || '');
    setPkgRoughlyCovers(pkg.roughlyCovers || '');
    setPkgOverageBlockUsd((pkg.overageBlockCents / 100).toString());
    setPkgOverageBlockMins(pkg.overageBlockMinutes.toString());
    setPkgDescription(pkg.description || '');
    setPkgIsActive(pkg.isActive);
    setPkgIsCustom(pkg.isCustom);
  };

  const openCreatePackage = () => {
    setEditingPackage(null);
    setIsCreatingPackage(true);
    setPkgName('');
    setPkgSlug('');
    setPkgMinutes('50000');
    setPkgPriceUsd('49');
    setPkgEffectiveRate('$0.98/1k');
    setPkgRoughlyCovers('~20 events of 50 attendees/hr');
    setPkgOverageBlockUsd('10');
    setPkgOverageBlockMins('10000');
    setPkgDescription('Custom package tier tailored for live video hosts.');
    setPkgIsActive(true);
    setPkgIsCustom(false);
  };

  const handleSavePackageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPkg(true);

    try {
      const priceCents = Math.round(parseFloat(pkgPriceUsd || '0') * 100);
      const overageBlockCents = Math.round(parseFloat(pkgOverageBlockUsd || '10') * 100);
      const participantMinutes = parseInt(pkgMinutes, 10);
      const overageBlockMinutes = parseInt(pkgOverageBlockMins, 10);

      const payload = {
        name: pkgName.trim(),
        slug: pkgSlug.trim().toLowerCase(),
        participantMinutes,
        priceCents,
        effectiveRatePer1k: pkgEffectiveRate.trim() || undefined,
        roughlyCovers: pkgRoughlyCovers.trim() || undefined,
        overageBlockCents,
        overageBlockMinutes,
        description: pkgDescription.trim() || undefined,
        isActive: pkgIsActive,
        isCustom: pkgIsCustom,
      };

      if (editingPackage) {
        // PUT update
        const res = await fetch(`${API_BASE}/api/v1/admin/packages/${editingPackage.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update package');

        toast.success('Package Updated', `Billing package "${payload.name}" updated successfully.`);
      } else {
        // POST create
        const res = await fetch(`${API_BASE}/api/v1/admin/packages`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create package');

        toast.success('Package Created', `New package "${payload.name}" is now live on the marketplace.`);
      }

      setEditingPackage(null);
      setIsCreatingPackage(false);
      fetchPackages();
    } catch (err: any) {
      toast.error('Save Failed', err.message);
    } finally {
      setIsSavingPkg(false);
    }
  };

  const handleTogglePackageActive = async (pkg: AdminBillingPackage) => {
    try {
      const nextActive = !pkg.isActive;
      const res = await fetch(`${API_BASE}/api/v1/admin/packages/${pkg.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      toast.success(
        nextActive ? 'Package Activated' : 'Package Deactivated',
        `"${pkg.name}" is now ${nextActive ? 'visible' : 'hidden'} on the marketplace.`
      );
      fetchPackages();
    } catch (err: any) {
      toast.error('Toggle Failed', err.message);
    }
  };

  const refreshAll = () => {
    fetchOverview();
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'packages') fetchPackages();
    else if (activeTab === 'events') fetchEvents();
    else if (activeTab === 'sessions') fetchSessions();
    else if (activeTab === 'transactions') fetchTransactions();
  };

  return (
    <div className="admin-page-container animate-fade-in">
      {/* Header Banner */}
      <div className="admin-header-card glass-card">
        <div className="admin-header-title-row">
          <div className="admin-title-badge">
            <ShieldAlert size={34} className="shield-icon" />
            <div>
              <h2>Master Super Admin Portal</h2>
              <p className="admin-subtitle">
                System Governance, Billing Marketplace Pricing, User Roles &amp; Live Auditing
              </p>
            </div>
          </div>
          <button className="admin-btn-refresh" onClick={refreshAll}>
            <RefreshCw size={16} className={isLoading ? 'spin-icon' : ''} />
            <span>Refresh Telemetry</span>
          </button>
        </div>

        {/* Navigation Tabs */}
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
            className={`admin-tab-btn ${activeTab === 'packages' ? 'active' : ''}`}
            onClick={() => setActiveTab('packages')}
          >
            <Sparkles size={17} />
            <span>Marketplace &amp; Pricing</span>
            {packages.length > 0 && <span className="tab-pill">{packages.length}</span>}
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
            <span>Master Credentials</span>
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
                  </div>
                </div>
              </div>

              <div className="kpi-card glass-card border-emerald">
                <div className="kpi-icon-wrap bg-emerald">
                  <DollarSign size={24} />
                </div>
                <div className="kpi-data">
                  <span className="kpi-label">Gross Revenue</span>
                  <strong className="kpi-value">${(stats?.totalRevenueUsd || 0).toFixed(2)}</strong>
                  <div className="kpi-sub-breakdown">
                    <span>Tickets: {stats?.totalTicketsSold || 0} sold</span>
                  </div>
                </div>
              </div>

              <div className="kpi-card glass-card border-rose">
                <div className="kpi-icon-wrap bg-rose">
                  <Video size={24} />
                </div>
                <div className="kpi-data">
                  <span className="kpi-label">Live Broadcasts</span>
                  <strong className="kpi-value">{stats?.activeSessions || 0} active</strong>
                  <div className="kpi-sub-breakdown">
                    <span>Total Hosted: {stats?.totalSessions || 0}</span>
                  </div>
                </div>
              </div>

              <div className="kpi-card glass-card border-purple">
                <div className="kpi-icon-wrap bg-purple">
                  <Calendar size={24} />
                </div>
                <div className="kpi-data">
                  <span className="kpi-label">Platform Events</span>
                  <strong className="kpi-value">{stats?.totalEvents || 0}</strong>
                  <div className="kpi-sub-breakdown">
                    <span>Published: {stats?.eventBreakdown?.published || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── BILLING MARKETPLACE & PRICING PACKAGES TAB ── */}
        {activeTab === 'packages' && (
          <div className="packages-admin-section animate-fade-in">
            {/* Top Stats Banner */}
            <div className="packages-stat-summary">
              <div className="pkg-kpi-item">
                <Package size={20} className="text-indigo" />
                <div>
                  <span className="pkg-kpi-label">Total Catalog Tiers</span>
                  <strong>{packages.length} Packages</strong>
                </div>
              </div>
              <div className="pkg-kpi-item">
                <CheckCircle size={20} className="text-emerald" />
                <div>
                  <span className="pkg-kpi-label">Active on Marketplace</span>
                  <strong>{packages.filter((p) => p.isActive).length} Live</strong>
                </div>
              </div>
              <div className="pkg-kpi-item">
                <Zap size={20} className="text-amber" />
                <div>
                  <span className="pkg-kpi-label">Auto-Overage Charges</span>
                  <strong>{overageSummary?.totalChargesCount || 0} events (${(overageSummary?.totalOverageRevenueUsd || 0).toFixed(2)})</strong>
                </div>
              </div>
              <button className="create-pkg-btn" onClick={openCreatePackage}>
                <Plus size={18} />
                <span>Create New Tier</span>
              </button>
            </div>

            {/* Packages Grid / Table */}
            <div className="packages-table-container glass-card">
              <div className="table-header-row">
                <div className="th-title">
                  <Sparkles size={18} />
                  <h3>Host Package Marketplace Configuration</h3>
                </div>
                <span className="th-note">
                  Super Admins can edit rates, minutes, and pricing anytime. Updates reflect immediately across the landing page and host signup.
                </span>
              </div>

              <div className="packages-cards-admin-grid">
                {packages.map((pkg) => (
                  <div key={pkg.id} className={`admin-pkg-card ${!pkg.isActive ? 'inactive' : ''}`}>
                    <div className="admin-pkg-header">
                      <div>
                        <h4>{pkg.name}</h4>
                        <span className="admin-pkg-slug">slug: {pkg.slug}</span>
                      </div>
                      <div className="pkg-status-pills">
                        {pkg.isCustom && <span className="pill-custom">CUSTOM</span>}
                        <span className={`pill-active ${pkg.isActive ? 'active' : 'inactive'}`}>
                          {pkg.isActive ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>
                    </div>

                    <div className="admin-pkg-pricing">
                      <span className="admin-pkg-price">
                        {pkg.isCustom ? 'Custom' : `$${pkg.priceCents / 100}`}
                      </span>
                      {!pkg.isCustom && <span className="admin-pkg-cycle">/ mo</span>}
                    </div>

                    <div className="admin-pkg-minutes-row">
                      <Clock size={15} />
                      <span><strong>{pkg.participantMinutes.toLocaleString()}</strong> participant-minutes</span>
                    </div>

                    <div className="admin-pkg-coverage">
                      <span>Covers: {pkg.roughlyCovers || '—'}</span>
                    </div>

                    <div className="admin-pkg-meta-grid">
                      <div className="meta-cell">
                        <span className="meta-lbl">Rate / 1k</span>
                        <span className="meta-val">{pkg.effectiveRatePer1k || '—'}</span>
                      </div>
                      <div className="meta-cell">
                        <span className="meta-lbl">Auto-Overage</span>
                        <span className="meta-val">${pkg.overageBlockCents / 100} / {pkg.overageBlockMinutes.toLocaleString()}m</span>
                      </div>
                    </div>

                    <p className="admin-pkg-desc">{pkg.description || 'No description provided.'}</p>

                    <div className="admin-pkg-actions">
                      <button
                        type="button"
                        className="pkg-action-edit"
                        onClick={() => openEditPackage(pkg)}
                      >
                        <Edit size={15} />
                        <span>Edit Pricing &amp; Minutes</span>
                      </button>
                      <button
                        type="button"
                        className={`pkg-action-toggle ${pkg.isActive ? 'btn-disable' : 'btn-enable'}`}
                        onClick={() => handleTogglePackageActive(pkg)}
                      >
                        {pkg.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Auto-Overage System Audit Ledger */}
            <div className="overages-audit-card glass-card">
              <div className="overage-audit-header">
                <div className="audit-title">
                  <Zap size={20} className="text-amber" />
                  <h3>Automatic In-Stream Overage Audit Records</h3>
                </div>
                <span className="audit-badge">{overages.length} recorded charges</span>
              </div>

              {overages.length === 0 ? (
                <div className="empty-audit-state">No auto-overage charges recorded yet.</div>
              ) : (
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Date / Time</th>
                        <th>Host Account</th>
                        <th>Amount Charged</th>
                        <th>Minutes Credited</th>
                        <th>Payment Intent</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overages.map((ov) => (
                        <tr key={ov.id}>
                          <td>{new Date(ov.createdAt).toLocaleString()}</td>
                          <td>
                            <strong>{ov.user?.name || ov.user?.email}</strong>
                            <span className="sub-txt">{ov.user?.email}</span>
                          </td>
                          <td className="text-emerald font-bold">${(ov.amountCents / 100).toFixed(2)}</td>
                          <td>+{ov.minutesCredited.toLocaleString()} mins</td>
                          <td className="code-font">{ov.stripePaymentIntentId || 'Off-session Card'}</td>
                          <td>
                            <span className="status-pill completed">{ov.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── USER GOVERNANCE TAB ── */}
        {activeTab === 'users' && (
          <div className="users-section animate-fade-in">
            <div className="filter-toolbar glass-card">
              <div className="search-wrap">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by email, name, company..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                />
              </div>

              <div className="select-filters">
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="admin-select"
                >
                  <option value="all">All Roles</option>
                  <option value="user">Attendee</option>
                  <option value="host">Host / Facilitator</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>

                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="admin-select"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div className="table-card glass-card">
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Current Role</th>
                      <th>Host Tier &amp; Mins</th>
                      <th>Account Status</th>
                      <th>Activity</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="user-cell">
                            <strong>{u.name || u.email.split('@')[0]}</strong>
                            <span className="user-email-sub">{u.email}</span>
                            {u.companyName && <span className="user-co-sub">{u.companyName}</span>}
                          </div>
                        </td>
                        <td>
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole, u.email)}
                            disabled={updatingUserId === u.id}
                            className={`role-badge-select role-${u.role}`}
                          >
                            <option value="user">ATTENDEE</option>
                            <option value="host">HOST</option>
                            <option value="moderator">MODERATOR</option>
                            <option value="admin">ADMIN</option>
                            <option value="super_admin">SUPER ADMIN</option>
                          </select>
                        </td>
                        <td>
                          <div className="pkg-info-cell">
                            <span className="pkg-name-tag">
                              {u.billingPackage?.name || (u.role === 'host' ? 'Free Host' : 'No Package')}
                            </span>
                            <span className="pkg-mins-sub">
                              {((u.packageMinutesTotal || 0) - (u.packageMinutesUsed || 0)).toLocaleString()} mins remaining
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${u.status}`}>{u.status}</span>
                        </td>
                        <td>
                          <div className="activity-cell">
                            <span>{u._count.eventsHosted} events</span>
                            <span>{u._count.tickets} tickets</span>
                          </div>
                        </td>
                        <td>
                          <button
                            className={`status-toggle-btn ${u.status === 'active' ? 'btn-suspend' : 'btn-activate'}`}
                            onClick={() => handleStatusToggle(u.id, u.status, u.email)}
                            disabled={updatingUserId === u.id}
                          >
                            {u.status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── EVENTS TAB ── */}
        {activeTab === 'events' && (
          <div className="events-admin-section animate-fade-in">
            <div className="table-card glass-card">
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Host</th>
                      <th>Date &amp; Time</th>
                      <th>Price</th>
                      <th>Tickets Sold</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev) => (
                      <tr key={ev.id}>
                        <td>
                          <strong>{ev.title}</strong>
                        </td>
                        <td>{ev.facilitator.name || ev.facilitator.email}</td>
                        <td>{new Date(ev.startsAt).toLocaleString()}</td>
                        <td className="font-bold">${(ev.priceCents / 100).toFixed(2)}</td>
                        <td>{ev._count.tickets} attendees</td>
                        <td>
                          <span className={`status-pill ${ev.status}`}>{ev.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── SESSIONS TAB ── */}
        {activeTab === 'sessions' && (
          <div className="sessions-admin-section animate-fade-in">
            <div className="table-card glass-card">
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Session / Room</th>
                      <th>Host</th>
                      <th>Participants</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th>Join / Monitor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.title || s.channelName}</strong>
                          <span className="sub-txt">Channel: {s.channelName}</span>
                        </td>
                        <td>{s.facilitator.name || s.facilitator.email}</td>
                        <td>
                          <span className="live-count-badge">
                            <Users size={14} /> {s.participantCount} in room
                          </span>
                        </td>
                        <td>{s.totalMinutes} mins</td>
                        <td>
                          <span className={`status-pill ${s.status}`}>{s.status}</span>
                        </td>
                        <td>
                          {s.status === 'live' && onJoinRoom && (
                            <button
                              className="action-btn-join"
                              onClick={() => onJoinRoom(s.id)}
                            >
                              Inspect Stream
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TRANSACTIONS TAB ── */}
        {activeTab === 'transactions' && (
          <div className="transactions-admin-section animate-fade-in">
            <div className="table-card glass-card">
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>User</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Balance After</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>{new Date(tx.createdAt).toLocaleString()}</td>
                        <td>{tx.user?.email || '—'}</td>
                        <td>
                          <span className="tx-type-pill">{tx.type}</span>
                        </td>
                        <td className="font-bold text-emerald">${tx.amount.toFixed(2)}</td>
                        <td>${tx.balanceAfter.toFixed(2)}</td>
                        <td>
                          <span className={`status-pill ${tx.status}`}>{tx.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CREDENTIALS TAB ── */}
        {activeTab === 'credentials' && (
          <div className="credentials-section animate-fade-in">
            <div className="credentials-grid">
              <div className="credential-card glass-card">
                <div className="cred-card-header">
                  <ShieldAlert size={28} className="cred-icon" />
                  <div>
                    <h3>Master Super Admin Credentials</h3>
                    <p>Pre-seeded system access keys for RuleVid administration</p>
                  </div>
                </div>

                <div className="cred-details">
                  <div className="cred-row">
                    <span className="cred-label">Login Email:</span>
                    <span className="cred-value">superadmin@svsm.io</span>
                    <button
                      className="copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText('superadmin@svsm.io');
                        toast.success('Copied', 'Email copied to clipboard');
                      }}
                    >
                      Copy
                    </button>
                  </div>

                  <div className="cred-row">
                    <span className="cred-label">Master Password:</span>
                    <span className="cred-value">SuperAdmin@2026!</span>
                    <button
                      className="copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText('SuperAdmin@2026!');
                        toast.success('Copied', 'Password copied to clipboard');
                      }}
                    >
                      Copy
                    </button>
                  </div>

                  <div className="cred-row">
                    <span className="cred-label">System Role:</span>
                    <span className="super-badge">SUPER ADMIN</span>
                  </div>
                </div>

                <div className="cred-footer-note">
                  🔒 Note: Super admin credentials grant full platform authority including billing rate modifications, role assignment, and live broadcast supervision.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Package Edit / Create Modal ── */}
      {(editingPackage || isCreatingPackage) && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card animate-fade-in">
            <div className="modal-header">
              <div className="modal-title-group">
                <Sparkles size={22} className="text-primary" />
                <h3>{editingPackage ? `Edit Package: ${editingPackage.name}` : 'Create New Marketplace Package'}</h3>
              </div>
              <button
                className="close-btn"
                onClick={() => {
                  setEditingPackage(null);
                  setIsCreatingPackage(false);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePackageSubmit} className="package-edit-form">
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Package Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Pro Creator"
                    value={pkgName}
                    onChange={(e) => setPkgName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group flex-1">
                  <label>Slug (Identifier) *</label>
                  <input
                    type="text"
                    placeholder="e.g. pro-creator"
                    value={pkgSlug}
                    onChange={(e) => setPkgSlug(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Monthly Price ($ USD) *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="49"
                    value={pkgPriceUsd}
                    onChange={(e) => setPkgPriceUsd(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group flex-1">
                  <label>Standard Participant-Minutes *</label>
                  <input
                    type="number"
                    min="100"
                    step="500"
                    placeholder="50000"
                    value={pkgMinutes}
                    onChange={(e) => setPkgMinutes(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Effective Rate Display (e.g. $0.98/1k)</label>
                  <input
                    type="text"
                    placeholder="$0.98/1k"
                    value={pkgEffectiveRate}
                    onChange={(e) => setPkgEffectiveRate(e.target.value)}
                  />
                </div>

                <div className="form-group flex-1">
                  <label>Rough Coverage Description</label>
                  <input
                    type="text"
                    placeholder="~20 events of 50 attendees/hr"
                    value={pkgRoughlyCovers}
                    onChange={(e) => setPkgRoughlyCovers(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Auto-Overage Block Price ($ USD)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="10"
                    value={pkgOverageBlockUsd}
                    onChange={(e) => setPkgOverageBlockUsd(e.target.value)}
                  />
                </div>

                <div className="form-group flex-1">
                  <label>Overage Block Minutes</label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    placeholder="10000"
                    value={pkgOverageBlockMins}
                    onChange={(e) => setPkgOverageBlockMins(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description (Shown on Landing Page Marketplace)</label>
                <textarea
                  rows={2}
                  placeholder="Describe package benefits, ideal user volume, and support level..."
                  value={pkgDescription}
                  onChange={(e) => setPkgDescription(e.target.value)}
                />
              </div>

              <div className="form-toggles-row">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={pkgIsActive}
                    onChange={(e) => setPkgIsActive(e.target.checked)}
                  />
                  <span>Active &amp; Visible on Public Marketplace</span>
                </label>

                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={pkgIsCustom}
                    onChange={(e) => setPkgIsCustom(e.target.checked)}
                  />
                  <span>Custom / Enterprise Tier (Contact Sales)</span>
                </label>
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setEditingPackage(null);
                    setIsCreatingPackage(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={isSavingPkg}
                >
                  {isSavingPkg ? 'Saving...' : editingPackage ? 'Save Package Changes' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          color: white;
          background: rgba(99, 102, 241, 0.2);
          border-color: rgba(99, 102, 241, 0.45);
        }

        .tab-pill {
          padding: 0.15rem 0.45rem;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.1);
          font-size: 0.72rem;
          font-weight: 700;
        }

        .live-pill {
          background: rgba(244, 63, 94, 0.25);
          color: #fda4af;
        }

        /* ── Packages Admin Section ── */
        .packages-admin-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .packages-stat-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.75rem;
          background: rgba(18, 22, 34, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          flex-wrap: wrap;
          gap: 1.25rem;
        }

        .pkg-kpi-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .pkg-kpi-label {
          display: block;
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .pkg-kpi-item strong {
          font-size: 1.05rem;
          color: white;
        }

        .create-pkg-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.65rem 1.25rem;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border: none;
          color: white;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
        }

        .create-pkg-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
        }

        .packages-table-container {
          padding: 1.75rem;
          border-radius: 20px;
          background: rgba(18, 22, 34, 0.7);
        }

        .table-header-row {
          margin-bottom: 1.75rem;
        }

        .th-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.35rem;
        }

        .th-title h3 {
          font-size: 1.3rem;
          font-weight: 800;
          color: white;
          margin: 0;
        }

        .th-note {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .packages-cards-admin-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.25rem;
        }

        .admin-pkg-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          transition: all 0.2s ease;
        }

        .admin-pkg-card:hover {
          border-color: rgba(99, 102, 241, 0.4);
          background: rgba(99, 102, 241, 0.04);
        }

        .admin-pkg-card.inactive {
          opacity: 0.6;
          border-style: dashed;
        }

        .admin-pkg-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .admin-pkg-header h4 {
          font-size: 1.2rem;
          font-weight: 700;
          color: white;
          margin: 0 0 0.15rem 0;
        }

        .admin-pkg-slug {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-family: monospace;
        }

        .pkg-status-pills {
          display: flex;
          gap: 0.35rem;
        }

        .pill-custom {
          background: rgba(168, 85, 247, 0.2);
          border: 1px solid rgba(168, 85, 247, 0.4);
          color: #d8b4fe;
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.15rem 0.45rem;
          border-radius: 8px;
        }

        .pill-active.active {
          background: rgba(16, 185, 129, 0.15);
          color: #6ee7b7;
          border: 1px solid rgba(16, 185, 129, 0.3);
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.15rem 0.45rem;
          border-radius: 8px;
        }

        .pill-active.inactive {
          background: rgba(244, 63, 94, 0.15);
          color: #fda4af;
          border: 1px solid rgba(244, 63, 94, 0.3);
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.15rem 0.45rem;
          border-radius: 8px;
        }

        .admin-pkg-pricing {
          display: flex;
          align-items: baseline;
          gap: 0.3rem;
        }

        .admin-pkg-price {
          font-size: 1.8rem;
          font-weight: 800;
          color: white;
        }

        .admin-pkg-cycle {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .admin-pkg-minutes-row {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.4rem 0.65rem;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 8px;
          color: #c7d2fe;
          font-size: 0.8rem;
        }

        .admin-pkg-coverage {
          font-size: 0.78rem;
          color: var(--text-muted);
          min-height: 20px;
        }

        .admin-pkg-meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }

        .meta-cell {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 0.45rem 0.6rem;
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }

        .meta-lbl {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .meta-val {
          font-size: 0.8rem;
          font-weight: 600;
          color: white;
        }

        .admin-pkg-desc {
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.35;
          margin: 0;
          flex: 1;
        }

        .admin-pkg-actions {
          display: flex;
          gap: 0.6rem;
          margin-top: 0.5rem;
        }

        .pkg-action-edit {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.55rem;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.35);
          color: white;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .pkg-action-edit:hover {
          background: rgba(99, 102, 241, 0.3);
        }

        .pkg-action-toggle {
          padding: 0.55rem 0.85rem;
          border-radius: 10px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }

        .pkg-action-toggle.btn-disable {
          background: rgba(244, 63, 94, 0.1);
          color: #fda4af;
          border-color: rgba(244, 63, 94, 0.3);
        }

        .pkg-action-toggle.btn-disable:hover {
          background: rgba(244, 63, 94, 0.2);
        }

        .pkg-action-toggle.btn-enable {
          background: rgba(16, 185, 129, 0.1);
          color: #6ee7b7;
          border-color: rgba(16, 185, 129, 0.3);
        }

        .pkg-action-toggle.btn-enable:hover {
          background: rgba(16, 185, 129, 0.2);
        }

        /* ── Overages Audit Card ── */
        .overages-audit-card {
          padding: 1.75rem;
          border-radius: 20px;
          background: rgba(18, 22, 34, 0.7);
        }

        .overage-audit-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
        }

        .audit-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .audit-title h3 {
          font-size: 1.25rem;
          font-weight: 700;
          color: white;
          margin: 0;
        }

        .audit-badge {
          font-size: 0.78rem;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.05);
          padding: 0.25rem 0.6rem;
          border-radius: 8px;
        }

        .empty-audit-state {
          text-align: center;
          padding: 2rem;
          color: var(--text-muted);
          font-style: italic;
        }

        /* ── Modals & Forms ── */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
        }

        .modal-content {
          width: 100%;
          max-width: 650px;
          padding: 2rem;
          border-radius: 20px;
          background: linear-gradient(180deg, rgba(26, 28, 48, 0.98) 0%, rgba(15, 17, 30, 0.99) 100%);
          border: 1px solid rgba(99, 102, 241, 0.35);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .modal-title-group {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .modal-title-group h3 {
          font-size: 1.35rem;
          font-weight: 800;
          color: white;
          margin: 0;
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .close-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .package-edit-form {
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
        }

        .form-row {
          display: flex;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .flex-1 {
          flex: 1;
        }

        .form-group label {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .form-group input, .form-group textarea {
          width: 100%;
          padding: 0.65rem 0.85rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          color: white;
          font-family: inherit;
        }

        .form-group input:focus, .form-group textarea:focus {
          outline: none;
          border-color: #6366f1;
        }

        .form-toggles-row {
          display: flex;
          gap: 1.5rem;
          padding: 0.75rem 0;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: white;
          cursor: pointer;
        }

        .modal-actions-row {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .secondary-btn {
          padding: 0.65rem 1.25rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }

        .primary-btn {
          padding: 0.65rem 1.5rem;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border: none;
          color: white;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
        }

        /* ── Standard Admin Table Styles ── */
        .stats-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1.25rem;
        }

        .kpi-card {
          padding: 1.5rem;
          border-radius: 18px;
          display: flex;
          align-items: center;
          gap: 1.25rem;
          background: rgba(18, 22, 34, 0.7);
        }

        .kpi-icon-wrap {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .bg-indigo { background: rgba(99, 102, 241, 0.2); color: #a5b4fc; }
        .bg-emerald { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
        .bg-rose { background: rgba(244, 63, 94, 0.2); color: #fda4af; }
        .bg-purple { background: rgba(168, 85, 247, 0.2); color: #d8b4fe; }

        .kpi-data {
          display: flex;
          flex-direction: column;
        }

        .kpi-label {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .kpi-value {
          font-size: 1.6rem;
          font-weight: 800;
          color: white;
        }

        .kpi-sub-breakdown {
          display: flex;
          gap: 0.75rem;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .filter-toolbar {
          display: flex;
          gap: 1rem;
          padding: 1rem 1.5rem;
          border-radius: 16px;
          background: rgba(18, 22, 34, 0.7);
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        .search-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          padding: 0.5rem 1rem;
          border-radius: 10px;
          border: 1px solid var(--glass-border);
        }

        .search-wrap input {
          background: none;
          border: none;
          color: white;
          outline: none;
          width: 100%;
        }

        .select-filters {
          display: flex;
          gap: 0.75rem;
        }

        .admin-select {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 10px;
          outline: none;
        }

        .table-card {
          padding: 1.5rem;
          border-radius: 20px;
          background: rgba(18, 22, 34, 0.7);
        }

        .table-responsive {
          overflow-x: auto;
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .admin-table th {
          padding: 0.85rem 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .admin-table td {
          padding: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 0.88rem;
          color: #cbd5e1;
        }

        .user-cell {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .user-email-sub {
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .user-co-sub {
          font-size: 0.72rem;
          color: #a5b4fc;
        }

        .role-badge-select {
          padding: 0.35rem 0.65rem;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 800;
          outline: none;
          cursor: pointer;
        }

        .role-badge-select.role-host { background: rgba(99, 102, 241, 0.2); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.4); }
        .role-badge-select.role-user { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.3); }
        .role-badge-select.role-moderator { background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4); }
        .role-badge-select.role-admin, .role-badge-select.role-super_admin { background: rgba(244, 63, 94, 0.2); color: #fda4af; border: 1px solid rgba(244, 63, 94, 0.4); }

        .pkg-info-cell {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .pkg-name-tag {
          font-weight: 700;
          color: white;
          font-size: 0.85rem;
        }

        .pkg-mins-sub {
          font-size: 0.72rem;
          color: #a5b4fc;
        }

        .status-pill {
          padding: 0.2rem 0.55rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .status-pill.active, .status-pill.completed, .status-pill.published, .status-pill.live {
          background: rgba(16, 185, 129, 0.15);
          color: #6ee7b7;
        }

        .status-pill.suspended, .status-pill.ended {
          background: rgba(244, 63, 94, 0.15);
          color: #fda4af;
        }

        .status-pill.draft, .status-pill.pending {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
        }

        .status-toggle-btn {
          padding: 0.35rem 0.75rem;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
        }

        .status-toggle-btn.btn-suspend {
          background: rgba(244, 63, 94, 0.12);
          color: #fda4af;
          border-color: rgba(244, 63, 94, 0.3);
        }

        .status-toggle-btn.btn-activate {
          background: rgba(16, 185, 129, 0.12);
          color: #6ee7b7;
          border-color: rgba(16, 185, 129, 0.3);
        }

        .live-count-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.25rem 0.6rem;
          background: rgba(244, 63, 94, 0.15);
          color: #fda4af;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
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

        .text-emerald { color: #10b981; }
        .text-indigo { color: #818cf8; }
        .text-amber { color: #f59e0b; }
        .font-bold { font-weight: 700; }
        .code-font { font-family: monospace; font-size: 0.8rem; }
      `}</style>
    </div>
  );
};

export default SuperAdminPage;
