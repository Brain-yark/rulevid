import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Zap,
  Sparkles,
  Clock,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import type { BillingPackage } from '../../../shared/types';

interface BillingMarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (packageSlug: string) => void;
  currentPackageSlug?: string | null;
  title?: string;
  subtitle?: string;
}

export const FALLBACK_PACKAGES: BillingPackage[] = [
  {
    id: 'pkg-free-001',
    name: 'Free',
    slug: 'free',
    participantMinutes: 3000,
    priceCents: 0,
    effectiveRatePer1k: '—',
    roughlyCovers: '~1 small event (e.g. 1hr, 50 attendees)',
    overageBlockCents: 1000,
    overageBlockMinutes: 10000,
    description: 'Perfect for getting started, testing RuleVid, and hosting small interactive sessions.',
    isActive: true,
    isCustom: false,
  },
  {
    id: 'pkg-starter-002',
    name: 'Starter',
    slug: 'starter',
    participantMinutes: 30000,
    priceCents: 3000,
    effectiveRatePer1k: '$1.00/1k',
    roughlyCovers: '~10 events of 50 attendees/hr',
    overageBlockCents: 1000,
    overageBlockMinutes: 10000,
    description: 'Ideal for growing community hosts, creators, and recurring weekly meetups.',
    isActive: true,
    isCustom: false,
  },
  {
    id: 'pkg-growth-003',
    name: 'Growth',
    slug: 'growth',
    participantMinutes: 150000,
    priceCents: 13000,
    effectiveRatePer1k: '$0.87/1k',
    roughlyCovers: '~50 events of 50 attendees/hr',
    overageBlockCents: 1000,
    overageBlockMinutes: 10000,
    description: 'Best value for high-volume masterclasses, workshops, and multi-track conferences.',
    isActive: true,
    isCustom: false,
  },
  {
    id: 'pkg-scale-004',
    name: 'Scale',
    slug: 'scale',
    participantMinutes: 750000,
    priceCents: 0,
    effectiveRatePer1k: 'negotiated',
    roughlyCovers: 'high-volume enterprise hosts',
    overageBlockCents: 1000,
    overageBlockMinutes: 10000,
    description: 'Custom tailored enterprise infrastructure with dedicated bitrate allocation & custom SLA.',
    isActive: true,
    isCustom: true,
  },
];

