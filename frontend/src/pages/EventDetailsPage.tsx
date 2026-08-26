import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Users,
  ShieldCheck,
  CheckCircle,
  Radio,
  Share2,
  Check,
  ArrowLeft,
  Sparkles,
  Ticket,
  Play,
  Lock
} from 'lucide-react';
import type { Event } from '../../../shared/types';
import { API_BASE } from '../config';

interface EventDetailsPageProps {
  eventId: string;
  onJoinRoom: (eventId: string) => void;
  onBack: () => void;
  onRequireLogin: () => void;
}



const EventDetailsPage: React.FC<EventDetailsPageProps> = ({
  eventId,
  onJoinRoom,
  onBack,
  onRequireLogin,
}) => {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [countdownText, setCountdownText] = useState('');

  const token = localStorage.getItem('auth_token');

  useEffect(() => {
    // Check url params for payment confirmation
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      setPaymentSuccess(true);
    }
    fetchEventDetails();
  }, [eventId]);

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/api/v1/events/${eventId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setEvent(data);
      }
    } catch (err) {
      console.error('Failed to load event details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Live countdown timer
  useEffect(() => {
    if (!event) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const eventTime = new Date(event.startsAt).getTime();
      const diff = eventTime - now;

      if (event.status === 'live') {
        setCountdownText('Live Streaming Now');
        return;
      }

      if (event.status === 'ended') {
        setCountdownText('Event Ended');
        return;
      }

      if (diff <= 0) {
        setCountdownText('Starting any moment');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setCountdownText(`Starts in ${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setCountdownText(`Starts in ${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdownText(`Starts in ${minutes}m ${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [event]);

  const handleBuyTicket = async () => {
    if (!token) {
      onRequireLogin();
      return;
    }

    try {
      setBuying(true);
      const res = await fetch(`${API_BASE}/api/v1/events/${eventId}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.checkoutUrl) {
        // Redirect to Stripe Checkout page
        window.location.href = data.checkoutUrl;
      } else if (data.isFree || data.alreadyOwned) {
        await fetchEventDetails();
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Failed to initiate checkout. Please try again.');
    } finally {
      setBuying(false);
    }
  };

  const handleEndEvent = async () => {
    if (!window.confirm('Are you sure you want to end this live event for all participants?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/events/${eventId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await fetchEventDetails();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Failed to end event: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('End event error:', err);
      alert('Network error while ending event');
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/?event=${eventId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="event-details-container loading glass-card animate-fade-in">
        <p>Loading event information...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="event-details-container glass-card animate-fade-in">
        <h2>Event Not Found</h2>
        <p>This event may have been removed or does not exist.</p>
        <button className="secondary-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      </div>
    );
  }

  const startDate = new Date(event.startsAt);
  const isLive = event.status === 'live';
  const isEnded = event.status === 'ended';
  const isHost = event.isHost;
  const hasTicket = event.hasPurchasedTicket || isHost;
  const priceDisplay = event.priceCents === 0 ? 'FREE' : `$${(event.priceCents / 100).toFixed(2)}`;
  const spotsLeft = event.capacity ? Math.max(0, event.capacity - (event.paidTicketsCount || 0)) : null;
  const canStartLive = isLive || (event.canStartLive !== undefined ? event.canStartLive : (new Date().getTime() >= new Date(event.startsAt).getTime() - 15 * 60 * 1000));

  return (
    <div className="event-details-page animate-fade-in">
      <button className="back-nav-btn" onClick={onBack}>
        <ArrowLeft size={18} />
        <span>Back to Events</span>
      </button>

      {/* Payment Success Alert */}
      {paymentSuccess && (
        <div className="success-banner animate-fade-in">
          <CheckCircle size={24} className="text-success" />
          <div>
            <h4>Ticket Purchase Confirmed!</h4>
            <p>Your payment was processed successfully. Your live seat is reserved.</p>
          </div>
        </div>
      )}

      <div className="event-hero-grid">
        {/* Left: Main Details */}
        <div className="event-main-card glass-card">
          <div className="event-status-row">
            <div className={`status-pill status-${event.status}`}>
              {isLive && <span className="live-dot" />}
              {isLive ? 'STREAMING LIVE NOW' : event.status.toUpperCase()}
            </div>

            <div className="countdown-pill">
              <Clock size={15} />
              <span>{countdownText}</span>
            </div>
          </div>

          <h1 className="event-main-title">{event.title}</h1>

          {/* Host Info */}
          <div className="host-info-chip">
            <div className="host-avatar">
              {event.facilitator?.email.charAt(0).toUpperCase() || 'H'}
            </div>
            <div>
              <span className="host-label">Hosted by</span>
              <span className="host-name">
                {event.facilitator?.companyName || event.facilitator?.email || 'Event Host'}
              </span>
            </div>
          </div>

          {/* Event Description */}
          <div className="description-section">
            <h3>About This Experience</h3>
            <p className="description-text">
              {event.description ||
                'Join this interactive live streaming session on SVSM Live. Engage in real-time discussion and high-definition video.'}
            </p>
          </div>

          {/* Details Metadata Grid */}
          <div className="details-meta-grid">
            <div className="meta-box glass">
              <Calendar className="meta-icon" size={22} />
              <div>
                <span className="meta-label">Date</span>
                <span className="meta-value">
                  {startDate.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            <div className="meta-box glass">
              <Clock className="meta-icon" size={22} />
              <div>
                <span className="meta-label">Time</span>
                <span className="meta-value">
                  {startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                </span>
              </div>
            </div>

            <div className="meta-box glass">
              <Users className="meta-icon" size={22} />
              <div>
                <span className="meta-label">Access</span>
                <span className="meta-value">
                  {event.capacity ? `${spotsLeft} of ${event.capacity} seats left` : 'Unlimited Seats'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Ticket & Action Box */}
        <div className="ticket-checkout-box glass-card">
          <div className="ticket-header">
            <div className="ticket-badge">
              <Sparkles size={16} />
              <span>General Admission</span>
            </div>
            <div className="ticket-price">{priceDisplay}</div>
          </div>

          <div className="ticket-features">
            <div className="feature-item">
              <Check size={16} className="text-primary" />
              <span>Full HD WebRTC live video & audio</span>
            </div>
            <div className="feature-item">
              <Check size={16} className="text-primary" />
              <span>Interactive real-time text chat panel</span>
            </div>
            <div className="feature-item">
              <Check size={16} className="text-primary" />
              <span>Direct access link tied to your account</span>
            </div>
          </div>

          {/* Action CTA */}
          <div className="cta-container">
            {isEnded ? (
              <div className="event-ended-notice-card glass">
                <div className="ended-lock-title">
                  <Lock size={18} />
                  <span>Event Concluded</span>
                </div>
                <p>This live event has ended and is permanently closed. Nobody can enter or restart this stream.</p>
              </div>
            ) : isHost ? (
              <div className="host-cta-group">
                <div className="host-badge">
                  <ShieldCheck size={16} />
                  <span>You are the Host</span>
                </div>

                {isLive ? (
                  <>
                    <button className="primary-cta-btn live-btn" onClick={() => onJoinRoom(event.id)}>
                      <Play size={20} />
                      <span>Enter Live Room</span>
                    </button>
                    <button 
                      className="primary-cta-btn" 
                      onClick={handleEndEvent}
                      style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#fda4af', border: '1px solid rgba(244, 63, 94, 0.4)', marginTop: '0.5rem' }}
                    >
                      End Live Stream
                    </button>
                  </>
                ) : canStartLive ? (
                  <button className="primary-cta-btn live-btn" onClick={() => onJoinRoom(event.id)}>
                    <Play size={20} />
                    <span>Start Live Stream</span>
                  </button>
                ) : (
                  <div className="scheduled-host-lock glass">
                    <div className="schedule-lock-header">
                      <Lock size={18} className="text-warning" />
                      <strong>Live Stream Locked</strong>
                    </div>
                    <p className="schedule-lock-desc">
                      Scheduled for {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. The live room opens <strong>15 minutes</strong> prior to start time for host setup.
                    </p>
                    <button className="primary-cta-btn disabled-btn" disabled title="Host can only go live 15 minutes before scheduled start">
                      <Clock size={18} />
                      <span>Opens {countdownText}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : hasTicket ? (
              <div className="ticket-owned-group">
                <div className="ticket-confirmed-badge">
                  <Ticket size={20} />
                  <span>You Have a Confirmed Ticket</span>
                </div>

                {isLive ? (
                  <button className="primary-cta-btn pulsing-cta" onClick={() => onJoinRoom(event.id)}>
                    <Radio size={20} />
                    <span>Join Live Stream Now</span>
                  </button>
                ) : (
                  <div className="waiting-room-card glass">
                    <Clock size={20} className="text-primary" />
                    <p>Your seat is confirmed! The live video room will open when the host goes live.</p>
                  </div>
                )}
              </div>
            ) : (
              <button
                className="primary-cta-btn buy-btn"
                onClick={handleBuyTicket}
                disabled={buying || spotsLeft === 0}
              >
                {buying ? (
                  <span>Preparing Checkout...</span>
                ) : spotsLeft === 0 ? (
                  <span>Sold Out</span>
                ) : (
                  <>
                    <Lock size={18} />
                    <span>Buy Ticket ({priceDisplay})</span>
                  </>
                )}
              </button>
            )}

            {/* Share Link Button */}
            <button className="share-link-btn" onClick={handleCopyLink}>
              {copied ? <Check size={16} className="text-success" /> : <Share2 size={16} />}
              <span>{copied ? 'Link Copied to Clipboard!' : 'Share Event Link'}</span>
            </button>
          </div>

          <div className="secure-badge">
            <ShieldCheck size={15} />
            <span>Guaranteed seat access · Secure payment</span>
          </div>
        </div>
      </div>

      {/* Styled JSX */}
      <style>{`
        .event-details-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          max-width: 1100px;
          margin: 0 auto;
        }

        .back-nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95rem;
          padding: 0.5rem 0;
          width: fit-content;
          transition: var(--transition-fast);
        }

        .back-nav-btn:hover {
          color: white;
          transform: translateX(-3px);
        }

        .success-banner {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.4);
          padding: 1.25rem;
          border-radius: 16px;
          color: white;
        }

        .success-banner h4 {
          font-size: 1.1rem;
          font-weight: 700;
          color: #10b981;
          margin-bottom: 0.25rem;
        }

        .success-banner p {
          font-size: 0.9rem;
          color: var(--text-muted);
        }

        .event-hero-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 2rem;
          align-items: start;
        }

        @media (max-width: 900px) {
          .event-hero-grid {
            grid-template-columns: 1fr;
          }
        }

        .event-main-card {
          padding: 2.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
        }

        .event-status-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          padding: 0.4rem 0.85rem;
          border-radius: 8px;
        }

        .status-live {
          background: rgba(244, 63, 94, 0.2);
          color: #fb7185;
          border: 1px solid rgba(244, 63, 94, 0.5);
        }

        .status-published {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .status-ended {
          background: rgba(71, 85, 105, 0.2);
          color: #94a3b8;
          border: 1px solid rgba(71, 85, 105, 0.3);
        }

        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #f43f5e;
          animation: pulse 1.5s infinite;
        }

        .countdown-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.04);
          padding: 0.4rem 0.85rem;
          border-radius: 8px;
          border: 1px solid var(--glass-border);
        }

        .event-main-title {
          font-size: 2.2rem;
          font-weight: 800;
          line-height: 1.25;
          letter-spacing: -0.02em;
        }

        .host-info-chip {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .host-avatar {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--primary) 0%, #a855f7 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.2rem;
          color: white;
        }

        .host-label {
          display: block;
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .host-name {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-main);
        }

        .description-section h3 {
          font-size: 1.1rem;
          font-weight: 700;
          margin-bottom: 0.75rem;
        }

        .description-text {
          font-size: 1rem;
          color: #cbd5e1;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .details-meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .meta-box {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 1rem;
          border-radius: 14px;
        }

        .meta-icon {
          color: var(--primary);
        }

        .meta-label {
          display: block;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .meta-value {
          font-size: 0.95rem;
          font-weight: 600;
          color: white;
        }

        /* Ticket Box */
        .ticket-checkout-box {
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          border-color: rgba(99, 102, 241, 0.3);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
        }

        .ticket-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ticket-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(99, 102, 241, 0.15);
          color: var(--primary);
          padding: 0.35rem 0.75rem;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .ticket-price {
          font-size: 2rem;
          font-weight: 800;
          color: #10b981;
        }

        .ticket-features {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem 0;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.9rem;
          color: #cbd5e1;
        }

        .cta-container {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .primary-cta-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          width: 100%;
          padding: 1rem;
          border-radius: 12px;
          font-size: 1.05rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .buy-btn {
          background: linear-gradient(135deg, var(--primary) 0%, #4338ca 100%);
          color: white;
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
        }

        .buy-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.6);
        }

        .live-btn {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }

        .pulsing-cta {
          background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
          color: white;
          box-shadow: 0 6px 20px rgba(244, 63, 94, 0.4);
          animation: pulse 1.5s infinite;
        }

        .ticket-owned-group {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .ticket-confirmed-badge {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          padding: 0.75rem;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.95rem;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .waiting-room-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border-radius: 12px;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .host-cta-group {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .host-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(99, 102, 241, 0.15);
          color: var(--primary);
          padding: 0.5rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          justify-content: center;
        }

        .scheduled-host-lock {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1.25rem;
          border-radius: 12px;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .schedule-lock-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #f59e0b;
          font-size: 0.95rem;
          font-weight: 700;
        }

        .schedule-lock-desc {
          font-size: 0.82rem;
          color: #cbd5e1;
          line-height: 1.4;
          margin: 0;
        }

        .disabled-btn {
          background: rgba(255, 255, 255, 0.06) !important;
          color: var(--text-muted) !important;
          cursor: not-allowed !important;
          box-shadow: none !important;
          transform: none !important;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .event-ended-notice-card {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          padding: 1.25rem;
          border-radius: 12px;
          background: rgba(71, 85, 105, 0.2);
          border: 1px solid rgba(71, 85, 105, 0.4);
          text-align: center;
        }

        .ended-lock-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          color: #94a3b8;
          font-weight: 700;
          font-size: 1rem;
        }

        .event-ended-notice-card p {
          color: var(--text-muted);
          font-size: 0.85rem;
          line-height: 1.4;
          margin: 0;
        }

        .event-ended-notice {
          padding: 1rem;
          text-align: center;
          background: rgba(71, 85, 105, 0.2);
          color: var(--text-muted);
          border-radius: 10px;
          font-size: 0.9rem;
        }

        .share-link-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          padding: 0.75rem;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
          font-size: 0.9rem;
        }

        .share-link-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .secure-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          color: var(--text-muted);
          text-align: center;
        }

        .text-success {
          color: #10b981;
        }

        .text-primary {
          color: var(--primary);
        }
      `}</style>
    </div>
  );
};

export default EventDetailsPage;
