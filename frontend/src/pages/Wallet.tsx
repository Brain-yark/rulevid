import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  History,
  DollarSign,
  ExternalLink,
  Shield,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import { BillingMarketplaceModal } from '../components/BillingMarketplaceModal';
import type { UserPackageStatus } from '../../../shared/types';

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
  const toast = useToast();
  const [packageStatus, setPackageStatus] = useState<UserPackageStatus | null>(null);
  const [isLoadingPackage, setIsLoadingPackage] = useState(true);
  const [isLoadingTx, setIsLoadingTx] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTogglingOverage, setIsTogglingOverage] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const getAuthHeader = () => {
    const token = localStorage.getItem('auth_token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchPackageStatus = React.useCallback(async () => {
    setIsLoadingPackage(true);
    try {
      const res = await fetch(`${WALLET_API}/billing/packages/status`, {
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (res.ok) {
        setPackageStatus(data);
      }
    } catch (e) {
      console.error('[Wallet] Failed to fetch package status:', e);
    } finally {
      setIsLoadingPackage(false);
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

    const params = new URLSearchParams(window.location.search);
    const isSuccess = params.get('success');
    const sessionId = params.get('session_id');

    if (isSuccess && sessionId) {
      // Verify payment with Stripe backend
      fetch(`${WALLET_API}/billing/verify-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ sessionId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.paid) {
            setBanner({ type: 'success', message: data.message || 'Payment verified! Host package activated.' });
            if (data.user) {
              const currentStored = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
              localStorage.setItem('user', JSON.stringify({ ...currentStored, ...data.user, role: 'host' }));
            }
            fetchPackageStatus();
            fetchTransactions();
          } else {
            setBanner({ type: 'error', message: data.error || 'Payment was not successful. No minutes or services have been granted.' });
          }
        })
        .catch(() => {
          setBanner({ type: 'error', message: 'Payment verification failed. Please contact support if your card was charged.' });
        });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('success')) {
      setBanner({ type: 'success', message: 'Payment successful! Your host package/credits have been activated.' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('canceled')) {
      setBanner({ type: 'error', message: 'Checkout was canceled. No charges were made and no host minutes were granted.' });
      window.history.replaceState({}, '', window.location.pathname);
    }

    fetchPackageStatus();
    fetchTransactions();
  }, [fetchPackageStatus, fetchTransactions]);

  const handleOneClickTopup = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${WALLET_API}/billing/one-click-topup`, {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('1-Click Top-Up Succeeded!', data.message);
        fetchPackageStatus();
        fetchTransactions();
      } else {
        toast.error('Top-Up Failed', data.error || 'Please add a payment method in your billing portal.');
      }
    } catch (e: any) {
      toast.error('Network Error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleOverageConsent = async () => {
    if (!packageStatus) return;
    setIsTogglingOverage(true);
    const nextConsent = !packageStatus.overageConsent;
    try {
      const res = await fetch(`${WALLET_API}/billing/overage-consent`, {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: nextConsent }),
      });
      const data = await res.json();
      if (res.ok) {
        setPackageStatus((prev) => prev ? { ...prev, overageConsent: nextConsent } : null);
        toast.success(
          nextConsent ? 'Auto-Overage Enabled' : 'Auto-Overage Disabled',
          data.message
        );
      } else {
        toast.error('Update Failed', data.error);
      }
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setIsTogglingOverage(false);
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
          message: data.error || 'Failed to open billing portal. Have you saved a payment method yet?' 
        });
        setIsProcessing(false);
      }
    } catch (e) {
      console.error('[Wallet] Portal access failed:', e);
      setBanner({ type: 'error', message: 'Network error. Please try again.' });
      setIsProcessing(false);
    }
  };

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
          <h1>Billing &amp; Host Packages</h1>
          <p className="subtitle">Manage your participant-minute package, 1-click top-ups, and auto-overage protection</p>
        </div>
        <div className="header-actions">
          <button className="refresh-btn" onClick={() => { fetchPackageStatus(); fetchTransactions(); }} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button className="marketplace-btn" onClick={() => setIsMarketplaceOpen(true)}>
            <Sparkles size={18} /> View Package Marketplace
          </button>
        </div>
      </header>

      {/* ── Main Billing Grid ── */}
      <div className="wallet-grid">
        {/* ── Host Participant-Minutes Package Card ── */}
        <div className="package-status-card glass-card">
          <div className="pkg-status-top">
            <div className="pkg-title-badge">
              <Clock size={18} />
              <span>Host Participant-Minutes</span>
            </div>
            <span className="pkg-pill-name">
              {isLoadingPackage ? '...' : packageStatus?.package ? `${packageStatus.package.name.toUpperCase()} PLAN` : 'NO PLAN ACTIVE'}
            </span>
          </div>

          <div className="pkg-gauge-section">
            <div className="pkg-numbers-row">
              <div>
                <span className="pkg-remaining-val">
                  {isLoadingPackage ? '...' : (packageStatus?.packageMinutesRemaining || 0).toLocaleString()}
                </span>
                <span className="pkg-total-sub">
                  / {(packageStatus?.packageMinutesTotal || 0).toLocaleString()} minutes remaining
                </span>
              </div>
              <span className={`pkg-percent-tag ${packageStatus?.isLowBalance ? 'low' : packageStatus?.isDepleted ? 'depleted' : 'healthy'}`}>
                {isLoadingPackage ? '...' : `${packageStatus?.percentRemaining || 0}%`}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="progress-track">
              <div
                className={`progress-fill ${packageStatus?.isLowBalance ? 'low' : packageStatus?.isDepleted ? 'depleted' : 'healthy'}`}
                style={{ width: `${Math.min(100, Math.max(0, packageStatus?.percentRemaining || 0))}%` }}
              />
            </div>
          </div>

          <div className="pkg-details-grid">
            <div className="pkg-stat-box">
              <span className="stat-label">Consumed this cycle</span>
              <span className="stat-val">{(packageStatus?.packageMinutesUsed || 0).toLocaleString()} mins</span>
            </div>
            <div className="pkg-stat-box">
              <span className="stat-label">Monthly Cycle Reset</span>
              <span className="stat-val">
                {packageStatus?.daysUntilReset !== null ? `In ${packageStatus?.daysUntilReset} days` : '30-day rollover'}
              </span>
            </div>
          </div>

          {/* Overage Toggle Box */}
          <div className="overage-protection-toggle-card">
            <div className="overage-text-col">
              <div className="overage-title-row">
                <Zap size={16} className="text-amber" />
                <strong>Auto $10 Overage Protection</strong>
              </div>
              <span className="overage-desc">
                When balance hits zero during a live session, automatically charge a $10 block (+10,000 mins) so your stream never drops.
              </span>
            </div>

            <button
              type="button"
              className={`toggle-switch-btn ${packageStatus?.overageConsent ? 'on' : 'off'}`}
              onClick={handleToggleOverageConsent}
              disabled={isTogglingOverage}
            >
              <div className="toggle-handle" />
            </button>
          </div>

          <div className="pkg-card-actions">
            <button className="upgrade-tier-btn" onClick={() => setIsMarketplaceOpen(true)}>
              <Sparkles size={16} />
              <span>Change / Upgrade Plan</span>
            </button>
            <button
              className="oneclick-topup-btn"
              onClick={handleOneClickTopup}
              disabled={isProcessing}
            >
              <DollarSign size={16} />
              <span>1-Click $10 Top Up</span>
            </button>
          </div>
        </div>

        {/* ── Security & Stripe Card ── */}
        <div className="security-card glass">
          <Shield size={32} className="shield-icon" />
          <h3>Stripe Billing Portal</h3>
          <p>
            Securely manage your pre-saved cards for 1-click in-stream top-ups and automatic overage protection.
          </p>
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
          <h2>Billing &amp; Usage History</h2>
          {!isLoadingTx && <span className="tx-count">{transactions.length} records</span>}
        </div>

        <div className="transaction-list">
          {isLoadingTx ? (
            <div className="tx-loading">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="tx-empty">No transactions recorded yet. Select a host package to get started.</div>
          ) : (
            transactions.map((tx) => {
              const isTopup = tx.type === 'topup' || tx.type === 'package_subscription';
              return (
                <div key={tx.id} className="transaction-item glass">
                  <div className="tx-icon-bg">
                    {isTopup
                      ? <ArrowUpRight color="#10b981" size={20} />
                      : <ArrowDownLeft color="#f43f5e" size={20} />
                    }
                  </div>
                  <div className="tx-details">
                    <span className="tx-type">
                      {tx.type === 'package_subscription' ? 'Package Subscription' : tx.type === 'overage_charge' ? 'Auto Overage ($10 Block)' : tx.type === 'topup' ? 'Top-up' : 'Usage Deduction'}
                    </span>
                    <span className="tx-desc">{tx.description || '—'}</span>
                    <span className="tx-date">{formatDate(tx.createdAt)}</span>
                  </div>
                  <div className="tx-balance-after">
                    <span className="balance-label">Participant Mins</span>
                    <span className="balance-value">{tx.balanceAfter.toLocaleString()}</span>
                  </div>
                  <div className="tx-status">
                    <span className={`status-pill ${tx.status}`}>{tx.status}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Billing Marketplace Plan Selector Modal */}
      <BillingMarketplaceModal
        isOpen={isMarketplaceOpen}
        onClose={() => setIsMarketplaceOpen(false)}
        onSuccess={() => {
          fetchPackageStatus();
          fetchTransactions();
        }}
        currentPackageSlug={packageStatus?.package?.slug}
        title="Host Billing Marketplace"
        subtitle="Upgrade or change your monthly participant-minute plan anytime. Instant 1-click activation."
      />

      <style>{`
        .wallet-page {
          max-width: 1100px;
          margin: 0 auto;
        }

        .wallet-banner {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          border-radius: 14px;
          margin-bottom: 2rem;
          font-weight: 500;
          position: relative;
        }

        .wallet-banner.success {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.35);
          color: #6ee7b7;
        }

        .wallet-banner.error {
          background: rgba(244, 63, 94, 0.15);
          border: 1px solid rgba(244, 63, 94, 0.35);
          color: #fda4af;
        }

        .banner-close {
          position: absolute;
          right: 1rem;
          background: none;
          border: none;
          color: inherit;
          font-size: 1.25rem;
          cursor: pointer;
        }

        .wallet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2.5rem;
        }

        .wallet-header h1 {
          font-size: 2.2rem;
          font-weight: 800;
          margin-bottom: 0.25rem;
        }

        .subtitle {
          color: var(--text-muted);
          font-size: 0.95rem;
        }

        .header-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .refresh-btn {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .refresh-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.08);
        }

        .marketplace-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem 1.25rem;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border: none;
          color: white;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
        }

        .marketplace-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
        }

        .wallet-grid {
          display: grid;
          grid-template-columns: 1.8fr 1fr;
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        .package-status-card {
          padding: 2rem;
          border-radius: 20px;
          background: linear-gradient(180deg, rgba(26, 28, 48, 0.85) 0%, rgba(15, 17, 30, 0.95) 100%);
          border: 1px solid rgba(99, 102, 241, 0.25);
        }

        .pkg-status-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .pkg-title-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #a5b4fc;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .pkg-pill-name {
          padding: 0.25rem 0.75rem;
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid rgba(99, 102, 241, 0.4);
          color: #c7d2fe;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        .pkg-gauge-section {
          margin-bottom: 1.5rem;
        }

        .pkg-numbers-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 0.6rem;
        }

        .pkg-remaining-val {
          font-size: 2.2rem;
          font-weight: 800;
          color: white;
          margin-right: 0.4rem;
        }

        .pkg-total-sub {
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .pkg-percent-tag {
          font-size: 0.95rem;
          font-weight: 800;
          padding: 0.2rem 0.6rem;
          border-radius: 8px;
        }

        .pkg-percent-tag.healthy {
          background: rgba(16, 185, 129, 0.15);
          color: #6ee7b7;
        }

        .pkg-percent-tag.low {
          background: rgba(245, 158, 11, 0.2);
          color: #fbbf24;
        }

        .pkg-percent-tag.depleted {
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
        }

        .progress-track {
          width: 100%;
          height: 10px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          transition: width 0.5s ease;
        }

        .progress-fill.healthy {
          background: linear-gradient(90deg, #10b981 0%, #059669 100%);
        }

        .progress-fill.low {
          background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
        }

        .progress-fill.depleted {
          background: #ef4444;
        }

        .pkg-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .pkg-stat-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 0.85rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .stat-label {
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .stat-val {
          font-size: 0.95rem;
          font-weight: 700;
          color: white;
        }

        .overage-protection-toggle-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 14px;
          margin-bottom: 1.5rem;
        }

        .overage-text-col {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          max-width: 80%;
        }

        .overage-title-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.9rem;
          color: white;
        }

        .text-amber {
          color: #f59e0b;
        }

        .overage-desc {
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.35;
        }

        .toggle-switch-btn {
          width: 50px;
          height: 28px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.15);
          border: none;
          padding: 2px;
          cursor: pointer;
          transition: all 0.25s ease;
          position: relative;
        }

        .toggle-switch-btn.on {
          background: #10b981;
        }

        .toggle-handle {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          transition: transform 0.25s ease;
        }

        .toggle-switch-btn.on .toggle-handle {
          transform: translateX(22px);
        }

        .pkg-card-actions {
          display: flex;
          gap: 1rem;
        }

        .upgrade-tier-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: rgba(99, 102, 241, 0.18);
          border: 1px solid rgba(99, 102, 241, 0.4);
          color: white;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.88rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .upgrade-tier-btn:hover {
          background: rgba(99, 102, 241, 0.3);
        }

        .oneclick-topup-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.75rem;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.35);
          color: #6ee7b7;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.88rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .oneclick-topup-btn:hover {
          background: rgba(16, 185, 129, 0.25);
        }

        .security-card {
          padding: 2rem;
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          justify-content: center;
        }

        .shield-icon {
          color: var(--primary);
          margin-bottom: 1rem;
        }

        .security-card h3 {
          margin-bottom: 0.5rem;
          font-size: 1.25rem;
        }

        .security-card p {
          color: var(--text-muted);
          font-size: 0.88rem;
          line-height: 1.5;
          margin-bottom: 1.5rem;
        }

        .manage-stripe-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: white;
          border-radius: 12px;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .manage-stripe-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
        }

        .history-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          padding: 2rem;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .section-header h2 {
          font-size: 1.3rem;
          font-weight: 700;
        }

        .tx-count {
          font-size: 0.8rem;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.05);
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
        }

        .transaction-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .transaction-item {
          display: flex;
          align-items: center;
          padding: 1rem 1.25rem;
          border-radius: 14px;
          gap: 1.25rem;
        }

        .tx-icon-bg {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .tx-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .tx-type {
          font-weight: 600;
          font-size: 0.95rem;
        }

        .tx-desc {
          font-size: 0.82rem;
          color: var(--text-muted);
        }

        .tx-date {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .tx-balance-after {
          text-align: right;
        }

        .balance-label {
          display: block;
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        .balance-value {
          font-size: 0.95rem;
          font-weight: 700;
          color: white;
        }

        .status-pill {
          padding: 0.2rem 0.55rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .status-pill.completed, .status-pill.succeeded {
          background: rgba(16, 185, 129, 0.15);
          color: #6ee7b7;
        }

        .status-pill.pending {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
        }

        .status-pill.failed {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        @media (max-width: 860px) {
          .wallet-grid {
            grid-template-columns: 1fr;
          }
          .wallet-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }
          .header-actions {
            width: 100%;
          }
          .marketplace-btn {
            flex: 1;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default Wallet;