export const BillingMarketplaceModal: React.FC<BillingMarketplaceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentPackageSlug,
  title = 'Choose Your Host Billing Package',
  subtitle = 'Select a participant-minute plan to host live sessions. Minutes renew every 30 days.',
}) => {
  const toast = useToast();
  const [packages, setPackages] = useState<BillingPackage[]>(FALLBACK_PACKAGES);
  const [selectedSlug, setSelectedSlug] = useState<string>('free');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPackages();
      if (currentPackageSlug) {
        setSelectedSlug(currentPackageSlug);
      }
    }
  }, [isOpen, currentPackageSlug]);

  const fetchPackages = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/packages`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPackages(data);
        }
      }
    } catch (e) {
      console.warn('[BillingModal] Using fallback package catalog');
    }
  };

  if (!isOpen) return null;

  const handleSelectPackage = async (slug: string) => {
    setSelectedSlug(slug);
  };

  const handleSubscribe = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      toast.error('Sign In Required', 'Please sign in or register to subscribe to a host package.');
      return;
    }

    const selectedPkg = packages.find((p) => p.slug === selectedSlug);
    if (!selectedPkg) return;

    if (selectedPkg.isCustom) {
      toast.info(
        'Scale Tier Requested',
        'Our enterprise team has received your inquiry and will contact you directly.'
      );
      onClose();
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/packages/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packageSlug: selectedSlug }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to select package');
      }

      if (data.checkout_url) {
        // Redirect to Stripe Checkout for paid tier
        toast.info('Redirecting to Checkout', 'Opening secure Stripe payment...');
        window.location.href = data.checkout_url;
        return;
      }

      // Free tier subscribed immediately
      toast.success(
        'Host Tier Activated!',
        `You are now on the Free Plan with 3,000 monthly participant-minutes.`
      );

      // Update local storage user role to host
      try {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        storedUser.role = 'host';
        storedUser.billingPackageId = selectedPkg.id;
        storedUser.packageMinutesTotal = selectedPkg.participantMinutes;
        localStorage.setItem('user', JSON.stringify(storedUser));
      } catch (e) {
        // ignore
      }

      if (onSuccess) {
        onSuccess(selectedSlug);
      }
      onClose();
    } catch (err: any) {
      toast.error('Subscription Error', err.message || 'Failed to activate package');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="marketplace-modal-overlay">
      <div className="marketplace-modal-container glass-card animate-fade-in">
        {/* Header */}
        <div className="modal-top-bar">
          <div className="modal-badge">
            <Sparkles size={16} />
            <span>Host Marketplace</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-header-content">
          <h2>{title}</h2>
          <p className="modal-subtitle">{subtitle}</p>
        </div>

        {/* Packages Grid */}
        <div className="packages-marketplace-grid">
          {packages.map((pkg) => {
            const isSelected = selectedSlug === pkg.slug;
            const isCurrent = currentPackageSlug === pkg.slug;
            const isPopular = pkg.slug === 'starter';

            return (
              <div
                key={pkg.id || pkg.slug}
                className={`package-card ${isSelected ? 'selected' : ''} ${isPopular ? 'popular' : ''}`}
                onClick={() => handleSelectPackage(pkg.slug)}
              >
                {isPopular && <div className="popular-badge">MOST POPULAR</div>}
                {isCurrent && <div className="current-badge">CURRENT PLAN</div>}

                <div className="pkg-header">
                  <h3 className="pkg-name">{pkg.name}</h3>
                  <div className="pkg-price-row">
                    <span className="pkg-price">
                      {pkg.isCustom ? 'Custom' : `$${pkg.priceCents / 100}`}
                    </span>
                    {!pkg.isCustom && <span className="pkg-period">/ month</span>}
                  </div>
                </div>

                <div className="pkg-minutes-badge">
                  <Clock size={15} />
                  <span>
                    <strong>{pkg.participantMinutes.toLocaleString()}</strong> participant-mins
                  </span>
                </div>

                <p className="pkg-coverage">{pkg.roughlyCovers}</p>

                <div className="pkg-features-list">
                  <div className="pkg-feature-item">
                    <Check size={16} className="feat-check" />
                    <span>Effective rate: <strong>{pkg.effectiveRatePer1k || '$1.00/1k'}</strong></span>
                  </div>
                  <div className="pkg-feature-item">
                    <Check size={16} className="feat-check" />
                    <span>Auto 30-day monthly rollover</span>
                  </div>
                  <div className="pkg-feature-item">
                    <Check size={16} className="feat-check" />
                    <span>HD Video RTC &amp; Agora Chat</span>
                  </div>
                  <div className="pkg-feature-item">
                    <Check size={16} className="feat-check" />
                    <span>1-Click Top Up &amp; $10 overage protect</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={`select-plan-btn ${isSelected ? 'selected-btn' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPackage(pkg.slug);
                  }}
                >
                  {isSelected ? (
                    <>
                      <Check size={16} />
                      <span>Selected Plan</span>
                    </>
                  ) : (
                    <span>Choose {pkg.name}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer info & action */}
        <div className="modal-bottom-actions">
          <div className="overage-info-box">
            <Zap size={18} className="zap-icon" />
            <div className="overage-info-text">
              <strong>In-Stream Low Balance &amp; Overage Protection</strong>
              <span>
                You will receive in-stream alerts when below 20% remaining. If balance reaches zero, pre-saved cards automatically cover a small $10 block so your stream never drops.
              </span>
            </div>
          </div>

          <div className="action-buttons-row">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="confirm-subscribe-btn"
              onClick={handleSubscribe}
              disabled={isLoading}
            >
              {isLoading ? (
                <span>Processing...</span>
              ) : selectedSlug === 'free' ? (
                <>
                  <span>Activate Free Tier (3,000 Mins)</span>
                  <ArrowRight size={18} />
                </>
              ) : selectedSlug === 'scale' ? (
                <>
                  <span>Contact Sales for Scale Tier</span>
                  <ArrowRight size={18} />
                </>
              ) : (
                <>
                  <span>
                    Subscribe to {packages.find((p) => p.slug === selectedSlug)?.name} (
                    ${(packages.find((p) => p.slug === selectedSlug)?.priceCents || 0) / 100})
                  </span>
                  <CreditCard size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .marketplace-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.82);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          overflow-y: auto;
        }

        .marketplace-modal-container {
          width: 100%;
          max-width: 1050px;
          padding: 2.25rem;
          border-radius: 24px;
          background: linear-gradient(180deg, rgba(26, 28, 48, 0.98) 0%, rgba(15, 17, 30, 0.99) 100%);
          border: 1px solid rgba(99, 102, 241, 0.3);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.15);
        }

        .modal-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .modal-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.85rem;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.35);
          border-radius: 20px;
          color: #a5b4fc;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.4);
        }

        .modal-header-content {
          text-align: center;
          margin-bottom: 2rem;
        }

        .modal-header-content h2 {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #ffffff 40%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.4rem;
        }

        .modal-subtitle {
          color: var(--text-muted);
          font-size: 0.95rem;
          max-width: 620px;
          margin: 0 auto;
        }

        .packages-marketplace-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.25rem;
          margin-bottom: 2rem;
        }

        .package-card {
          position: relative;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          padding: 1.5rem 1.25rem;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .package-card:hover {
          transform: translateY(-4px);
          border-color: rgba(99, 102, 241, 0.4);
          background: rgba(99, 102, 241, 0.05);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
        }

        .package-card.selected {
          border-color: #6366f1;
          background: rgba(99, 102, 241, 0.12);
          box-shadow: 0 0 25px rgba(99, 102, 241, 0.3);
        }

        .package-card.popular {
          border-color: rgba(244, 63, 94, 0.45);
        }

        .popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
          color: white;
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.2rem 0.65rem;
          border-radius: 12px;
          letter-spacing: 0.06em;
          box-shadow: 0 4px 12px rgba(244, 63, 94, 0.4);
        }

        .current-badge {
          position: absolute;
          top: -12px;
          right: 12px;
          background: rgba(16, 185, 129, 0.2);
          border: 1px solid #10b981;
          color: #6ee7b7;
          font-size: 0.62rem;
          font-weight: 800;
          padding: 0.15rem 0.5rem;
          border-radius: 10px;
        }

        .pkg-header {
          margin-bottom: 1rem;
        }

        .pkg-name {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 0.35rem;
        }

        .pkg-price-row {
          display: flex;
          align-items: baseline;
          gap: 0.3rem;
        }

        .pkg-price {
          font-size: 1.9rem;
          font-weight: 800;
          color: white;
        }

        .pkg-period {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .pkg-minutes-badge {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.65rem;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 10px;
          color: #c7d2fe;
          font-size: 0.78rem;
          margin-bottom: 0.9rem;
        }

        .pkg-coverage {
          font-size: 0.8rem;
          color: var(--text-muted);
          min-height: 38px;
          line-height: 1.35;
          margin-bottom: 1.25rem;
        }

        .pkg-features-list {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          margin-bottom: 1.5rem;
          flex: 1;
        }

        .pkg-feature-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          font-size: 0.76rem;
          color: #d1d5db;
          line-height: 1.3;
        }

        .feat-check {
          color: #10b981;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .select-plan-btn {
          width: 100%;
          padding: 0.65rem;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--glass-border);
          color: var(--text-main);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          transition: all 0.2s ease;
        }

        .select-plan-btn:hover {
          background: rgba(99, 102, 241, 0.2);
          border-color: #6366f1;
        }

        .select-plan-btn.selected-btn {
          background: #6366f1;
          border-color: #6366f1;
          color: white;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
        }

        .overage-info-box {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.9rem 1.25rem;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 14px;
          margin-bottom: 1.5rem;
        }

        .zap-icon {
          color: #f59e0b;
          flex-shrink: 0;
        }

        .overage-info-text {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          font-size: 0.82rem;
          color: var(--text-muted);
        }

        .overage-info-text strong {
          color: var(--text-main);
          font-size: 0.88rem;
        }

        .action-buttons-row {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
        }

        .cancel-btn {
          padding: 0.8rem 1.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.92rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cancel-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .confirm-subscribe-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.8rem 2rem;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border: none;
          color: white;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
        }

        .confirm-subscribe-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(99, 102, 241, 0.55);
        }

        .confirm-subscribe-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 960px) {
          .packages-marketplace-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 600px) {
          .packages-marketplace-grid {
            grid-template-columns: 1fr;
          }
          .action-buttons-row {
            flex-direction: column;
          }
          .confirm-subscribe-btn, .cancel-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};
