import React, { useState } from 'react';
import { CreditCard, ArrowUpRight, ArrowDownLeft, History, DollarSign, ExternalLink, Shield } from 'lucide-react';

interface WalletProps {
  onBack: () => void;
}

const Wallet: React.FC<WalletProps> = ({ onBack }) => {
  const [balance, setBalance] = useState(124.50);
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('100');
  const [isProcessing, setIsProcessing] = useState(false);

  const transactions = [
    { id: 1, type: 'Top-up', amount: 100.00, date: '2025-01-15', status: 'Completed', icon: <ArrowUpRight color="#10b981" /> },
    { id: 2, type: 'Usage Deduction', amount: -37.50, date: '2025-01-14', status: 'Completed', icon: <ArrowDownLeft color="#f43f5e" /> },
    { id: 3, type: 'Usage Deduction', amount: -12.20, date: '2025-01-13', status: 'Completed', icon: <ArrowDownLeft color="#f43f5e" /> },
    { id: 4, type: 'Top-up', amount: 50.00, date: '2025-01-10', status: 'Completed', icon: <ArrowUpRight color="#10b981" /> },
  ];

  const handleTopup = () => {
    setIsProcessing(true);
    // Simulate Stripe redirect and success
    setTimeout(() => {
      setIsProcessing(false);
      setIsTopupModalOpen(false);
      setBalance(balance + parseFloat(topupAmount));
    }, 2000);
  };

  return (
    <div className="wallet-page animate-fade-in">
      <header className="wallet-header">
        <div>
          <h1>Wallet & Billing</h1>
          <p className="subtitle">Manage your pre-paid credits and view usage history</p>
        </div>
        <button className="topup-btn" onClick={() => setIsTopupModalOpen(true)}>
          <DollarSign size={20} /> Add Credits
        </button>
      </header>

      <div className="wallet-grid">
        <div className="balance-card glass-card">
          <div className="balance-content">
            <span className="label">Current Balance</span>
            <span className="amount">${balance.toFixed(2)}</span>
            <div className="balance-footer">
              <span className="estimate">Approx. 41,500 minutes remaining</span>
            </div>
          </div>
          <div className="card-decoration">
            <CreditCard size={120} />
          </div>
        </div>

        <div className="security-card glass">
          <Shield size={32} className="shield-icon" />
          <h3>Secure Payments</h3>
          <p>All transactions are processed via Stripe with 256-bit encryption.</p>
          <button className="manage-stripe-btn" onClick={() => alert('Redirecting to Stripe Customer Portal...')}>
            Manage Payment Methods <ExternalLink size={14} />
          </button>
        </div>
      </div>

      <div className="history-section">
        <div className="section-header">
          <History size={20} />
          <h2>Transaction History</h2>
        </div>

        <div className="transaction-list">
          {transactions.map(tx => (
            <div key={tx.id} className="transaction-item glass">
              <div className="tx-icon-bg">{tx.icon}</div>
              <div className="tx-details">
                <span className="tx-type">{tx.type}</span>
                <span className="tx-date">{tx.date}</span>
              </div>
              <div className="tx-status">
                <span className="status-pill">{tx.status}</span>
              </div>
              <div className={`tx-amount ${tx.amount > 0 ? 'positive' : 'negative'}`}>
                {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} USD
              </div>
            </div>
          ))}
        </div>
      </div>

      {isTopupModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-fade-in">
            <h2>Add Credits</h2>
            <p>Choose an amount to add to your wallet.</p>
            
            <div className="amount-options">
              {['25', '50', '100', '250'].map(amt => (
                <button 
                  key={amt} 
                  className={`amount-opt ${topupAmount === amt ? 'selected' : ''}`}
                  onClick={() => setTopupAmount(amt)}
                >
                  ${amt}
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

        .wallet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

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

        .balance-content {
          position: relative;
          z-index: 1;
        }

        .balance-content .label {
          display: block;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
        }

        .balance-content .amount {
          font-size: 3.5rem;
          font-weight: 800;
          display: block;
        }

        .balance-footer {
          margin-top: 1.5rem;
        }

        .estimate {
          background: rgba(255, 255, 255, 0.05);
          padding: 0.4rem 0.8rem;
          border-radius: 8px;
          font-size: 0.9rem;
          color: var(--text-muted);
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

        .manage-stripe-btn:hover { background: rgba(255, 255, 255, 0.05); }

        .history-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: var(--text-main);
        }

        .transaction-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .transaction-item {
          display: grid;
          grid-template-columns: auto 1fr auto auto;
          align-items: center;
          padding: 1rem 1.5rem;
          gap: 1.5rem;
        }

        .tx-icon-bg {
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tx-details { display: flex; flex-direction: column; gap: 0.2rem; }
        .tx-type { font-weight: 600; }
        .tx-date { font-size: 0.8rem; color: var(--text-muted); }

        .status-pill {
          font-size: 0.75rem;
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          padding: 0.2rem 0.6rem;
          border-radius: 20px;
        }

        .tx-amount { font-weight: 700; font-family: monospace; font-size: 1.1rem; }
        .tx-amount.positive { color: #10b981; }
        .tx-amount.negative { color: #f43f5e; }

        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
        }

        .modal-content {
          padding: 2.5rem;
          width: 100%;
          max-width: 450px;
          text-align: center;
        }

        .amount-options {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          margin: 2rem 0;
        }

        .amount-opt {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          color: white;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .amount-opt:hover { background: rgba(255, 255, 255, 0.1); }
        .amount-opt.selected { background: var(--primary); border-color: var(--primary); }

        .modal-actions {
          display: flex;
          gap: 1rem;
        }

        .confirm-topup-btn {
          flex: 2;
          padding: 0.85rem;
          background: var(--primary);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        .cancel-btn {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          border-radius: 10px;
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .wallet-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default Wallet;
