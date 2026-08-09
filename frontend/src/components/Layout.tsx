import React from 'react';
import { LogOut, LayoutDashboard, Wallet as WalletIcon, Video } from 'lucide-react';

interface LayoutProps {
  user: { email: string } | null;
  currentPage?: string;
  onLogout: () => void;
  onNavigate: (page: 'dashboard' | 'wallet') => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, currentPage, onLogout, onNavigate, children }) => {
  return (
    <div className="layout-container">
      <nav className="glass sticky-nav">
        <div className="nav-content">
          <div className="logo" onClick={() => onNavigate('dashboard')} style={{ cursor: 'pointer' }}>
            <Video className="logo-icon" />
            <span>SVSM Platform</span>
          </div>
          
          <div className="nav-links">
            <button 
              onClick={() => onNavigate('dashboard')} 
              className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
            >
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </button>
            <button 
              onClick={() => onNavigate('wallet')} 
              className={`nav-link ${currentPage === 'wallet' ? 'active' : ''}`}
            >
              <WalletIcon size={20} />
              <span>Wallet</span>
            </button>
          </div>

          <div className="user-profile">
            <span className="user-email">{user?.email}</span>
            <button onClick={onLogout} className="logout-btn" title="Logout">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content animate-fade-in">
        {children}
      </main>

      <style>{`
        .layout-container {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        .sticky-nav {
          position: sticky;
          top: 1rem;
          margin: 0 1rem;
          padding: 0.75rem 1.5rem;
          z-index: 100;
          border-radius: 20px;
        }

        .nav-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-weight: 700;
          font-size: 1.2rem;
          color: var(--primary);
        }

        .logo-icon {
          color: var(--primary);
        }

        .nav-links {
          display: flex;
          gap: 1.5rem;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-weight: 500;
          transition: var(--transition-fast);
          padding: 0.5rem 1rem;
          border-radius: 12px;
        }

        .nav-link:hover {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.05);
        }

        .nav-link.active {
          color: white;
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid rgba(99, 102, 241, 0.4);
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .user-email {
          font-size: 0.9rem;
          color: var(--text-muted);
        }

        .logout-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
          padding: 0.5rem;
          border-radius: 8px;
        }

        .logout-btn:hover {
          color: var(--accent);
          background: rgba(244, 63, 94, 0.1);
        }

        .main-content {
          flex: 1;
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }
      `}</style>
    </div>
  );
};

export default Layout;
