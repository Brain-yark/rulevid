import React, { useState } from 'react';
import { Video, ShieldCheck, Zap, Globe, User, Users, Sparkles, Key } from 'lucide-react';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import type { UserRole } from '../../../shared/types';

interface LoginPageProps {
  onLogin: (email: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const toast = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.warning('Input Required', 'Please enter your email and password.');
      return;
    }
    if (!isLogin && !name) {
      toast.warning('Input Required', 'Please enter your name.');
      return;
    }

    setError('');
    setIsLoading(true);

    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
    const payload = isLogin
      ? { email: email.trim(), password }
      : {
          email: email.trim(),
          password,
          name: name.trim(),
          role,
          companyName: companyName.trim() || undefined,
        };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Store token and user data
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      const assignedRole = (data.user.role || 'user').toUpperCase();
      if (isLogin) {
        toast.success(
          'Welcome Back!',
          `Signed in successfully as ${data.user.name || data.user.email} (${assignedRole}).`
        );
      } else {
        toast.success(
          'Account Created!',
          `Welcome to SVSM! You are registered as ${assignedRole}.`
        );
      }

      onLogin(data.user.email);
    } catch (err: any) {
      const errMsg = err.message || 'Network error';
      setError(errMsg);
      toast.error('Authentication Error', errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const autofillSuperAdmin = () => {
    setIsLogin(true);
    setEmail('superadmin@svsm.io');
    setPassword('SuperAdmin@2026!');
    toast.info('Super Admin Selected', 'Credentials loaded for superadmin@svsm.io');
  };

  return (
    <div className="login-container">
      <div className="hero-section">
        <div className="logo-large">
          <Video size={48} className="logo-icon" />
          <h1>SVSM Live 2.0</h1>
        </div>
        <p className="hero-subtitle">
          Next-Generation Live Experience & Community Monetization Platform
        </p>

        <div className="features-grid">
          <div className="feature-item">
            <ShieldCheck size={24} className="feature-icon" />
            <div>
              <strong>CIA Security</strong>
              <span>Gated access & verified credentials</span>
            </div>
          </div>
          <div className="feature-item">
            <Zap size={24} className="feature-icon" />
            <div>
              <strong>Low-Latency RTC</strong>
              <span>Ultra-responsive HD video & chat</span>
            </div>
          </div>
          <div className="feature-item">
            <Sparkles size={24} className="feature-icon" />
            <div>
              <strong>Monetized Seats</strong>
              <span>Instant Stripe Checkout & ticketing</span>
            </div>
          </div>
          <div className="feature-item">
            <Globe size={24} className="feature-icon" />
            <div>
              <strong>Role Scoped</strong>
              <span>Host, Attendee, & Admin controls</span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-box glass-card animate-fade-in">
        <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
        <p className="login-desc">
          {isLogin
            ? 'Access your SVSM account, tickets, and live sessions'
            : 'Join SVSM to attend experiences or host your own community events'}
        </p>

        {!isLogin && (
          <div className="role-selector-group">
            <label className="role-label">Choose Account Type:</label>
            <div className="role-buttons">
              <button
                type="button"
                className={`role-btn ${role === 'user' ? 'active' : ''}`}
                onClick={() => setRole('user')}
              >
                <User size={18} />
                <div>
                  <span className="role-title">Attendee</span>
                  <span className="role-sub">Attend live events</span>
                </div>
              </button>

              <button
                type="button"
                className={`role-btn ${role === 'host' ? 'active' : ''}`}
                onClick={() => setRole('host')}
              >
                <Users size={18} />
                <div>
                  <span className="role-title">Facilitator / Host</span>
                  <span className="role-sub">Create &amp; lead sessions</span>
                </div>
              </button>
            </div>
            <p className="role-note">🛡️ Moderator access is granted by a Host from their dashboard.</p>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label>Your Name *</label>
              <input
                type="text"
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          {!isLogin && (role === 'host' || role === 'moderator') && (
            <div className="form-group">
              <label>Company / Organization Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Acme Media or Creator Brand"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-submit" disabled={isLoading}>
            {isLoading ? (
              <span>Authenticating...</span>
            ) : isLogin ? (
              <span>Sign In</span>
            ) : (
              <span>Register as {role === 'host' ? 'Host' : role === 'moderator' ? 'Moderator' : 'Attendee'}</span>
            )}
          </button>
        </form>

        <div className="login-footer">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setIsLogin(!isLogin);
              setError('');
            }}
          >
            {isLogin
              ? "Don't have an account? Register now"
              : 'Already have an account? Sign In'}
          </a>

          <button
            type="button"
            className="superadmin-autofill-btn"
            onClick={autofillSuperAdmin}
          >
            <Key size={14} />
            <span>Use Super Admin Credentials</span>
          </button>
        </div>
      </div>

      <style>{`
        .login-container {
          display: flex;
          min-height: 100vh;
          align-items: center;
          justify-content: center;
          gap: 4rem;
          padding: 2rem;
          background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.15), transparent),
                      radial-gradient(circle at bottom left, rgba(244, 63, 94, 0.08), transparent);
        }

        .hero-section {
          max-width: 480px;
        }

        .logo-large {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .logo-large h1 {
          font-size: 2.6rem;
          font-weight: 800;
          background: linear-gradient(135deg, var(--text-main), var(--primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-subtitle {
          font-size: 1.15rem;
          color: var(--text-muted);
          margin-bottom: 2.5rem;
          line-height: 1.5;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
        }

        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .feature-item strong {
          display: block;
          color: var(--text-main);
          font-size: 0.95rem;
          margin-bottom: 0.2rem;
        }

        .feature-icon {
          color: var(--primary);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .login-box {
          width: 100%;
          max-width: 440px;
          padding: 2.5rem;
        }

        .login-box h2 {
          font-size: 1.8rem;
          margin-bottom: 0.5rem;
        }

        .login-desc {
          color: var(--text-muted);
          margin-bottom: 1.5rem;
          font-size: 0.92rem;
          line-height: 1.4;
        }

        .role-selector-group {
          margin-bottom: 1.5rem;
        }

        .role-label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .role-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .role-btn {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.75rem 0.85rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
          text-align: left;
        }

        .role-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(99, 102, 241, 0.3);
        }

        .role-btn.active {
          background: rgba(99, 102, 241, 0.15);
          border-color: var(--primary);
          color: white;
        }

        .role-title {
          display: block;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .role-sub {
          display: block;
          font-size: 0.72rem;
          opacity: 0.8;
        }

        .role-note {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-top: 0.6rem;
          opacity: 0.85;
        }

        .error-message {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          padding: 0.75rem;
          border-radius: 10px;
          margin-bottom: 1.5rem;
          font-size: 0.88rem;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .form-group {
          margin-bottom: 1.25rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.4rem;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-muted);
        }

        .form-group input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          color: white;
          transition: var(--transition-fast);
        }

        .form-group input:focus {
          outline: none;
          border-color: var(--primary);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        }

        .login-submit {
          width: 100%;
          padding: 0.85rem;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: var(--transition-fast);
          margin-top: 1rem;
        }

        .login-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
        }

        .login-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-footer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          margin-top: 1.75rem;
          font-size: 0.9rem;
        }

        .login-footer a {
          color: var(--text-muted);
          text-decoration: none;
          transition: var(--transition-fast);
        }

        .login-footer a:hover {
          color: var(--primary);
        }

        .superadmin-autofill-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.9rem;
          background: rgba(244, 63, 94, 0.1);
          border: 1px dashed rgba(244, 63, 94, 0.35);
          color: #fda4af;
          border-radius: 20px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .superadmin-autofill-btn:hover {
          background: rgba(244, 63, 94, 0.2);
          border-color: #f43f5e;
          color: white;
        }

        @media (max-width: 900px) {
          .login-container {
            flex-direction: column;
            gap: 2rem;
            padding: 1rem;
          }
          .hero-section {
            text-align: center;
          }
          .logo-large {
            justify-content: center;
          }
          .features-grid {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;

