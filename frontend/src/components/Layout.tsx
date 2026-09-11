import React, { useState } from 'react';
import { LogOut, LayoutDashboard, Wallet as WalletIcon, Ticket, ShieldAlert, TrendingUp, Radio } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { BillingMarketplaceModal } from './BillingMarketplaceModal';
import type { UserRole } from '../../../shared/types';

interface LayoutUser {
  id?: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  role?: UserRole;
  billingPackageId?: string;
  packageMinutesTotal?: number;
}

interface LayoutProps {
  user: LayoutUser | null;
  currentPage?: string;
  onLogout: () => void;
  onNavigate: (page: 'events' | 'dashboard' | 'wallet' | 'super-admin' | 'profile' | 'analytics') => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, currentPage, onLogout, onNavigate, children }) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const role = user?.role || 'user';
  const isHost = role === 'host' || role === 'admin' || role === 'moderator' || role === 'super_admin';
  const isAdmin = role === 'admin' || role === 'super_admin';

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : user?.email.charAt(0).toUpperCase() || 'U';

  return (
    <div className="layout-container">
      <nav className="glass sticky-nav">
        <div className="nav-content">
          <div className="logo" onClick={() => onNavigate('events')} style={{ cursor: 'pointer' }}>
            <div className="logo-badge">
              <Radio className="logo-icon" size={20} />
            </div>
            <span className="brand-name">RuleVid</span>
          </div>

          <div className="nav-links">
            <button
              onClick={() => onNavigate('events')}
              className={`nav-link ${currentPage === 'events' ? 'active' : ''}`}
            >
              <Ticket size={18} />
              <span>Browse Events</span>
            </button>

            {isHost && (
              <button
                onClick={() => onNavigate('dashboard')}
                className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
              >
                <LayoutDashboard size={18} />
                <span>Host Studio</span>
              </button>
            )}

            {isHost && (
              <button
                onClick={() => onNavigate('analytics')}
                className={`nav-link ${currentPage === 'analytics' ? 'active' : ''}`}
              >
                <TrendingUp size={18} />
                <span>Analytics</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => onNavigate('super-admin')}
                className={`nav-link ${currentPage === 'super-admin' ? 'active super-admin-active' : ''}`}
              >
                <ShieldAlert size={18} className="nav-shield-icon" />
                <span>Super Admin</span>
              </button>
            )}

            <button
              onClick={() => onNavigate('wallet')}
              className={`nav-link ${currentPage === 'wallet' ? 'active' : ''}`}
            >
              <WalletIcon size={18} />
              <span>Billing &amp; Wallet</span>
            </button>
          </div>

          <div className="user-profile">
            <button
              className={`user-profile-btn ${currentPage === 'profile' ? 'profile-active' : ''}`}
              onClick={() => onNavigate('profile')}
              title="View & Edit My Profile"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name || user.email} className="nav-avatar-img" />
              ) : (
                <div className="nav-avatar-initial">{initial}</div>
              )}
              <div className="user-info-group">
                <div className="user-name-row">
                  <span className="user-name">{user?.name || user?.email.split('@')[0]}</span>
                  <span className={`user-role-pill role-${role}`}>
                    {role === 'host'
                      ? 'HOST'
                      : role === 'admin'
                      ? 'ADMIN'
                      : role === 'moderator'
                      ? 'MOD'
                      : role === 'super_admin'
                      ? 'SUPER ADMIN'
                      : 'ATTENDEE'}
                  </span>
                </div>
                <span className="user-email">{user?.email}</span>
              </div>
            </button>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="logout-btn"
              title="Sign Out of RuleVid"
            >
              <LogOut size={18} />
            </button>
          </div>

          {/* Hamburger (mobile only) */}
          <button
            className="hamburger-btn"
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {/* Mobile Drawer */}
        <div className={`mobile-drawer${mobileMenuOpen ? ' open' : ''}`}>
          <button onClick={() => { onNavigate('events'); setMobileMenuOpen(false); }} className={`nav-link ${currentPage === 'events' ? 'active' : ''}`}>
            <Ticket size={18} /><span>Browse Events</span>
          </button>
          {isHost && (
            <button onClick={() => { onNavigate('dashboard'); setMobileMenuOpen(false); }} className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}>
              <LayoutDashboard size={18} /><span>Host Studio</span>
            </button>
          )}
          {isHost && (
            <button onClick={() => { onNavigate('analytics'); setMobileMenuOpen(false); }} className={`nav-link ${currentPage === 'analytics' ? 'active' : ''}`}>
              <TrendingUp size={18} /><span>Analytics</span>
            </button>
          )}
          {isAdmin && (
            <button onClick={() => { onNavigate('super-admin'); setMobileMenuOpen(false); }} className={`nav-link ${currentPage === 'super-admin' ? 'active super-admin-active' : ''}`}>
              <ShieldAlert size={18} className="nav-shield-icon" /><span>Super Admin</span>
            </button>
          )}
          <button onClick={() => { onNavigate('wallet'); setMobileMenuOpen(false); }} className={`nav-link ${currentPage === 'wallet' ? 'active' : ''}`}>
            <WalletIcon size={18} /><span>Billing &amp; Wallet</span>
          </button>
          <div className="mobile-profile-row" onClick={() => { onNavigate('profile'); setMobileMenuOpen(false); }}>
            {user?.avatarUrl ? <img src={user.avatarUrl} alt={user.name || user.email} className="nav-avatar-img" /> : <div className="nav-avatar-initial">{initial}</div>}
            <div className="user-info-group">
              <div className="user-name-row">
                <span className="user-name">{user?.name || user?.email.split('@')[0]}</span>
                <span className={`user-role-pill role-${role}`}>{role === 'super_admin' ? 'SUPER ADMIN' : role.toUpperCase()}</span>
              </div>
              <span className="user-email">{user?.email}</span>
            </div>
          </div>
          <button onClick={() => { setShowLogoutConfirm(true); setMobileMenuOpen(false); }} className="nav-link" style={{ color: '#f87171', marginTop: '0.25rem' }}>
            <LogOut size={18} /><span>Sign Out</span>
          </button>
        </div>
      </nav>

      <main className="main-content animate-fade-in">{children}</main>

      <ConfirmationModal
        isOpen={showLogoutConfirm}
        title="Sign Out of RuleVid"
        message="Are you sure you want to end your current session? You will need to log back in to access live rooms and your dashboard."
        confirmText="Sign Out"
        cancelText="Stay Signed In"
        variant="danger"
        iconType="logout"
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <BillingMarketplaceModal
        isOpen={showBillingModal}
        onClose={() => setShowBillingModal(false)}
        onSuccess={() => {
          setShowBillingModal(false);
          onNavigate('dashboard');
        }}
        title="Upgrade to Host: Choose Your Billing Tier"
        subtitle="Select a participant-minute plan to start hosting, scheduling, and monetizing your events on RuleVid."
      />

      <style>{`
        .layout-container {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        /* ── Top Nav ── */
        .sticky-nav {
          position: sticky;
          top: 1rem;
          margin: 0 1rem;
          padding: 0.65rem 1.25rem;
          z-index: 100;
          border-radius: 18px;
        }

        .nav-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          gap: 1rem;
        }

        /* ── Logo ── */
        .logo {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-weight: 800;
          font-size: 1.25rem;
          letter-spacing: -0.02em;
          flex-shrink: 0;
          cursor: pointer;
        }

        .logo-badge {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
          flex-shrink: 0;
        }

        .brand-name {
          background: linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 800;
        }

        .logo-icon { color: white; }

        /* ── Nav Links ── */
        .nav-links {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          flex: 1;
          justify-content: center;
        }

        .nav-link {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: none;
          border: 1px solid transparent;
          color: var(--text-muted);
          cursor: pointer;
          font-weight: 500;
          font-size: 0.875rem;
          transition: var(--transition-fast);
          padding: 0.45rem 0.85rem;
          border-radius: 10px;
          white-space: nowrap;
          line-height: 1;
        }

        .nav-link svg {
          flex-shrink: 0;
          display: block;
        }

        .nav-link span {
          display: block;
        }

        .nav-link:hover {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.06);
        }

        .nav-link.active {
          color: white;
          background: rgba(99, 102, 241, 0.18);
          border: 1px solid rgba(99, 102, 241, 0.4);
        }

        .nav-link.super-admin-active {
          background: rgba(244, 63, 94, 0.18);
          border: 1px solid rgba(244, 63, 94, 0.4);
          color: #fecdd3;
        }

        .nav-shield-icon { color: #f43f5e; }

        /* ── User Profile ── */
        .user-profile {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-shrink: 0;
        }

        .user-profile-btn {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 0.3rem 0.7rem 0.3rem 0.4rem;
          cursor: pointer;
          transition: var(--transition-fast);
          color: inherit;
          text-align: left;
        }

        .user-profile-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(99, 102, 241, 0.3);
        }

        .user-profile-btn.profile-active {
          background: rgba(99, 102, 241, 0.18);
          border-color: rgba(99, 102, 241, 0.45);
        }

        .nav-avatar-img,
        .nav-avatar-initial {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        }

        .nav-avatar-initial {
          background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.82rem;
          color: white;
        }

        .user-info-group {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.1rem;
        }

        .user-name-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .user-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-main);
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .user-role-pill {
          font-size: 0.62rem;
          font-weight: 800;
          padding: 0.12rem 0.4rem;
          border-radius: 5px;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }

        .role-host { background: rgba(99,102,241,0.2); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.35); }
        .role-user { background: rgba(16,185,129,0.15); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.3); }
        .role-moderator { background: rgba(59,130,246,0.2); color: #93c5fd; border: 1px solid rgba(59,130,246,0.35); }
        .role-admin,
        .role-super_admin { background: rgba(244,63,94,0.2); color: #fda4af; border: 1px solid rgba(244,63,94,0.35); }

        .user-email { font-size: 0.73rem; color: var(--text-muted); }

        .logout-btn {
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
          padding: 0.45rem;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .logout-btn:hover {
          color: var(--accent);
          background: rgba(244,63,94,0.15);
          border-color: rgba(244,63,94,0.3);
        }

        /* ── Main Content ── */
        .main-content {
          flex: 1;
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        /* ── Hamburger Button (mobile only) ── */
        .hamburger-btn {
          display: none;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 9px;
          color: var(--text-main);
          cursor: pointer;
          padding: 0.4rem 0.5rem;
          flex-direction: column;
          gap: 4px;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .hamburger-btn span {
          display: block;
          width: 20px;
          height: 2px;
          background: currentColor;
          border-radius: 2px;
          transition: 0.2s;
        }

        /* ── Mobile Drawer ── */
        .mobile-drawer {
          display: none;
          flex-direction: column;
          gap: 0.3rem;
          padding: 0.75rem 1rem;
          border-top: 1px solid rgba(255,255,255,0.07);
          margin-top: 0.5rem;
        }

        .mobile-drawer.open { display: flex; }

        .mobile-drawer .nav-link {
          width: 100%;
          justify-content: flex-start;
          padding: 0.65rem 1rem;
          border-radius: 10px;
          font-size: 0.93rem;
        }

        .mobile-drawer .user-info-group { display: flex; }

        .mobile-profile-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.65rem 1rem;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          margin-top: 0.35rem;
          cursor: pointer;
        }

        /* ── Responsive breakpoints ── */
        @media (max-width: 900px) {
          .sticky-nav {
            top: 0.5rem;
            margin: 0 0.5rem;
          }

          .nav-links span {
            display: none;
          }

          .nav-link {
            padding: 0.45rem 0.55rem;
          }

          .user-name { display: none; }
          .user-email { display: none; }
          .user-role-pill { display: none; }
        }

        @media (max-width: 640px) {
          .sticky-nav {
            top: 0;
            margin: 0;
            border-radius: 0;
            position: fixed;
            left: 0;
            right: 0;
            width: 100%;
          }

          .main-content {
            padding: 1rem;
            padding-top: calc(70px + 1rem);
          }

          .nav-links {
            display: none;
          }

          .hamburger-btn {
            display: flex;
          }

          .user-info-group {
            display: none;
          }

          .brand-name { font-size: 1.05rem; }
          .logo { gap: 0.4rem; }
        }
      `}</style>
    </div>
  );
};

export default Layout;
