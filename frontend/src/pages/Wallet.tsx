import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  DollarSign,
  ExternalLink,
  Shield,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { API_BASE } from '../config';

interface WalletProps {
  onBack: () => void;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  balanceAfter: number;
  description?: string;
  status: string;
  createdAt: string;
}

const WALLET_API = `${API_BASE}/api/v1`;

const Wallet: React.FC<WalletProps> = () => {
  const [balance, setBalance] = useState(0);
  const [pricingTier, setPricingTier] = useState<'standard' | 'premium'>('standard');
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isLoadingTx, setIsLoadingTx] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('100');
  const [isProcessing, setIsProcessing] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const getAuthHeader = () => {
    const token = localStorage.getItem('auth_token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchBalance = React.useCallback(async () => {
    setIsLoadingBalance(true);
    try {
      const res = await fetch(`${WALLET_API}/billing/balance`, {
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance ?? 0);
      } else {
        setBalance(0);
      }
    } catch (e) {
      setBalance(0);
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  const fetchTransactions = React.useCallback(async () => {
    setIsLoadingTx(true);
    try {
      const res = await fetch(`${WALLET_API}/billing/transactions`, {
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setTransactions(data);
      } else {
        setTransactions([]);
      }
    } catch (e) {
      setTransactions([]);
    } finally {
      setIsLoadingTx(false);
    }
  }, []);

  useEffect(() => {
    // Read user's pricing tier from localStorage
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        if (user.pricingTier === 'premium') setPricingTier('premium');
      }
    } catch (e) {
      console.error('[Wallet] Failed to parse user data:', e);
    }

    // Check for Stripe redirect results (show inline banner, not alert)
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      setBanner({ type: 'success', message: 'Payment successful! Your credits have been added.' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('canceled')) {
      setBanner({ type: 'error', message: 'Payment was canceled. No charges were made.' });
      window.history.replaceState({}, '', window.location.pathname);
    }

    fetchBalance();
    fetchTransactions();
  }, [fetchBalance, fetchTransactions]);

  const handleTopup = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${WALLET_API}/billing/topup`, {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(topupAmount) }),
      });
      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setBanner({ type: 'error', message: data.error || 'Failed to initiate payment.' });
        setIsProcessing(false);
      }
    } catch (e) {
      console.error('[Wallet] Topup failed:', e);
      setBanner({ type: 'error', message: 'Network error. Please try again.' });
      setIsProcessing(false);
    }
  };

  const handleManageBilling = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${WALLET_API}/billing/portal`, {
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setBanner({ 
          type: 'error', 
          message: data.error || 'Failed to open billing portal. Have you completed a top-up yet?' 
        });
        setIsProcessing(false);
      }
    } catch (e) {
      console.error('[Wallet] Portal access failed:', e);
      setBanner({ type: 'error', message: 'Network error. Please try again.' });
      setIsProcessing(false);
    }
  };

  // Estimated minutes remaining based on real balance & tier rate
  const ratePerMinute = pricingTier === 'premium' ? 0.004 : 0.003;
  const estimatedMinutes = balance > 0 ? Math.floor(balance / ratePerMinute) : 0;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="wallet-page animate-fade-in">
      {/* ── Inline Banner ── */}
      {banner && (
        <div className={`wallet-banner ${banner.type}`}>
          {banner.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
          <span>{banner.message}</span>
          <button className="banner-close" onClick={() => setBanner(null)}>×</button>
        </div>
      )}

      <header className="wallet-header">
        <div>
          <h1>Wallet &amp; Billing</h1>
          <p className="subtitle">Manage your pre-paid credits and view usage history</p>
        </div>
        <div className="header-actions">
          <button className="refresh-btn" onClick={() => { fetchBalance(); fetchTransactions(); }} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button className="topup-btn" onClick={() => setIsTopupModalOpen(true)}>
            <DollarSign size={20} /> Add Credits
          </button>
        </div>
      </header>

      <div className="wallet-grid">
        {/* ── Balance Card ── */}
        <div className="balance-card glass-card">
          <div className="balance-content">
            <span className="label">Current Balance</span>
            <span className="amount">
              {isLoadingBalance ? '...' : `$${balance.toFixed(2)}`}
            </span>
            <div className="balance-footer">
              <span className="estimate">
                ≈ {estimatedMinutes.toLocaleString()} minutes at ${ratePerMinute}/min
                <span className="tier-badge">{pricingTier}</span>
              </span>
            </div>
          </div>
          <div className="card-decoration">
            <CreditCard size={120} />
          </div>
        </div>

        {/* ── Security Card ── */}
        <div className="security-card glass">
          <Shield size={32} className="shield-icon" />
          <h3>Secure Payments</h3>
          <p>All transactions are processed via Stripe with 256-bit encryption. Your card details are never stored on our servers.</p>
          <button
            className="manage-stripe-btn"
            onClick={handleManageBilling}
            disabled={isProcessing}
          >
            {isProcessing ? 'Connecting...' : 'Manage Payment Methods'} <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* ── Transaction History ── */}
      <div className="history-section">
        <div className="section-header">
          <History size={20} />
          <h2>Transaction History</h2>
          {!isLoadingTx && <span className="tx-count">{transactions.length} records</span>}
        </div>

        <div className="transaction-list">
          {isLoadingTx ? (
            <div className="tx-loading">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="tx-empty">No transactions yet. Top up your wallet to get started.</div>
          ) : (
            transactions.map((tx) => {
              const isTopup = tx.type === 'topup';
              return (
                <div key={tx.id} className="transaction-item glass">
                  <div className="tx-icon-bg">
                    {isTopup
                      ? <ArrowUpRight color="#10b981" size={20} />
                      : <ArrowDownLeft color="#f43f5e" size={20} />
                    }
                  </div>
                  <div className="tx-details">
                    <span className="tx-type">{isTopup ? 'Top-up' : 'Usage Deduction'}</span>
                    <span className="tx-desc">{tx.description || '—'}</span>
                    <span className="tx-date">{formatDate(tx.createdAt)}</span>
                  </div>
                  <div className="tx-balance-after">
                    <span className="balance-label">Balance after</span>
                    <span className="balance-value">${tx.balanceAfter.toFixed(2)}</span>
                  </div>
                  <div className="tx-status">
                    <span className={`status-pill ${tx.status}`}>{tx.status}</span>
                  </div>
                  <div className={`tx-amount ${tx.amount >= 0 ? 'positive' : 'negative'}`}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)} {tx.currency}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Top-up Modal ── */}
      {isTopupModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-fade-in">
            <h2>Add Credits</h2>
            <p>Choose an amount to add to your RuleVid wallet.</p>

            <div className="amount-options">
              {['25', '50', '100', '250'].map((amt) => (
                <button
                  key={amt}
                  className={`amount-opt ${topupAmount === amt ? 'selected' : ''}`}
                  onClick={() => setTopupAmount(amt)}
                >
                  ${amt}
                  <span className="amount-opt-minutes">
                    ≈ {Math.floor(parseFloat(amt) / ratePerMinute).toLocaleString()} min
                  </span>
                </button>
              ))}
            </div>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => !isProcessing && setIsTopupModalOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                className="confirm-topup-btn"
                onClick={handleTopup}
                disabled={isProcessing}
              >
                {isProcessing ? 'Connecting to Stripe...' : `Pay $${topupAmount}.00`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .wallet-page {
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
        }

        .wallet-banner {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          font-weight: 500;
          position: relative;
        }
        .wallet-banner.success {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10b981;
        }
        .wallet-banner.error {
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.25);
          color: #f43f5e;
        }
        .banner-close {
          margin-left: auto;
          background: none;
          border: none;
          color: inherit;
          font-size: 1.4rem;
          cursor: pointer;
          line-height: 1;
          opacity: 0.7;
        }
        .banner-close:hover { opacity: 1; }

        .wallet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .refresh-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          padding: 0.6rem;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: var(--transition-fast);
        }
        .refresh-btn:hover { color: var(--text-main); background: rgba(255,255,255,0.1); }

        .topup-btn {
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
        .topup-btn:hover { background: var(--primary-hover); }

        .wallet-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
        }

        .balance-card {
          padding: 2.5rem;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(244, 63, 94, 0.1));
        }

        .balance-content { position: relative; z-index: 1; }
        .balance-content .label { display: block; color: var(--text-muted); margin-bottom: 0.5rem; }
        .balance-content .amount { font-size: 3.5rem; font-weight: 800; display: block; }

        .balance-footer { margin-top: 1.5rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

        .estimate {
          background: rgba(255, 255, 255, 0.05);
          padding: 0.4rem 0.8rem;
          border-radius: 8px;
          font-size: 0.9rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .tier-badge {
          background: rgba(99, 102, 241, 0.2);
          color: var(--primary);
          padding: 0.1rem 0.5rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .card-decoration {
          position: absolute;
          right: -20px;
          bottom: -20px;
          color: rgba(255, 255, 255, 0.03);
          transform: rotate(-15deg);
        }

        .security-card {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          justify-content: center;
        }
        .shield-icon { color: #10b981; }
        .security-card h3 { font-size: 1.1rem; }
        .security-card p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; }

        .manage-stripe-btn {
          background: none;
          border: 1px solid var(--glass-border);
          color: var(--text-main);
          padding: 0.5rem;
          border-radius: 8px;
          font-size: 0.85rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: var(--transition-fast);
        }
        .manage-stripe-btn:hover { background: rgba(255,255,255,0.05); }

        .history-section { display: flex; flex-direction: column; gap: 1.5rem; }

        .section-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .tx-count {
          margin-left: auto;
          font-size: 0.8rem;
          color: var(--text-muted);
          background: rgba(255,255,255,0.05);
          padding: 0.2rem 0.6rem;
          border-radius: 20px;
        }

        .transaction-list { display: flex; flex-direction: column; gap: 0.75rem; }

        .tx-loading, .tx-empty {
          padding: 2rem;
          text-align: center;
          color: var(--text-muted);
          background: rgba(255,255,255,0.02);
          border-radius: 12px;
          border: 1px dashed var(--glass-border);
        }

        .transaction-item {
          display: grid;
          grid-template-columns: auto 1fr auto auto auto;
          align-items: center;
          padding: 1rem 1.5rem;
          gap: 1.5rem;
        }

        .tx-icon-bg {
          width: 40px; height: 40px;
          background: rgba(255,255,255,0.03);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }

        .tx-details { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
        .tx-type { font-weight: 600; }
        .tx-desc { font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px; }
        .tx-date { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.1rem; }

        .tx-balance-after { display: flex; flex-direction: column; align-items: flex-end; gap: 0.1rem; }
        .balance-label { font-size: 0.7rem; color: var(--text-muted); }
        .balance-value { font-size: 0.9rem; font-weight: 600; color: var(--text-muted); }

        .status-pill {
          font-size: 0.75rem;
          padding: 0.2rem 0.6rem;
          border-radius: 20px;
        }
        .status-pill.completed { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-pill.pending   { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .status-pill.failed    { background: rgba(244, 63, 94, 0.1);  color: #f43f5e; }

        .tx-amount { font-weight: 700; font-family: monospace; font-size: 1rem; white-space: nowrap; }
        .tx-amount.positive { color: #10b981; }
        .tx-amount.negative { color: #f43f5e; }

        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1100;
        }

        .modal-content {
          padding: 2.5rem;
          width: 100%;
          max-width: 450px;
          text-align: center;
        }
        .modal-content h2 { margin-bottom: 0.5rem; }
        .modal-content p { color: var(--text-muted); margin-bottom: 0; }

        .amount-options {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          margin: 2rem 0;
        }

        .amount-opt {
          padding: 1rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          color: white;
          font-weight: 700;
          font-size: 1.1rem;
          cursor: pointer;
          transition: var(--transition-fast);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.3rem;
        }
        .amount-opt-minutes { font-size: 0.7rem; font-weight: 400; color: var(--text-muted); }
        .amount-opt:hover { background: rgba(255,255,255,0.1); }
        .amount-opt.selected { background: var(--primary); border-color: var(--primary); }
        .amount-opt.selected .amount-opt-minutes { color: rgba(255,255,255,0.7); }

        .modal-actions { display: flex; gap: 1rem; }

        .confirm-topup-btn {
          flex: 2;
          padding: 0.85rem;
          background: var(--primary);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .confirm-topup-btn:hover:not(:disabled) { background: var(--primary-hover); }
        .confirm-topup-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .cancel-btn {
          flex: 1;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          border-radius: 10px;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .cancel-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); }

        @media (max-width: 768px) {
          .wallet-grid { grid-template-columns: 1fr; }
          .transaction-item { grid-template-columns: auto 1fr auto; }
          .tx-balance-after { display: none; }
        }
      `}</style>
    </div>
  );
};

export default Wallet;
