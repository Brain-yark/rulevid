import React, { useState, useEffect } from 'react';
import {
  Radio,
  ShieldCheck,
  Zap,
  Globe,
  User,
  Sparkles,
  Check,
  Clock,
  CreditCard,
  Mail,
  CheckCircle2,
} from 'lucide-react';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import type { BillingPackage } from '../../../shared/types';
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
  const [packages, setPackages] = useState<BillingPackage[]>(FALLBACK_PACKAGES);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<{ message: string; email?: string } | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/billing/packages`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPackages(data);
        }
      })
      .catch(() => {
        // Fallback to FALLBACK_PACKAGES
      });

    // Check for email verification token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const verifyToken = urlParams.get('verify') || urlParams.get('token');
    if (verifyToken) {
      setIsLoading(true);
      fetch(`${API_BASE}/api/v1/auth/verify-email?token=${encodeURIComponent(verifyToken)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setVerificationSuccess('🎉 Your email has been confirmed! Please sign in below.');
            setVerificationNotice(null);
            setIsLogin(true);
            if (data.email) setEmail(data.email);
            toast.success('Email Confirmed!', 'Your Ruleboard account is verified and ready. Please sign in.');
          } else {
            setError(data.error || 'Verification link is invalid or expired.');
            if (data.email) {
              setVerificationNotice({ message: data.error, email: data.email });
            }
            toast.error('Verification Failed', data.error || 'Invalid verification link');
          }
        })
        .catch(() => {
          setError('Network error verifying email.');
        })
        .finally(() => {
          setIsLoading(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, []);

  const handleResendVerification = async (targetEmail: string) => {
    if (!targetEmail) {
      toast.warning('Email Required', 'Please enter your email to resend the verification link.');
      return;
    }
    setIsResending(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend email');
      toast.success('Confirmation Sent', data.message || `Verification link sent to ${targetEmail}`);
      setVerificationNotice({
        message: `A new verification link has been sent to ${targetEmail}. Please check your inbox and spam folder.`,
        email: targetEmail,
      });
    } catch (err: any) {
      toast.error('Resend Failed', err.message);
    } finally {
      setIsResending(false);
    }
  };

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
          role: 'user',
        };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.requiresVerification) {
          setVerificationNotice({
            message: data.error || 'Please confirm your email address before signing in.',
            email: data.email || email.trim(),
          });
        }
        throw new Error(data.error || 'Authentication failed');
      }

      // After registration, smoothly return user to the sign-in form
      if (!isLogin) {
        setIsLogin(true);
        setPassword('');
        setVerificationSuccess('🎉 Account created successfully! Please enter your password to sign in.');
        setVerificationNotice(null);
        toast.success(
          'Account Created!',
          'Your account has been created. Please sign in.'
        );
        return;
      }

      // Store token and user data
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      const assignedRole = (data.user.role || 'user').toUpperCase();

      toast.success(
        'Welcome Back!',
        `Signed in successfully as ${data.user.name || data.user.email} (${assignedRole}).`
      );

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

  const selectPlanAndRegister = (slug: string) => {
    toast.info('Coming Soon', `The ${slug.toUpperCase()} package will be available soon. Host accounts are provisioned exclusively by the platform administrator for MVP testing.`);
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
              : 'Create an Attendee account to reserve tickets and join live broadcast experiences'}
          </p>

          {!isLogin && (
            <div className="role-selector-group">
              <div className="attendee-pill-badge">
                <User size={20} className="text-primary" />
                <div>
                  <strong className="role-title" style={{ display: 'block', color: 'var(--text-primary)' }}>
                    Attendee Account (Free)
                  </strong>
                  <span className="role-sub" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Instant access to live events, RTC audio/video, and interactive chat
                  </span>
                </div>
              </div>
              <div className="mvp-admin-notice-pill">
                <ShieldCheck size={14} className="text-amber" />
                <span>Host accounts are manually provisioned by the administrator for the MVP.</span>
              </div>
            </div>
          )}

          {verificationSuccess && (
            <div className="verification-banner verification-banner-success">
              <CheckCircle2 size={20} className="banner-icon-success" />
              <div className="verification-banner-text">
                <strong>Email Confirmed!</strong>
                <p>{verificationSuccess}</p>
              </div>
            </div>
          )}

          {verificationNotice && (
            <div className="verification-banner verification-banner-notice">
              <div className="verification-banner-inner">
                <Mail size={20} className="banner-icon-notice" />
                <div className="verification-banner-text">
                  <strong>Confirmation Required</strong>
                  <p>{verificationNotice.message}</p>
                </div>
              </div>
              <button
                type="button"
                className="resend-verification-btn"
                onClick={() => handleResendVerification(verificationNotice.email || email)}
                disabled={isResending}
              >
                {isResending ? 'Sending...' : 'Resend Verification Email'}
              </button>
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
                <span>Register as Attendee</span>
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
                setVerificationNotice(null);
                setVerificationSuccess(null);
              }}
            >
              {isLogin
                ? "Don't have an account? Register now"
                : 'Already have an account? Sign In'}
            </a>
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
          {packages.map((pkg) => {
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

                <div className="card-coverage-box" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span>Max Capacity: <strong>{pkg.maxParticipantsPerSession ? `${pkg.maxParticipantsPerSession.toLocaleString()} participants / session` : '10 / session'}</strong></span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Covers: {pkg.roughlyCovers}</span>
                </div>

                <ul className="card-features-list">
                  <li>
                    <Check size={16} className="feat-icon" />
                    <span>Up to <strong>{pkg.maxParticipantsPerSession ?? 10}</strong> max participants / session</span>
                  </li>
                  <li>
                    <Check size={16} className="feat-icon" />
                    <span>Effective rate: <strong>{pkg.effectiveRatePer1k || '$2.00/1k'}</strong></span>
                  </li>
                  <li>
                    <Check size={16} className="feat-icon" />
                    <span>30-Day Monthly Reset &amp; Rollover</span>
                  </li>
                  <li>
                    <Check size={16} className="feat-icon" />
                    <span>Low-Balance Warning Alerts</span>
                  </li>
                  <li>
                    <Check size={16} className="feat-icon" />
                    <span>{pkg.hasRecording ? 'Full HD Cloud Recording Included' : 'Basic Recording'}</span>
                  </li>
                  <li>
                    <Check size={16} className="feat-icon" />
                    <span>{pkg.hasAutoOverage ? '1-Click Top-Up & $10 Auto-Overage' : '1-Click Top-Up (No Auto-Overage)'}</span>
                  </li>
                  <li>
                    <Check size={16} className="feat-icon" />
                    <span>Interactive HD RTC &amp; Agora Chat</span>
                  </li>
                </ul>

                <button
                  type="button"
                  className="card-cta-btn btn-disabled-coming-soon"
                  onClick={() => selectPlanAndRegister(pkg.slug)}
                >
                  <span>Coming Soon</span>
                  <Sparkles size={15} />
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
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .attendee-pill-badge {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.85rem 1rem;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 12px;
          text-align: left;
        }

        .mvp-admin-notice-pill {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 8px;
          font-size: 0.78rem;
          color: #fbbf24;
          line-height: 1.35;
        }

        .btn-disabled-coming-soon {
          background: rgba(255, 255, 255, 0.06) !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          color: #94a3b8 !important;
          cursor: not-allowed !important;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
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

        /* ── Verification Banners ── */
        .verification-banner {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem;
          border-radius: 12px;
          margin-bottom: 1.25rem;
          font-size: 0.88rem;
          line-height: 1.45;
          animation: fadeIn 0.3s ease-in-out;
        }

        .verification-banner-inner {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .verification-banner-success {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #d1fae5;
          display: flex;
          flex-direction: row;
          align-items: center;
        }

        .banner-icon-success {
          color: #10b981;
          flex-shrink: 0;
        }

        .verification-banner-notice {
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.35);
          color: #e0e7ff;
        }

        .banner-icon-notice {
          color: #818cf8;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .verification-banner-text strong {
          display: block;
          color: #ffffff;
          font-weight: 600;
          margin-bottom: 0.2rem;
        }

        .verification-banner-text p {
          margin: 0;
          color: #c7d2fe;
          font-size: 0.84rem;
        }

        .resend-verification-btn {
          align-self: flex-start;
          padding: 0.4rem 0.85rem;
          background: rgba(99, 102, 241, 0.25);
          border: 1px solid rgba(99, 102, 241, 0.5);
          color: #ffffff;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-left: 2.2rem;
        }

        .resend-verification-btn:hover:not(:disabled) {
          background: rgba(99, 102, 241, 0.4);
          border-color: #818cf8;
        }

        .resend-verification-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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
