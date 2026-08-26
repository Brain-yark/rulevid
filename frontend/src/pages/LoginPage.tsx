import React, { useState } from 'react';
import {
  Radio,
  ShieldCheck,
  Zap,
  Globe,
  User,
  Users,
  Sparkles,
  Key,
  Check,
  Clock,
  ArrowRight,
  CreditCard,
} from 'lucide-react';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import type { UserRole } from '../../../shared/types';
import { FALLBACK_PACKAGES } from '../components/BillingMarketplaceModal';

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
  const [packageSlug, setPackageSlug] = useState<string>('free');
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

    // If host registering, package selection is mandatory
    if (!isLogin && role === 'host' && !packageSlug) {
      toast.warning('Billing Package Required', 'Please select a host billing package to continue.');
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
          packageSlug: role === 'host' ? packageSlug : undefined,
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
          `Welcome to RuleVid! You are registered as ${assignedRole}.`
        );
      }

      // If a paid host package was selected with Stripe checkout URL, redirect
      if (!isLogin && data.checkoutUrl) {
        toast.info('Redirecting to Stripe', 'Completing your package subscription...');
        window.location.href = data.checkoutUrl;
        return;
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

  const selectPlanAndRegister = (slug: string) => {
    setIsLogin(false);
    setRole('host');
    setPackageSlug(slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info('Plan Selected', `Chosen ${slug.toUpperCase()} plan for your host account.`);
  };

  return (
    <div className="landing-wrapper">
      {/* Top Navigation Bar */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="logo-brand">
            <div className="login-logo-badge">
              <Radio size={24} className="logo-icon" />
            </div>
            <span className="brand-title">RuleVid</span>
          </div>

          <div className="nav-actions">
            <a href="#pricing" className="nav-pricing-link">
              <Sparkles size={16} />
              <span>Pricing &amp; Plans</span>
            </a>
            <button
              type="button"
              className="nav-signin-btn"
              onClick={() => {
                setIsLogin(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Hero & Auth Section */}
      <div className="login-container">
        <div className="hero-section">
          <div className="hero-badge">
            <Sparkles size={16} />
            <span>Next-Gen Video Experience Platform</span>
          </div>
          <h1 className="hero-title">Monetize Live Sessions with Ultra Low Latency RTC</h1>
          <p className="hero-subtitle">
            Scale masterclasses, conferences, and gated community events. Automatic in-stream low balance alerts, 1-click top-ups, and flexible participant-minute packages.
          </p>

          <div className="features-grid">
            <div className="feature-item">
              <ShieldCheck size={24} className="feature-icon" />
              <div>
                <strong>CIA Security</strong>
                <span>Gated access &amp; verified host credentials</span>
              </div>
            </div>
            <div className="feature-item">
              <Zap size={24} className="feature-icon" />
              <div>
                <strong>Ultra-Low Latency</strong>
                <span>Instant HD broadcast &amp; Agora Chat</span>
              </div>
            </div>
            <div className="feature-item">
              <CreditCard size={24} className="feature-icon" />
              <div>
                <strong>Flexible Marketplace</strong>
                <span>Free tier or transparent per-minute plans</span>
              </div>
            </div>
            <div className="feature-item">
              <Globe size={24} className="feature-icon" />
              <div>
                <strong>Auto Overage Protection</strong>
                <span>1-click card on file keeps streams alive</span>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Box */}
        <div className="login-box glass-card animate-fade-in">
          <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
          <p className="login-desc">
            {isLogin
              ? 'Access your RuleVid account, tickets, and live sessions'
              : 'Join RuleVid as an Attendee or Host with transparent participant-minute billing'}
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
                    <span className="role-sub">Attend live experiences</span>
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
                    <span className="role-sub">Create &amp; monetize events</span>
                  </div>
                </button>
              </div>
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

            {!isLogin && role === 'host' && (
              <div className="form-group">
                <label>Company / Studio Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Media or Creator Brand"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            )}

            {/* Mandatory Package Selection for Hosts during signup */}
            {!isLogin && role === 'host' && (
              <div className="signup-package-section">
                <label className="package-section-title">
                  <span>Select Host Billing Package * (Required)</span>
                </label>
                <p className="package-section-sub">
                  Choose a monthly plan. Minutes renew every 30 days with $10 overage protection.
                </p>

                <div className="signup-packages-grid">
                  {FALLBACK_PACKAGES.map((pkg) => {
                    const isSelected = packageSlug === pkg.slug;
                    return (
                      <div
                        key={pkg.slug}
                        className={`signup-pkg-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => setPackageSlug(pkg.slug)}
                      >
                        <div className="signup-pkg-header">
                          <strong>{pkg.name}</strong>
                          <span className="signup-pkg-price">
                            {pkg.isCustom ? 'Custom' : `$${pkg.priceCents / 100}`}
                          </span>
                        </div>
                        <span className="signup-pkg-mins">
                          {pkg.participantMinutes.toLocaleString()} mins
                        </span>
                        <span className="signup-pkg-desc">{pkg.roughlyCovers}</span>
                        {isSelected && <div className="pkg-selected-indicator"><Check size={12} /></div>}
                      </div>
                    );
                  })}
                </div>
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
                <span>
                  Register as {role === 'host' ? `Host (${packageSlug.toUpperCase()})` : 'Attendee'}
                </span>
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
      </div>

      {/* ── Landing Page Pricing & Billing Marketplace Section ── */}
      <section id="pricing" className="landing-pricing-section">
        <div className="pricing-header">
          <div className="pricing-badge">
            <Sparkles size={16} />
            <span>Marketplace Pricing</span>
          </div>
          <h2>Simple, Transparent Host Packages</h2>
          <p className="pricing-subtitle">
            Every host chooses a participant-minute plan tailored to their audience size. Unused minutes roll over monthly, and 1-click overage protection ensures your stream never cuts out unexpectedly.
          </p>
        </div>

        <div className="pricing-cards-grid">
          {FALLBACK_PACKAGES.map((pkg) => {
            const isPopular = pkg.slug === 'starter';
            return (
              <div key={pkg.slug} className={`landing-pricing-card ${isPopular ? 'popular' : ''}`}>
                {isPopular && <div className="pricing-popular-tag">MOST POPULAR</div>}

                <div className="card-top">
                  <h3 className="card-tier-name">{pkg.name}</h3>
                  <div className="card-price-row">
                    <span className="card-price-val">
                      {pkg.isCustom ? 'Custom' : `$${pkg.priceCents / 100}`}
                    </span>
                    {!pkg.isCustom && <span className="card-price-mo">/ month</span>}
                  </div>
                  <p className="card-desc">{pkg.description}</p>
                </div>

                <div className="card-minutes-box">
                  <Clock size={16} />
                  <span><strong>{pkg.participantMinutes.toLocaleString()}</strong> participant-mins</span>
                </div>

                <div className="card-coverage-box">
                  <span>Covers: {pkg.roughlyCovers}</span>
                </div>

                <ul className="card-features-list">
                  <li>
                    <Check size={16} className="feat-icon" />
                    <span>Effective rate: <strong>{pkg.effectiveRatePer1k || '$1.00/1k'}</strong></span>
                  </li>
                  <li>
                    <Check size={16} className="feat-icon" />
                    <span>30-Day Auto Monthly Reset</span>
                  </li>
                  <li>
                    <Check size={16} className="feat-icon" />
                    <span>In-Stream Low Balance Warnings</span>
                  </li>
                  <li>
                    <Check size={16} className="feat-icon" />
                    <span>1-Click Top Up &amp; $10 Auto-Overage</span>
                  </li>
                </ul>

                <button
                  type="button"
                  className={`card-cta-btn ${isPopular ? 'popular-btn' : ''}`}
                  onClick={() => selectPlanAndRegister(pkg.slug)}
                >
                  <span>Select {pkg.name} Plan</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>© 2026 RuleVid Live Experiences. All rights reserved.</p>
      </footer>

      <style>{`
        .landing-wrapper {
          min-height: 100vh;
          background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.15), transparent),
                      radial-gradient(circle at bottom left, rgba(244, 63, 94, 0.08), transparent),
                      #0f111a;
          color: white;
          font-family: inherit;
        }

        .landing-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(12px);
          background: rgba(15, 17, 26, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 1rem 2rem;
        }

        .landing-nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .logo-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .brand-title {
          font-size: 1.5rem;
          font-weight: 800;
          background: linear-gradient(135deg, #ffffff 40%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .nav-pricing-link {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          color: #c7d2fe;
          text-decoration: none;
          font-weight: 600;
          font-size: 0.92rem;
          transition: color 0.2s ease;
        }

        .nav-pricing-link:hover {
          color: white;
        }

        .nav-signin-btn {
          padding: 0.5rem 1.25rem;
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid rgba(99, 102, 241, 0.4);
          color: white;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.88rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .nav-signin-btn:hover {
          background: #6366f1;
        }

        .login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4rem;
          padding: 4rem 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .hero-section {
          flex: 1;
          max-width: 520px;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.85rem;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.35);
          border-radius: 20px;
          color: #a5b4fc;
          font-size: 0.8rem;
          font-weight: 700;
          margin-bottom: 1.25rem;
        }

        .login-logo-badge {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45);
        }

        .hero-title {
          font-size: 2.8rem;
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin-bottom: 1.2rem;
          background: linear-gradient(135deg, #ffffff 40%, #c7d2fe 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-subtitle {
          font-size: 1.1rem;
          color: var(--text-muted);
          margin-bottom: 2.5rem;
          line-height: 1.55;
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
          max-width: 480px;
          padding: 2.25rem;
          border-radius: 20px;
          background: rgba(26, 28, 48, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .login-box h2 {
          font-size: 1.8rem;
          margin-bottom: 0.4rem;
        }

        .login-desc {
          color: var(--text-muted);
          margin-bottom: 1.25rem;
          font-size: 0.9rem;
          line-height: 1.4;
        }

        .role-selector-group {
          margin-bottom: 1.25rem;
        }

        .role-label {
          display: block;
          margin-bottom: 0.4rem;
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
          background: rgba(99, 102, 241, 0.18);
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

        /* Signup Host Package Selection */
        .signup-package-section {
          margin-bottom: 1.25rem;
          padding: 1rem;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 14px;
        }

        .package-section-title {
          display: block;
          font-size: 0.85rem;
          font-weight: 700;
          color: #a5b4fc;
          margin-bottom: 0.2rem;
        }

        .package-section-sub {
          font-size: 0.76rem;
          color: var(--text-muted);
          margin-bottom: 0.75rem;
        }

        .signup-packages-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.6rem;
        }

        .signup-pkg-card {
          position: relative;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 0.65rem 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
        }

        .signup-pkg-card:hover {
          border-color: rgba(99, 102, 241, 0.4);
          background: rgba(99, 102, 241, 0.1);
        }

        .signup-pkg-card.selected {
          border-color: #6366f1;
          background: rgba(99, 102, 241, 0.25);
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
        }

        .signup-pkg-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.85rem;
          color: white;
          margin-bottom: 0.15rem;
        }

        .signup-pkg-price {
          font-weight: 700;
          color: #c7d2fe;
        }

        .signup-pkg-mins {
          font-size: 0.75rem;
          color: #a5b4fc;
          font-weight: 600;
        }

        .signup-pkg-desc {
          font-size: 0.68rem;
          color: var(--text-muted);
          margin-top: 0.2rem;
        }

        .pkg-selected-indicator {
          position: absolute;
          top: -6px;
          right: -6px;
          background: #6366f1;
          color: white;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .error-message {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          padding: 0.75rem;
          border-radius: 10px;
          margin-bottom: 1.25rem;
          font-size: 0.88rem;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .form-group {
          margin-bottom: 1.15rem;
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
          margin-top: 0.75rem;
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
          gap: 0.85rem;
          margin-top: 1.5rem;
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

        /* ── Pricing Section on Landing Page ── */
        .landing-pricing-section {
          padding: 6rem 2rem;
          max-width: 1200px;
          margin: 0 auto;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .pricing-header {
          text-align: center;
          margin-bottom: 3.5rem;
        }

        .pricing-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.85rem;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.35);
          border-radius: 20px;
          color: #a5b4fc;
          font-size: 0.8rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }

        .pricing-header h2 {
          font-size: 2.6rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 0.8rem;
        }

        .pricing-subtitle {
          color: var(--text-muted);
          max-width: 680px;
          margin: 0 auto;
          font-size: 1.05rem;
          line-height: 1.5;
        }

        .pricing-cards-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
        }

        .landing-pricing-card {
          position: relative;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          transition: all 0.3s ease;
        }

        .landing-pricing-card:hover {
          transform: translateY(-6px);
          border-color: rgba(99, 102, 241, 0.5);
          background: rgba(99, 102, 241, 0.06);
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);
        }

        .landing-pricing-card.popular {
          border-color: rgba(244, 63, 94, 0.5);
          background: rgba(244, 63, 94, 0.04);
        }

        .pricing-popular-tag {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
          color: white;
          font-size: 0.68rem;
          font-weight: 800;
          padding: 0.25rem 0.8rem;
          border-radius: 12px;
          letter-spacing: 0.05em;
          box-shadow: 0 4px 12px rgba(244, 63, 94, 0.4);
        }

        .card-top {
          margin-bottom: 1.25rem;
        }

        .card-tier-name {
          font-size: 1.4rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .card-price-row {
          display: flex;
          align-items: baseline;
          gap: 0.35rem;
          margin-bottom: 0.6rem;
        }

        .card-price-val {
          font-size: 2.2rem;
          font-weight: 800;
          color: white;
        }

        .card-price-mo {
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .card-desc {
          color: var(--text-muted);
          font-size: 0.82rem;
          line-height: 1.4;
          min-height: 48px;
        }

        .card-minutes-box {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 10px;
          color: #c7d2fe;
          font-size: 0.82rem;
          margin-bottom: 0.75rem;
        }

        .card-coverage-box {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-bottom: 1.5rem;
          min-height: 36px;
        }

        .card-features-list {
          list-style: none;
          padding: 0;
          margin: 0 0 2rem 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          flex: 1;
        }

        .card-features-list li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          font-size: 0.82rem;
          color: #d1d5db;
          line-height: 1.35;
        }

        .feat-icon {
          color: #10b981;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .card-cta-btn {
          width: 100%;
          padding: 0.8rem 1rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--glass-border);
          color: white;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }

        .card-cta-btn:hover {
          background: #6366f1;
          border-color: #6366f1;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
        }

        .card-cta-btn.popular-btn {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border: none;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
        }

        .landing-footer {
          text-align: center;
          padding: 2.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        @media (max-width: 990px) {
          .login-container {
            flex-direction: column;
            gap: 3rem;
            padding: 2rem 1rem;
          }
          .pricing-cards-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 600px) {
          .pricing-cards-grid {
            grid-template-columns: 1fr;
          }
          .signup-packages-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
