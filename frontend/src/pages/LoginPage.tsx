import React, { useState } from 'react';
import { Video, ShieldCheck, Zap, Globe } from 'lucide-react';

interface LoginPageProps {
  onLogin: (email: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (!isLogin && !companyName) return;

    setError('');
    setIsLoading(true);

    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
    const payload = isLogin ? { email, password } : { email, password, companyName };

    try {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
      
      onLogin(data.user.email);
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="hero-section">
        <div className="logo-large">
          <Video size={48} className="logo-icon" />
          <h1>SVSM Platform</h1>
        </div>
        <p className="hero-subtitle">Premium White-Label Video & Live Streaming</p>
        
        <div className="features-grid">
          <div className="feature-item">
            <ShieldCheck size={24} />
            <span>Secure & Scalable</span>
          </div>
          <div className="feature-item">
            <Zap size={24} />
            <span>Low Latency</span>
          </div>
          <div className="feature-item">
            <Globe size={24} />
            <span>Global Reach</span>
          </div>
        </div>
      </div>

      <div className="login-box glass-card animate-fade-in">
        <h2>{isLogin ? 'Facilitator Login' : 'Create Account'}</h2>
        <p className="login-desc">
          {isLogin 
            ? 'Enter your credentials to manage your sessions'
            : 'Join SVSM to start streaming and managing participants'}
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label>Company Name</label>
              <input 
                type="text" 
                placeholder="Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              placeholder="facilitator@example.com"
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
            {isLoading ? 'Processing...' : (isLogin ? 'Access Dashboard' : 'Register Account')}
          </button>

          <button 
            type="button" 
            className="demo-submit" 
            onClick={() => {
              const demoUser = {
                id: 'demo-user-123',
                email: 'facilitator@demo.svsm.io',
                companyName: 'Acme Streaming Inc.',
                pricingTier: 'standard',
                status: 'active'
              };
              localStorage.setItem('auth_token', 'demo_jwt_token_svsm');
              localStorage.setItem('user', JSON.stringify(demoUser));
              onLogin(demoUser.email);
            }}
          >
            ⚡ Quick Demo Access (Frontend Mode)
          </button>
        </form>
        
        <div className="login-footer">
          <a href="#" onClick={(e) => {
            e.preventDefault();
            setIsLogin(!isLogin);
            setError('');
          }}>
            {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
          </a>
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
          background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.1), transparent),
                      radial-gradient(circle at bottom left, rgba(244, 63, 94, 0.05), transparent);
        }

        .hero-section {
          max-width: 450px;
        }

        .logo-large {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .logo-large h1 {
          font-size: 2.5rem;
          font-weight: 800;
          background: linear-gradient(135deg, var(--text-main), var(--primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-subtitle {
          font-size: 1.2rem;
          color: var(--text-muted);
          margin-bottom: 2.5rem;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .login-box {
          width: 100%;
          max-width: 400px;
          padding: 2.5rem;
        }

        .login-box h2 {
          font-size: 1.8rem;
          margin-bottom: 0.5rem;
        }

        .login-desc {
          color: var(--text-muted);
          margin-bottom: 2rem;
          font-size: 0.95rem;
        }

        .error-message {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
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
          background: var(--primary);
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
          background: var(--primary-hover);
          transform: translateY(-1px);
        }

        .login-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .demo-submit {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: #a7f3d0;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: var(--transition-fast);
          margin-top: 0.75rem;
        }

        .demo-submit:hover {
          background: rgba(16, 185, 129, 0.15);
          border-color: rgba(16, 185, 129, 0.4);
          transform: translateY(-1px);
        }

        .login-footer {
          display: flex;
          justify-content: center;
          gap: 1rem;
          margin-top: 2rem;
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

        .divider {
          color: var(--glass-border);
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
