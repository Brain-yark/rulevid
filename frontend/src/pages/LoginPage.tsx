import React, { useState } from 'react';
import { Video, ShieldCheck, Zap, Globe } from 'lucide-react';

interface LoginPageProps {
  onLogin: (email: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      onLogin(email);
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
        <h2>Facilitator Login</h2>
        <p className="login-desc">Enter your credentials to manage your sessions</p>

        <form onSubmit={handleSubmit}>
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
          <button type="submit" className="login-submit">
            Access Dashboard
          </button>
        </form>
        
        <div className="login-footer">
          <a href="#">Forgot password?</a>
          <span className="divider">|</span>
          <a href="#">Support</a>
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

        .login-submit:hover {
          background: var(--primary-hover);
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
