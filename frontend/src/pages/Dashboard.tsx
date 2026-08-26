import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Play, 
  Calendar, 
  Users, 
  Clock, 
  Search, 
  Video, 
  Copy, 
  Check, 
  X, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle,
  Sparkles,
  Zap,
  ShieldCheck,
  Radio
} from 'lucide-react';
import { API_BASE } from '../config';
import { BillingMarketplaceModal } from '../components/BillingMarketplaceModal';
import type { UserPackageStatus } from '../../../shared/types';

interface Session {
  id: string;
  title: string;
  channelName: string;
  status: string;
  participantCount: number;
  createdAt: string;
}

interface DashboardProps {
  onJoinRoom: (sessionId: string) => void;
  onGoToWallet: () => void;
}

// ── Inline Toast System ─────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: number; type: ToastType; message: string; }
let _toastId = 0;
const useDashToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);
  const removeToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  return { toasts, addToast, removeToast };
};
// ────────────────────────────────────────────────────────────────────────────

const Dashboard: React.FC<DashboardProps> = ({ onJoinRoom, onGoToWallet }) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [packageStatus, setPackageStatus] = useState<UserPackageStatus | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDuration, setNewDuration] = useState('60');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useDashToast();

  // Read real user info from localStorage
  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
  const displayName = storedUser.companyName || storedUser.name || storedUser.email?.split('@')[0] || 'Host';

  useEffect(() => {
    fetchBalance();
    fetchPackageStatus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSessions();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filter]);

  const fetchBalance = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/billing/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance ?? 0);
      } else {
        setBalance(null);
      }
    } catch (e) {
      setBalance(null);
    }
  };

  const fetchPackageStatus = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/billing/packages/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPackageStatus(data);
      }
    } catch (e) {
      console.warn('[Dashboard] Could not fetch package status');
    }
  };

  const fetchSessions = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      // Default to active+scheduled; only show ended when explicitly filtered
      if (filter) {
        query.append('status', filter);
      } else {
        // Show active and scheduled but not ended by default
        query.append('excludeStatus', 'ended');
      }

      const response = await fetch(`${API_BASE}/api/v1/sessions?${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setSessions(await response.json());
      } else {
        setSessions([]);
      }
    } catch (e) {
      setSessions([]);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      addToast('Please enter a session title', 'warning');
      return;
    }

    const token = localStorage.getItem('auth_token');
    setIsCreating(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/sessions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          title: newTitle.trim(),
          description: newDescription.trim() || undefined
        })
      });
      
      const data = await response.json();

      if (response.ok) {
        setNewTitle('');
        setNewDescription('');
        setIsModalOpen(false);
        addToast('Live stream session created successfully!', 'success');
        await fetchSessions();
        if (data.session?.id) {
          onJoinRoom(data.session.id);
        }
      } else {
        if (response.status === 402 || data.error?.includes('balance') || data.error?.includes('package')) {
          addToast(data.error || 'Host package required to start sessions', 'warning');
          setIsModalOpen(false);
          setIsBillingModalOpen(true);
        } else {
          addToast(data.error || 'Failed to create session. Please try again.', 'error');
        }
      }
    } catch (e) {
      console.error(e);
      addToast('Network error — could not create session.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = (sessionId: string) => {
    const joinUrl = `${window.location.origin}/join/${sessionId}`;
    navigator.clipboard.writeText(joinUrl);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="dashboard">
      {/* ── Toast Container ── */}
      <div className="toast-container">
        {toasts.map(t => {
          const icon = t.type === 'success' ? <CheckCircle size={18} /> : t.type === 'error' ? <AlertCircle size={18} /> : <AlertTriangle size={18} />;
          return (
            <div key={t.id} className={`toast-item toast-${t.type}`}>
              <span className="toast-icon">{icon}</span>
              <span className="toast-msg">{t.message}</span>
              <button className="toast-close" onClick={() => removeToast(t.id)}><X size={14} /></button>
            </div>
          );
        })}
      </div>
      <header className="dashboard-header">
        <div>
          <h1>Welcome back, {displayName}</h1>
          <p className="subtitle">Manage your streaming sessions and participants</p>
        </div>
        <button className="create-session-btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={20} />
          Create Session
        </button>
      </header>

      {/* ── Stats Grid with Host Package Card ── */}
      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-icon"><Video size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Sessions</span>
            <span className="stat-value">{sessions.length}</span>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon"><Users size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Participants</span>
            <span className="stat-value">{sessions.reduce((acc, s) => acc + (s.participantCount || 0), 0)}</span>
          </div>
        </div>

        <div className="stat-card glass-card clickable" onClick={() => setIsBillingModalOpen(true)}>
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Sparkles size={24} />
          </div>
          <div className="stat-info" style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label">Host Package</span>
              <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 600 }}>Change Tier ↗</span>
            </div>
            <span className="stat-value" style={{ fontSize: '1.25rem' }}>
              {packageStatus?.package?.name || (packageStatus?.hasPackage ? 'Host Plan' : 'Free Tier')}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {packageStatus?.packageMinutesRemaining !== undefined
                ? `${packageStatus.packageMinutesRemaining.toLocaleString()} mins left`
                : '3,000 mins included'}
            </span>
          </div>
        </div>

        <div className="stat-card glass-card clickable" onClick={onGoToWallet}>
          <div className="stat-icon"><Clock size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Wallet Balance</span>
            <span className="stat-value">{balance !== null ? `$${balance.toFixed(2)}` : '...'}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {storedUser?.overageConsent ? 'Auto-Overage: ON' : '1-Click Top-Up'}
            </span>
          </div>
        </div>
      </div>

      <div className="sessions-section">
        <div className="section-header">
          <h2>Your Sessions</h2>
          <div className="search-bar">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search sessions..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="filter-select" 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active Now</option>
            <option value="scheduled">Scheduled</option>
            <option value="ended">Ended</option>
          </select>
        </div>

        <div className="sessions-grid">
          {sessions.length === 0 && <p className="text-muted">No sessions yet. Create one to get started.</p>}
          {sessions.map(session => (
            <div key={session.id} className="session-card glass-card">
              <div className="session-status">
                <span className={`status-badge ${session.status.toLowerCase().replace(' ', '-')}`}>
                  {session.status}
                </span>
                <span className="session-type">Live Stream</span>
              </div>
              
              <h3 className="session-title">{session.title}</h3>
              
              <div className="session-meta">
                <div className="meta-item">
                  <Calendar size={14} />
                  <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="meta-item">
                  <Users size={14} />
                  <span>{session.participantCount} participants</span>
                </div>
              </div>

              <div className="session-actions">
                {session.status === 'active' || session.status === 'scheduled' ? (
                  <>
                    <div className="action-row">
                      <button className="join-btn active" onClick={() => onJoinRoom(session.id)}>
                        <Play size={16} /> Join Room
                      </button>
                      <button 
                        className="copy-btn" 
                        onClick={() => handleCopyLink(session.id)}
                        title="Copy Share Link"
                      >
                        {copiedId === session.id ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                      </button>
                    </div>
                    {session.status === 'active' && (
                      <button 
                        className="end-session-row-btn" 
                        onClick={async () => {
                          if (confirm('End this session for everyone?')) {
                            const token = localStorage.getItem('auth_token');
                            const res = await fetch(`${API_BASE}/api/v1/sessions/${session.id}/end`, {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (res.ok) {
                              addToast('Session ended successfully.', 'success');
                            } else {
                              addToast('Failed to end session. Please try again.', 'error');
                            }
                            fetchSessions();
                          }
                        }}
                      >
                        End Session
                      </button>
                    )}
                  </>
                ) : (
                  <button className="join-btn disabled" disabled>Session Ended</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Complete Session Studio Modal ── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content glass-card session-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.5rem', background: 'rgba(99, 102, 241, 0.2)', borderRadius: '10px', color: '#818cf8' }}>
                  <Radio size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Create Streaming Session</h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Instant ultra-low latency broadcast with live chat &amp; participant management
                  </span>
                </div>
              </div>
              <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Host Package Status Banner */}
            <div className="session-balance-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Sparkles size={16} color="#818cf8" />
                <span>
                  Host Plan: <strong>{packageStatus?.package?.name || 'Standard'}</strong>
                </span>
                <span className="balance-pill">
                  {packageStatus?.packageMinutesRemaining !== undefined
                    ? `${packageStatus.packageMinutesRemaining.toLocaleString()} mins available`
                    : 'Minutes Active'}
                </span>
              </div>
              <button 
                type="button" 
                className="upgrade-link-btn"
                onClick={() => {
                  setIsModalOpen(false);
                  setIsBillingModalOpen(true);
                }}
              >
                Change Package ↗
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="session-form">
              {/* Session Title */}
              <div className="form-group">
                <label>Session Title *</label>
                <input 
                  type="text" 
                  placeholder="e.g. All-Hands Executive Briefing or Masterclass" 
                  value={newTitle} 
                  onChange={(e) => setNewTitle(e.target.value)} 
                  autoFocus 
                  required
                  className="session-input"
                />
              </div>

              {/* Session Description / Agenda */}
              <div className="form-group">
                <label>Agenda / Description (Optional)</label>
                <textarea 
                  placeholder="e.g. Keynotes, interactive audience Q&amp;A, and product announcements..." 
                  value={newDescription} 
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  className="session-textarea"
                />
              </div>

              {/* Target Duration Selector */}
              <div className="form-group">
                <label>Estimated Session Duration</label>
                <div className="duration-selector-row">
                  {['30', '45', '60', '90', '120'].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={`duration-chip ${newDuration === mins ? 'active' : ''}`}
                      onClick={() => setNewDuration(mins)}
                    >
                      {mins} mins
                    </button>
                  ))}
                </div>
              </div>

              {/* Broadcast Features Info Grid */}
              <div className="session-features-box">
                <div className="session-feat-item">
                  <Zap size={16} color="#10b981" />
                  <span>Ultra-Low Latency RTC Video</span>
                </div>
                <div className="session-feat-item">
                  <Users size={16} color="#818cf8" />
                  <span>Real-Time Agora Chat Room</span>
                </div>
                <div className="session-feat-item">
                  <ShieldCheck size={16} color="#f59e0b" />
                  <span>Auto Low-Balance Alert Protection</span>
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="modal-cancel-btn"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isCreating || !newTitle.trim()}
                  className="modal-submit-btn"
                >
                  {isCreating ? (
                    <span>Launching Session...</span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Play size={16} /> Launch Live Stream
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Billing Marketplace Modal ── */}
      <BillingMarketplaceModal
        isOpen={isBillingModalOpen}
        onClose={() => setIsBillingModalOpen(false)}
        currentPackageSlug={packageStatus?.package?.slug}
        onSuccess={(pkgSlug) => {
          addToast(`Package upgraded to ${pkgSlug.toUpperCase()}!`, 'success');
          fetchPackageStatus();
          fetchBalance();
        }}
      />

      <style>{`
        .toast-container {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          z-index: 9999;
          pointer-events: none;
        }

        .toast-item {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          font-size: 0.88rem;
          font-weight: 500;
          min-width: 280px;
          max-width: 400px;
          pointer-events: all;
          animation: toastIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(12px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }

        @keyframes toastIn {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .toast-success { background: rgba(16,185,129,0.18); border: 1px solid rgba(16,185,129,0.45); color: #6ee7b7; }
        .toast-error   { background: rgba(244,63,94,0.18);  border: 1px solid rgba(244,63,94,0.45);  color: #fda4af; }
        .toast-warning { background: rgba(245,158,11,0.18); border: 1px solid rgba(245,158,11,0.45); color: #fcd34d; }
        .toast-info    { background: rgba(99,102,241,0.18); border: 1px solid rgba(99,102,241,0.45); color: #a5b4fc; }

        .toast-icon { flex-shrink: 0; }
        .toast-msg  { flex: 1; }
        .toast-close {
          background: none;
          border: none;
          cursor: pointer;
          color: inherit;
          opacity: 0.6;
          padding: 0;
          display: flex;
          align-items: center;
        }
        .toast-close:hover { opacity: 1; }

        .dashboard {
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .dashboard-header h1 {
          font-size: 2rem;
          margin-bottom: 0.25rem;
        }

        .subtitle {
          color: var(--text-muted);
        }

        .create-session-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--primary);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .create-session-btn:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
        }

        .stat-card {
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }

        .stat-card.clickable {
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .stat-card.clickable:hover {
          border-color: var(--primary);
          background: rgba(99, 102, 241, 0.1);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(99, 102, 241, 0.1);
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-info {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
        }

        .sessions-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .search-bar {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          padding: 0.5rem 1rem;
          border-radius: 10px;
          color: var(--text-muted);
        }

        .search-bar input {
          background: none;
          border: none;
          color: white;
          width: 100%;
          outline: none;
        }

        .filter-select {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 10px;
          cursor: pointer;
          outline: none;
          transition: var(--transition-fast);
        }
        .filter-select option {
          background: #1e1e24;
          color: white;
        }

        .sessions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .session-card {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .session-status {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .status-badge.active {
          background: rgba(244, 63, 94, 0.1);
          color: var(--accent);
          border: 1px solid rgba(244, 63, 94, 0.2);
          animation: pulse 2s infinite;
        }

        .status-badge.scheduled { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
        .status-badge.ended { color: var(--text-muted); background: rgba(255, 255, 255, 0.05); }

        .session-type {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .session-title {
          font-size: 1.25rem;
          font-weight: 700;
        }

        .session-meta {
          display: flex;
          gap: 1rem;
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .join-btn {
          width: 100%;
          padding: 0.75rem;
          border-radius: 10px;
          border: 1px solid var(--glass-border);
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-main);
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .join-btn.active {
          background: var(--primary);
          border: none;
        }

        .join-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .join-btn.active:hover {
          background: var(--primary-hover);
        }

        .end-session-row-btn {
          margin-top: 0.5rem;
          width: 100%;
          padding: 0.75rem;
          background: rgba(244, 63, 94, 0.1);
          color: var(--accent);
          border: 1px solid rgba(244, 63, 94, 0.2);
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .end-session-row-btn:hover {
          background: var(--accent);
          color: white;
        }

        .action-row {
          display: flex;
          gap: 0.5rem;
          width: 100%;
        }

        .copy-btn {
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition-fast);
        }

        .copy-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .modal-content {
          width: 100%;
          max-width: 480px;
          padding: 2rem;
          background: #1e293b;
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          animation: fadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h3 {
          font-size: 1.3rem;
          font-weight: 700;
        }

        .close-modal-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 6px;
          transition: var(--transition-fast);
        }

        .close-modal-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .session-modal-card {
          max-width: 560px;
          background: #131722;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .session-balance-banner {
          margin-top: 1rem;
          margin-bottom: 1.25rem;
          padding: 0.75rem 1rem;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.86rem;
        }

        .balance-pill {
          padding: 0.2rem 0.6rem;
          background: rgba(16, 185, 129, 0.2);
          border: 1px solid rgba(16, 185, 129, 0.4);
          color: #6ee7b7;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .upgrade-link-btn {
          background: none;
          border: none;
          color: #818cf8;
          font-weight: 600;
          font-size: 0.8rem;
          cursor: pointer;
          padding: 0;
          transition: var(--transition-fast);
        }

        .upgrade-link-btn:hover {
          color: #a5b4fc;
          text-decoration: underline;
        }

        .session-form {
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }

        .session-form .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .session-form label {
          font-size: 0.88rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
        }

        .session-input, .session-textarea {
          width: 100%;
          padding: 0.8rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          color: white;
          font-family: inherit;
          font-size: 0.95rem;
          outline: none;
          transition: var(--transition-fast);
        }

        .session-input:focus, .session-textarea:focus {
          border-color: var(--primary);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }

        .session-textarea {
          resize: vertical;
          min-height: 75px;
        }

        .duration-selector-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .duration-chip {
          padding: 0.45rem 0.9rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          color: var(--text-muted);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .duration-chip:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .duration-chip.active {
          background: rgba(99, 102, 241, 0.25);
          border-color: #818cf8;
          color: white;
        }

        .session-features-box {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.5rem;
          padding: 0.85rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 12px;
        }

        .session-feat-item {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.82rem;
          color: rgba(255, 255, 255, 0.75);
        }

        .modal-cancel-btn {
          padding: 0.75rem 1.25rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          color: var(--text-muted);
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .modal-cancel-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .modal-submit-btn {
          padding: 0.75rem 1.5rem;
          background: var(--primary);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .modal-submit-btn:hover:not(:disabled) {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }

        .modal-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
