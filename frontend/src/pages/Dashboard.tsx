import React, { useState, useEffect } from 'react';
import { Plus, Play, Calendar, Users, Clock, Search, Video, Copy, Check, X } from 'lucide-react';

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

const Dashboard: React.FC<DashboardProps> = ({ onJoinRoom, onGoToWallet }) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchBalance();
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
      const response = await fetch('http://localhost:3001/api/v1/billing/balance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance);
      } else {
        setBalance(250.00); // Demo fallback
      }
    } catch (e) {
      setBalance(250.00); // Demo fallback
    }
  };

  const MOCK_SESSIONS: Session[] = [
    {
      id: 'sess-demo-1',
      title: 'Global Product Keynote & Live Q&A 2026',
      channelName: 'f_demo_1',
      status: 'active',
      participantCount: 42,
      createdAt: new Date().toISOString()
    },
    {
      id: 'sess-demo-2',
      title: 'Q3 Financial Strategy Briefing',
      channelName: 'f_demo_2',
      status: 'scheduled',
      participantCount: 18,
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'sess-demo-3',
      title: 'Engineering Architecture All-Hands',
      channelName: 'f_demo_3',
      status: 'ended',
      participantCount: 115,
      createdAt: new Date(Date.now() - 259200000).toISOString()
    }
  ];

  const fetchSessions = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (filter) query.append('status', filter);

      const response = await fetch(`http://localhost:3001/api/v1/sessions?${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setSessions(await response.json());
      } else {
        setSessions(MOCK_SESSIONS);
      }
    } catch (e) {
      setSessions(MOCK_SESSIONS);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const token = localStorage.getItem('auth_token');
    setIsCreating(true);
    try {
      const response = await fetch('http://localhost:3001/api/v1/sessions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ title: newTitle })
      });
      
      if (response.ok) {
        setNewTitle('');
        setIsModalOpen(false);
        await fetchSessions();
      } else {
        alert('Failed to create session');
      }
    } catch (e) {
      console.error(e);
      alert('Error creating session');
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
      <header className="dashboard-header">
        <div>
          <h1>Welcome back, Facilitator</h1>
          <p className="subtitle">Manage your streaming sessions and participants</p>
        </div>
        <button className="create-session-btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={20} />
          Create Session
        </button>
      </header>

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
        <div className="stat-card glass-card clickable" onClick={onGoToWallet}>
          <div className="stat-icon"><Clock size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Wallet Balance</span>
            <span className="stat-value">{balance !== null ? `$${balance.toFixed(2)}` : '...'}</span>
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
                            await fetch(`http://localhost:3001/api/v1/sessions/${session.id}/end`, {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
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

      {/* ── Custom Glass Modal ── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Session</h3>
              <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateSession}>
              <div className="form-group" style={{ margin: '1.5rem 0' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Session Title
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. All-Hands Executive Briefing" 
                  value={newTitle} 
                  onChange={(e) => setNewTitle(e.target.value)} 
                  autoFocus 
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '10px',
                    color: 'white',
                    outline: 'none'
                  }}
                />
              </div>
              <div className="modal-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '10px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isCreating || !newTitle.trim()}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--primary)',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isCreating ? 'Creating...' : 'Launch Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
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
