import React, { useState } from 'react';
import { Plus, Play, Calendar, Users, Clock, Search, Filter, Video } from 'lucide-react';

interface DashboardProps {
  onJoinRoom: () => void;
  onGoToWallet: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onJoinRoom, onGoToWallet }) => {
  const [sessions] = useState([
    { id: '1', title: 'Product Launch Event', type: 'Live Stream', status: 'Live Now', participantsCount: 156, date: 'Today' },
    { id: '2', title: 'Weekly Team Sync', type: 'Video Call', status: 'Upcoming', participantsCount: 12, date: '2:00 PM' },
    { id: '3', title: 'Community AMA', type: 'Live Stream', status: 'Scheduled', participantsCount: 0, date: 'Tomorrow' },
  ]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Welcome back, Facilitator</h1>
          <p className="subtitle">Manage your streaming sessions and participants</p>
        </div>
        <button className="create-session-btn" onClick={() => alert('Feature coming soon: Session Creation')}>
          <Plus size={20} />
          Create Session
        </button>
      </header>

      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-icon"><Video size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Sessions</span>
            <span className="stat-value">24</span>
          </div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-icon"><Users size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Participants</span>
            <span className="stat-value">1.4k</span>
          </div>
        </div>
        <div className="stat-card glass-card clickable" onClick={onGoToWallet}>
          <div className="stat-icon"><Clock size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Wallet Balance</span>
            <span className="stat-value">$124.50</span>
          </div>
        </div>
      </div>

      <div className="sessions-section">
        <div className="section-header">
          <h2>Your Sessions</h2>
          <div className="search-bar">
            <Search size={18} />
            <input type="text" placeholder="Search sessions..." />
          </div>
          <button className="filter-btn" onClick={() => alert('Filter options coming soon')}>
            <Filter size={18} />
            Filter
          </button>
        </div>

        <div className="sessions-grid">
          {sessions.map(session => (
            <div key={session.id} className="session-card glass-card">
              <div className="session-status">
                <span className={`status-badge ${session.status.toLowerCase().replace(' ', '-')}`}>
                  {session.status}
                </span>
                <span className="session-type">{session.type}</span>
              </div>
              
              <h3 className="session-title">{session.title}</h3>
              
              <div className="session-meta">
                <div className="meta-item">
                  <Calendar size={14} />
                  <span>{session.date}</span>
                </div>
                <div className="meta-item">
                  <Users size={14} />
                  <span>{session.participantsCount} participants</span>
                </div>
              </div>

              <div className="session-actions">
                {session.status === 'Live Now' ? (
                  <button className="join-btn active" onClick={onJoinRoom}>
                    <Play size={16} /> Join Live
                  </button>
                ) : (
                  <button className="join-btn">
                    Configure
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

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

        .filter-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: none;
          border: 1px solid var(--glass-border);
          color: var(--text-main);
          padding: 0.5rem 1rem;
          border-radius: 10px;
          cursor: pointer;
          transition: var(--transition-fast);
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

        .status-badge.live-now {
          background: rgba(244, 63, 94, 0.1);
          color: var(--accent);
          border: 1px solid rgba(244, 63, 94, 0.2);
          animation: pulse 2s infinite;
        }

        .status-badge.upcoming { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
        .status-badge.scheduled { color: var(--text-muted); background: rgba(255, 255, 255, 0.05); }

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
