import React, { useState } from 'react';
import {
  Share2,
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  Send,
  Mail,
  Calendar,
  Clock,
  Sparkles,
  X
} from 'lucide-react';
import type { Event } from '../../../shared/types';
import { copyToClipboard } from '../utils/clipboard';

interface EventShareModalProps {
  isOpen: boolean;
  event: Event | null;
  isNewlyCreated?: boolean;
  onClose: () => void;
  onPreview?: (eventId: string) => void;
}

export const EventShareModal: React.FC<EventShareModalProps> = ({
  isOpen,
  event,
  isNewlyCreated = false,
  onClose,
  onPreview,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !event) return null;

  const shareUrl = `${window.location.origin}/?event=${event.id}`;
  const startDate = new Date(event.startsAt);
  const formattedDate = startDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const priceDisplay = event.priceCents === 0 ? 'Free' : `$${(event.priceCents / 100).toFixed(2)}`;

  const shareMessage = `Join me on RuleVid for "${event.title}" on ${formattedDate} at ${formattedTime}!`;

  const handleCopy = async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Social share links
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareMessage}\n\n${shareUrl}`)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(shareUrl)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareMessage)}`;
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(`Invitation: ${event.title}`)}&body=${encodeURIComponent(
    `Hi,\n\nYou're invited to join the live session "${event.title}" on RuleVid.\n\nDate: ${formattedDate} at ${formattedTime}\nPrice: ${priceDisplay}\n\nReserve your ticket or join here:\n${shareUrl}\n\nSee you there!`
  )}`;

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div 
        className="modal-content glass-card share-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="share-modal-header">
          <div className="share-header-left">
            {isNewlyCreated ? (
              <div className="celebration-badge">
                <Sparkles size={18} className="text-primary animate-pulse" />
                <span>Event Published!</span>
              </div>
            ) : (
              <div className="celebration-badge neutral">
                <Share2 size={16} />
                <span>Share Event</span>
              </div>
            )}
            <h2 className="share-modal-title">
              {isNewlyCreated ? 'Your Share Link is Ready 🎉' : 'Share with Your Audience'}
            </h2>
          </div>
          <button className="close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Event Preview Card */}
        <div className="event-share-preview-card glass">
          <div className="preview-top-row">
            <span className="preview-pill status-pill">
              {event.status.toUpperCase()}
            </span>
            <span className="preview-pill price-pill">
              {priceDisplay}
            </span>
          </div>
          <h3 className="preview-event-title">{event.title}</h3>
          <div className="preview-meta-row">
            <div className="preview-meta-item">
              <Calendar size={14} />
              <span>{formattedDate}</span>
            </div>
            <div className="preview-meta-item">
              <Clock size={14} />
              <span>{formattedTime}</span>
            </div>
          </div>
        </div>

        {/* Copy Link Section */}
        <div className="share-link-box-section">
          <label className="share-section-label">Direct Event Link</label>
          <div className="share-input-group">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="share-url-input"
            />
            <button 
              className={`copy-share-cta-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check size={16} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
          <span className="share-input-hint">
            Anyone with this link can view the event landing page and reserve tickets.
          </span>
        </div>

        {/* Quick Social Sharing */}
        <div className="social-share-section">
          <label className="share-section-label">1-Click Share</label>
          <div className="social-buttons-grid">
            <button
              className="social-btn whatsapp-btn"
              onClick={() => handleOpenLink(whatsappUrl)}
              title="Share on WhatsApp"
            >
              <MessageCircle size={18} />
              <span>WhatsApp</span>
            </button>

            <button
              className="social-btn twitter-btn"
              onClick={() => handleOpenLink(twitterUrl)}
              title="Share on X (Twitter)"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>X / Twitter</span>
            </button>

            <button
              className="social-btn linkedin-btn"
              onClick={() => handleOpenLink(linkedinUrl)}
              title="Share on LinkedIn"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.4 1.4 0 1 0-.01-2.8 1.4 1.4 0 0 0 .01 2.8m1.4 9.74v-8.37H5.06v8.37z" />
              </svg>
              <span>LinkedIn</span>
            </button>

            <button
              className="social-btn telegram-btn"
              onClick={() => handleOpenLink(telegramUrl)}
              title="Share on Telegram"
            >
              <Send size={18} />
              <span>Telegram</span>
            </button>

            <button
              className="social-btn email-btn"
              onClick={() => handleOpenLink(mailtoUrl)}
              title="Send via Email"
            >
              <Mail size={18} />
              <span>Email</span>
            </button>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="share-modal-footer">
          {onPreview && (
            <button
              className="secondary-btn preview-cta-btn"
              onClick={() => {
                onClose();
                onPreview(event.id);
              }}
            >
              <ExternalLink size={16} />
              <span>Preview Public Landing Page</span>
            </button>
          )}
          <button className="primary-btn done-cta-btn" onClick={onClose}>
            Done
          </button>
        </div>

        {/* Modal-Specific Styles */}
        <style>{`
          .share-modal-container {
            max-width: 540px;
            width: 95%;
            padding: 1.75rem;
            display: flex;
            flex-direction: column;
            gap: 1.3rem;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: linear-gradient(145deg, rgba(24, 24, 32, 0.95), rgba(16, 16, 22, 0.98));
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.15);
          }

          .share-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }

          .share-header-left {
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
          }

          .celebration-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #818cf8;
            background: rgba(99, 102, 241, 0.15);
            padding: 0.25rem 0.65rem;
            border-radius: 9999px;
            width: fit-content;
            border: 1px solid rgba(99, 102, 241, 0.3);
          }

          .celebration-badge.neutral {
            color: #94a3b8;
            background: rgba(148, 163, 184, 0.1);
            border-color: rgba(148, 163, 184, 0.2);
          }

          .share-modal-title {
            font-size: 1.35rem;
            font-weight: 700;
            color: #f8fafc;
            margin: 0;
            letter-spacing: -0.02em;
          }

          .event-share-preview-card {
            padding: 1rem 1.1rem;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .preview-top-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .preview-pill {
            font-size: 0.72rem;
            font-weight: 700;
            padding: 0.2rem 0.55rem;
            border-radius: 6px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .preview-pill.status-pill {
            background: rgba(52, 211, 153, 0.15);
            color: #34d399;
            border: 1px solid rgba(52, 211, 153, 0.3);
          }

          .preview-pill.price-pill {
            background: rgba(99, 102, 241, 0.15);
            color: #a5b4fc;
            border: 1px solid rgba(99, 102, 241, 0.3);
          }

          .preview-event-title {
            font-size: 1.05rem;
            font-weight: 600;
            color: #f1f5f9;
            margin: 0;
            line-height: 1.4;
          }

          .preview-meta-row {
            display: flex;
            gap: 1rem;
            font-size: 0.82rem;
            color: var(--text-muted, #94a3b8);
          }

          .preview-meta-item {
            display: flex;
            align-items: center;
            gap: 0.35rem;
          }

          .share-link-box-section {
            display: flex;
            flex-direction: column;
            gap: 0.45rem;
          }

          .share-section-label {
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted, #94a3b8);
          }

          .share-input-group {
            display: flex;
            gap: 0.5rem;
            align-items: center;
          }

          .share-url-input {
            flex: 1;
            background: rgba(15, 23, 42, 0.7) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            border-radius: 10px !important;
            padding: 0.65rem 0.9rem !important;
            color: #e2e8f0 !important;
            font-size: 0.88rem !important;
            font-family: monospace;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .share-url-input:focus {
            border-color: #6366f1 !important;
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25) !important;
          }

          .copy-share-cta-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.45rem;
            padding: 0.65rem 1.15rem;
            border-radius: 10px;
            font-size: 0.88rem;
            font-weight: 600;
            background: #6366f1;
            color: #ffffff;
            border: none;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s ease;
          }

          .copy-share-cta-btn:hover {
            background: #4f46e5;
            transform: translateY(-1px);
          }

          .copy-share-cta-btn.copied {
            background: #10b981;
            color: #ffffff;
          }

          .share-input-hint {
            font-size: 0.75rem;
            color: var(--text-muted, #64748b);
          }

          .social-share-section {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .social-buttons-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(95px, 1fr));
            gap: 0.5rem;
          }

          .social-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.35rem;
            padding: 0.65rem 0.4rem;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.04);
            color: #e2e8f0;
            font-size: 0.76rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.18s ease;
          }

          .social-btn:hover {
            transform: translateY(-2px);
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.2);
          }

          .social-btn.whatsapp-btn:hover {
            border-color: rgba(37, 211, 102, 0.5);
            color: #25d366;
            background: rgba(37, 211, 102, 0.1);
          }

          .social-btn.twitter-btn:hover {
            border-color: rgba(56, 189, 248, 0.5);
            color: #38bdf8;
            background: rgba(56, 189, 248, 0.1);
          }

          .social-btn.linkedin-btn:hover {
            border-color: rgba(14, 165, 233, 0.5);
            color: #0ea5e9;
            background: rgba(14, 165, 233, 0.1);
          }

          .social-btn.telegram-btn:hover {
            border-color: rgba(0, 136, 204, 0.5);
            color: #38bdf8;
            background: rgba(0, 136, 204, 0.1);
          }

          .social-btn.email-btn:hover {
            border-color: rgba(245, 158, 11, 0.5);
            color: #fbbf24;
            background: rgba(245, 158, 11, 0.1);
          }

          .share-modal-footer {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 0.75rem;
            margin-top: 0.5rem;
            padding-top: 1rem;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
          }

          .preview-cta-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            font-size: 0.85rem;
          }

          .done-cta-btn {
            padding: 0.6rem 1.4rem;
            font-size: 0.88rem;
          }
        `}</style>
      </div>
    </div>
  );
};

export default EventShareModal;
