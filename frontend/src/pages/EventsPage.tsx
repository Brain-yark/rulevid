import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  Clock, 
  Users, 
  DollarSign, 
  Plus, 
  Radio, 
  Share2, 
  Check, 
  Play, 
  Search, 
  ExternalLink,
  Sparkles,
  Ticket,
  X,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import type { Event } from '../../../shared/types';
import { API_BASE } from '../config';
import { BillingMarketplaceModal } from '../components/BillingMarketplaceModal';

interface EventsPageProps {
  onJoinEvent: (eventId: string) => void;
  onViewEventDetails: (eventId: string) => void;
}

// ── Inline Toast System ────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: number; type: ToastType; message: string; }

let toastCounter = 0;

const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);
  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  return { toasts, addToast, removeToast };
};
// ────────────────────────────────────────────────────────────────────────────

const EventsPage: React.FC<EventsPageProps> = ({ onJoinEvent, onViewEventDetails }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    // Hosts see all by default; attendees see upcoming (live + published) by default
    const stored = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
    const role: string = stored.role || 'user';
    const hostRoles = ['host', 'admin', 'super_admin', 'moderator'];
    return hostRoles.includes(role) ? 'all' : 'upcoming';
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  // Determine current user role
  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
  const userRole: string = storedUser.role || 'user';
  const isHost = ['host', 'admin', 'super_admin', 'moderator'].includes(userRole);

  // New Event Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStartsAt, setNewStartsAt] = useState('');
  const [newPrice, setNewPrice] = useState('0');
  const [newCapacity, setNewCapacity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const handleHostEventClick = () => {
    const hasPackage = Boolean(storedUser?.billingPackageId || (storedUser?.packageMinutesTotal && storedUser.packageMinutesTotal > 0));
    if (!isHost || !hasPackage) {
      setIsBillingModalOpen(true);
    } else {
      setEditingEventId(null);
      resetForm();
      setIsModalOpen(true);
    }
  };

  const handleBillingSuccess = (packageSlug: string) => {
    addToast(`Activated ${packageSlug.toUpperCase()} host tier! Opening Event Studio...`, 'success');
    setIsBillingModalOpen(false);
    setEditingEventId(null);
    resetForm();
    setIsModalOpen(true);
  };

  useEffect(() => {
    fetchEvents();
  }, [search, statusFilter]);

  const fetchEvents = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      setLoading(true);
      const query = new URLSearchParams();

      if (isHost) {
        // Hosts see their own events (with full metrics)
        query.append('view', 'mine');
      }
      // Attendees get the public view (no view=mine), so the backend returns all published/live events

      if (search) query.append('search', search);

      // 'upcoming' is a UI-only virtual filter meaning live + published
      if (statusFilter === 'upcoming') {
        // Send both statuses the backend understands; if backend supports comma-separated we do that
        // Otherwise we'll filter client-side after fetch
        // We do NOT append status here so all non-ended come back, then filter below
      } else if (statusFilter !== 'all') {
        query.append('status', statusFilter);
      }

      const res = await fetch(`${API_BASE}/api/v1/events?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        let data: Event[] = await res.json();
        // Client-side filter for 'upcoming' virtual tab (live + published only)
        if (statusFilter === 'upcoming') {
          data = data.filter(ev => ev.status === 'live' || ev.status === 'published');
        }
        setEvents(data);
      } else {
        addToast('Failed to load events. Please refresh.', 'error');
      }
    } catch (err) {
      console.error('Failed to load events:', err);
      addToast('Network error loading events.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Shared create/update logic
  const submitEvent = async (autoPublish: boolean) => {
    if (!newTitle.trim() || !newStartsAt) {
      addToast('Please provide a title and start date/time.', 'warning');
      return;
    }
    const token = localStorage.getItem('auth_token');
    if (!token) { addToast('You must be logged in to create events.', 'error'); return; }
    setIsSubmitting(true);

    try {
      const priceCents = Math.round(parseFloat(newPrice || '0') * 100);
      const rawCapacity = parseInt(newCapacity, 10);
      const capacity = newCapacity.trim() !== '' && !isNaN(rawCapacity) && rawCapacity > 0
        ? rawCapacity
        : null;

      const method = editingEventId ? 'PUT' : 'POST';
      const url = editingEventId ? `${API_BASE}/api/v1/events/${editingEventId}` : `${API_BASE}/api/v1/events`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          startsAt: new Date(newStartsAt).toISOString(),
          priceCents,
          capacity,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const detail = errBody?.details?.map((d: any) => d.message).join(', ') || errBody?.error || `Failed to ${editingEventId ? 'update' : 'create'} event`;
        addToast(`Error: ${detail}`, 'error');
        return;
      }

      const savedEvent = await res.json();

      // If user was regular attendee, promote local cache to host since backend promoted them
      if (storedUser && storedUser.role === 'user') {
        storedUser.role = 'host';
        localStorage.setItem('user', JSON.stringify(storedUser));
      }

      setIsModalOpen(false);
      resetForm();

      if (autoPublish && !editingEventId) {
        const pubRes = await fetch(`${API_BASE}/api/v1/events/${savedEvent.id}/publish`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!pubRes.ok) {
          addToast('Event created as draft — automatic publish failed. Publish it manually.', 'warning');
        } else {
          addToast('Event created and published successfully! You are now a Host.', 'success');
        }
      } else {
        addToast(editingEventId ? 'Event updated successfully.' : 'Event saved as draft.', 'success');
      }

      await fetchEvents();
    } catch (err) {
      console.error('[EventsPage] submitEvent network error:', err);
      addToast('Network error — could not reach the server. Check your connection.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form submit handler (Save as Draft or Update)
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitEvent(false);
  };

  const openEditModal = (event: Event) => {
    setEditingEventId(event.id);
    setNewTitle(event.title);
    setNewDescription(event.description || '');
    // Format startsAt for datetime-local input: 'YYYY-MM-DDThh:mm'
    const dateObj = new Date(event.startsAt);
    const localIso = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setNewStartsAt(localIso);
    setNewPrice((event.priceCents / 100).toString());
    setNewCapacity(event.capacity ? event.capacity.toString() : '');
    setIsModalOpen(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`${API_BASE}/api/v1/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        addToast('Event deleted successfully.', 'success');
        await fetchEvents();
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(`Failed to delete event: ${err.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error('Delete error:', err);
      addToast('Network error while deleting event.', 'error');
    }
  };

  const handlePublish = async (eventId: string) => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`${API_BASE}/api/v1/events/${eventId}/publish`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        addToast('Event published successfully!', 'success');
        await fetchEvents();
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(`Failed to publish event: ${err.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error('Publish error:', err);
      addToast('Network error while publishing event.', 'error');
    }
  };

  const handleEndEvent = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to end this live event for all participants?')) return;
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`${API_BASE}/api/v1/events/${eventId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        addToast('Live event concluded successfully.', 'success');
        await fetchEvents();
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(`Failed to end event: ${err.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error('End event error:', err);
      addToast('Network error while ending event.', 'error');
    }
  };

  const handleCopyLink = (eventId: string) => {
    const shareUrl = `${window.location.origin}/?event=${eventId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedId(eventId);
    addToast('Event link copied to clipboard!', 'info');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewStartsAt('');
    setNewPrice('0');
    setNewCapacity('');
  };

  // Metrics Calculations
  const totalRevenue = events.reduce((acc, ev) => acc + (ev.totalRevenueCents || 0), 0) / 100;
  const totalTicketsSold = events.reduce((acc, ev) => acc + (ev.paidTicketsCount || 0), 0);
  const liveCount = events.filter((ev) => ev.status === 'live').length;
  const publishedCount = events.filter((ev) => ev.status === 'published').length;
  const myPurchasedCount = events.filter((ev) => ev.hasPurchasedTicket).length;

  const toastIconMap: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={18} />,
    error: <AlertCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
  };

  return (
    <div className="events-dashboard animate-fade-in">
      {/* ── Toast Container ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast-item toast-${t.type}`}>
            <span className="toast-icon">{toastIconMap[t.type]}</span>
            <span className="toast-msg">{t.message}</span>
            <button className="toast-close" onClick={() => removeToast(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>

      {/* Header Banner */}
      <div className="events-header">
        <div>
          <div className="header-badge">
            <Sparkles size={16} />
            <span>{isHost ? 'Live Experience Monetization' : 'Community Live Experiences'}</span>
          </div>
          <h1>{isHost ? 'Events Dashboard' : 'Live Events Dashboard'}</h1>
          <p className="subtitle">
            {isHost
              ? 'Create paid live events, manage ticket sales, and broadcast high-definition video sessions.'
              : 'Browse scheduled sessions, reserve access tickets, and join interactive live video events.'}
          </p>
        </div>
        <button className="primary-btn pulse-on-hover" onClick={handleHostEventClick}>
          <Plus size={18} />
          <span>{isHost ? 'Create Event' : 'Host an Event'}</span>
        </button>
      </div>

      {/* ── Returned Statistic Bar (Start Cards) for All Roles ── */}
      <div className="metrics-grid">
        {isHost ? (
          <>
            <div className="metric-card glass-card">
              <div className="metric-icon revenue">
                <DollarSign size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">Total Ticket Sales</span>
                <span className="metric-value">${totalRevenue.toFixed(2)}</span>
              </div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-icon tickets">
                <Ticket size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">Paid Tickets Sold</span>
                <span className="metric-value">{totalTicketsSold}</span>
              </div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-icon live">
                <Radio size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">Live Streams Active</span>
                <span className="metric-value">{liveCount}</span>
              </div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-icon upcoming">
                <Calendar size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">Scheduled Events</span>
                <span className="metric-value">{publishedCount}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="metric-card glass-card">
              <div className="metric-icon live">
                <Radio size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">Live Right Now</span>
                <span className="metric-value">{liveCount}</span>
              </div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-icon upcoming">
                <Calendar size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">Scheduled Events</span>
                <span className="metric-value">{publishedCount}</span>
              </div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-icon tickets">
                <Ticket size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">My Reserved Seats</span>
                <span className="metric-value">{myPurchasedCount}</span>
              </div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-icon revenue">
                <Sparkles size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">Total Experiences</span>
                <span className="metric-value">{events.length}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="filter-bar glass">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder={isHost ? 'Search your events...' : 'Search events...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          {(isHost
            ? ['all', 'live', 'published', 'draft', 'ended']
            : ['upcoming', 'all', 'live', 'published', 'ended']
          ).map((status) => (
            <button
              key={status}
              className={`filter-tab ${statusFilter === status ? 'active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status === 'upcoming' ? '🟢 Upcoming & Live' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="loading-state glass-card">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="empty-state glass-card">
          <div className="empty-icon">
            <Calendar size={48} />
          </div>
          <h3>No events found</h3>
          {isHost ? (
            <>
              <p>Create your first paid live event and share the ticket link with your audience!</p>
              <button className="primary-btn" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} />
                <span>Create First Event</span>
              </button>
            </>
          ) : (
            <p>
              {statusFilter === 'upcoming'
                ? 'No live or upcoming events right now. Switch to "All" or "Ended" to browse past events.'
                : 'There are no events in this category. Check back soon!'}
            </p>
          )}
        </div>
      ) : (
        <div className="events-grid">
          {events.map((event) => {
            const startDate = new Date(event.startsAt);
            const isLive = event.status === 'live';
            const isPublished = event.status === 'published';
            const isDraft = event.status === 'draft';
            const isEnded = event.status === 'ended';
            const priceDisplay = event.priceCents === 0 ? 'FREE' : `$${(event.priceCents / 100).toFixed(2)}`;
            const canStartLive = isLive || (event.canStartLive !== undefined ? event.canStartLive : (new Date().getTime() >= new Date(event.startsAt).getTime() - 15 * 60 * 1000));

            // Derive host display name
            const hostName = event.facilitator
              ? (event.facilitator.companyName || event.facilitator.name || event.facilitator.email?.split('@')[0] || 'Host')
              : (event.isHost ? storedUser.companyName || storedUser.email?.split('@')[0] || 'You' : 'Host');

            return (
              <div key={event.id} className={`event-card glass-card ${isLive ? 'border-live' : ''} ${isEnded ? 'event-card-ended' : ''}`}>
                <div className="event-card-top">
                  <div className={`status-badge status-${event.status}`}>
                    {isLive && <span className="pulsing-dot" />}
                    {event.status.toUpperCase()}
                  </div>
                  <div className="price-tag">{priceDisplay}</div>
                </div>

                <h3 className="event-title">{event.title}</h3>

                {/* Host attribution row */}
                <div className="event-host-row">
                  <div className="host-avatar">{hostName.charAt(0).toUpperCase()}</div>
                  <span className="host-name">{event.isHost ? `You (${hostName})` : hostName}</span>
                </div>

                {event.description && <p className="event-desc">{event.description}</p>}

                <div className="event-meta">
                  <div className="meta-item">
                    <Calendar size={15} />
                    <span>{startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="meta-item">
                    <Clock size={15} />
                    <span>{startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="meta-item">
                    <Users size={15} />
                    <span>
                      {event.paidTicketsCount || 0}
                      {event.capacity ? ` / ${event.capacity}` : ''} tickets sold
                    </span>
                  </div>
                </div>

                {/* Sales Progress Bar */}
                {event.capacity && (
                  <div className="capacity-bar-container">
                    <div
                      className="capacity-bar-fill"
                      style={{
                        width: `${Math.min(100, (((event.paidTicketsCount || 0) / event.capacity) * 100))}%`,
                      }}
                    />
                  </div>
                )}

                <div className="event-card-actions">
                  {/* Draft State — Only Host can publish, edit, delete */}
                  {isDraft && event.isHost && (
                    <button className="action-btn publish-btn" onClick={() => handlePublish(event.id)}>
                      Publish Event
                    </button>
                  )}

                  {/* Published State */}
                  {isPublished && (
                    <>
                      {event.isHost ? (
                        canStartLive ? (
                          <button className="action-btn live-btn" onClick={() => onJoinEvent(event.id)} title="Start your live stream broadcast">
                            <Play size={16} />
                            <span>Go Live</span>
                          </button>
                        ) : (
                          <button
                            className="action-btn scheduled-locked-btn"
                            onClick={() => onViewEventDetails(event.id)}
                            title={`Scheduled for ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Live room opens 15m prior.`}
                          >
                            <Clock size={15} />
                            <span>Opens 15m before</span>
                          </button>
                        )
                      ) : (
                        /* Attendee View for Published (Not Live Yet) Event */
                        event.hasPurchasedTicket ? (
                          <button
                            className="action-btn scheduled-locked-btn"
                            onClick={() => onViewEventDetails(event.id)}
                            title="You have a confirmed ticket. The room will open when the host goes live."
                          >
                            <Ticket size={15} />
                            <span>Ticket Confirmed</span>
                          </button>
                        ) : (
                          <button
                            className="action-btn buy-ticket-card-btn"
                            onClick={() => onViewEventDetails(event.id)}
                            title="Purchase ticket for this live event"
                          >
                            <Ticket size={15} />
                            <span>Get Ticket</span>
                          </button>
                        )
                      )}

                      <button
                        className="action-btn copy-btn"
                        onClick={() => handleCopyLink(event.id)}
                        title="Copy direct shareable link for buyers"
                      >
                        {copiedId === event.id ? <Check size={16} className="text-success" /> : <Share2 size={16} />}
                        <span>{copiedId === event.id ? 'Copied!' : 'Share'}</span>
                      </button>
                    </>
                  )}

                  {/* Live State */}
                  {isLive && (
                    <>
                      {event.isHost ? (
                        <>
                          <button className="action-btn live-btn active-live" onClick={() => onJoinEvent(event.id)}>
                            <Radio size={16} />
                            <span>Enter Room</span>
                          </button>
                          <button 
                            className="action-btn end-event-btn" 
                            onClick={() => handleEndEvent(event.id)}
                            title="Conclude and end this live session for all participants"
                          >
                            End Event
                          </button>
                        </>
                      ) : (
                        event.hasPurchasedTicket ? (
                          <button className="action-btn live-btn active-live" onClick={() => onJoinEvent(event.id)}>
                            <Radio size={16} />
                            <span>Join Stream</span>
                          </button>
                        ) : (
                          <button className="action-btn buy-ticket-card-btn live-buy" onClick={() => onViewEventDetails(event.id)}>
                            <Ticket size={16} />
                            <span>Get Ticket &amp; Join</span>
                          </button>
                        )
                      )}

                      <button className="action-btn copy-btn" onClick={() => handleCopyLink(event.id)}>
                        {copiedId === event.id ? <Check size={16} /> : <Share2 size={16} />}
                        <span>{copiedId === event.id ? 'Copied!' : 'Share'}</span>
                      </button>
                    </>
                  )}

                  {/* Ended State — no one can enter or restart */}
                  {isEnded && (
                    <div className="ended-state-block">
                      <span className="ended-pill">🔒 Event Ended</span>
                      <span className="ended-sub">This event has concluded and is no longer accessible.</span>
                    </div>
                  )}

                  <button
                    className="action-btn details-btn"
                    onClick={() => onViewEventDetails(event.id)}
                    title="View public landing page"
                  >
                    <ExternalLink size={16} />
                    <span>Landing Page</span>
                  </button>

                  {/* CRUD: Host Edit & Delete */}
                  {event.isHost && !isLive && (
                    <>
                      {!isEnded && (
                        <button
                          className="action-btn icon-only-btn"
                          onClick={() => openEditModal(event)}
                          title="Edit event details"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      <button
                        className="action-btn icon-only-btn delete-icon-btn"
                        onClick={() => handleDeleteEvent(event.id)}
                        title="Delete event"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Event Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card animate-fade-in">
            <div className="modal-header">
              <div className="modal-title-group">
                <Sparkles size={20} className="text-primary" />
                <h2>{editingEventId ? 'Update Paid Live Event' : 'Create Paid Live Event'}</h2>
              </div>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label>Event Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Masterclass: Scaling Distributed Systems in 2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe what attendees will learn and experience in this live video session..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Date & Start Time *</label>
                  <input
                    type="datetime-local"
                    value={newStartsAt}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    onChange={(e) => setNewStartsAt(e.target.value)}
                    required
                  />
                  <span className="form-hint">Must be a future date and time.</span>
                </div>

                <div className="form-group flex-1">
                  <label>Ticket Price ($ USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.50"
                    placeholder="15.00 (0 for Free)"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Seat Capacity (Optional)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Leave empty for unlimited seats"
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                />
                <span className="form-hint">Cap the number of paid tickets available to create urgency.</span>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                    setEditingEventId(null);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="secondary-btn draft-btn"
                  disabled={isSubmitting}
                >
                  {editingEventId ? 'Save Changes' : 'Save as Draft'}
                </button>
                {!editingEventId && (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => submitEvent(true)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Creating...' : 'Create & Publish'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Billing Package Selection Modal for Attendees / Hosts without package */}
      <BillingMarketplaceModal
        isOpen={isBillingModalOpen}
        onClose={() => setIsBillingModalOpen(false)}
        onSuccess={handleBillingSuccess}
        title="Choose a Host Package to Create Events"
        subtitle="Select a participant-minute plan to host and monetize live sessions on RuleVid. Free tier is available!"
      />

      {/* Styled JSX */}
      <style>{`
        .toast-container {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          z-index: 9999;
          pointer-events: none;
        }

        .toast-item {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          font-size: 0.88rem;
          font-weight: 500;
          min-width: 280px;
          max-width: 400px;
          pointer-events: all;
          animation: toastIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(12px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }

        @keyframes toastIn {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .toast-success { background: rgba(16,185,129,0.18); border: 1px solid rgba(16,185,129,0.45); color: #6ee7b7; }
        .toast-error   { background: rgba(244,63,94,0.18);  border: 1px solid rgba(244,63,94,0.45);  color: #fda4af; }
        .toast-warning { background: rgba(245,158,11,0.18); border: 1px solid rgba(245,158,11,0.45); color: #fcd34d; }
        .toast-info    { background: rgba(99,102,241,0.18); border: 1px solid rgba(99,102,241,0.45); color: #a5b4fc; }

        .toast-icon { flex-shrink: 0; }
        .toast-msg  { flex: 1; }
        .toast-close {
          background: none;
          border: none;
          cursor: pointer;
          color: inherit;
          opacity: 0.6;
          padding: 0;
          display: flex;
          align-items: center;
        }
        .toast-close:hover { opacity: 1; }

        .events-dashboard {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .events-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1.5rem;
        }

        .header-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(99, 102, 241, 0.15);
          color: var(--primary);
          padding: 0.35rem 0.85rem;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
          border: 1px solid rgba(99, 102, 241, 0.3);
        }

        .events-header h1 {
          font-size: 2.2rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 0.5rem;
        }

        .subtitle {
          color: var(--text-muted);
          font-size: 1rem;
          max-width: 600px;
        }

        .primary-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, var(--primary) 0%, #4338ca 100%);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
        }

        .primary-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.25rem;
        }

        .metric-card {
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .metric-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .metric-icon.revenue {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .metric-icon.tickets {
          background: rgba(99, 102, 241, 0.15);
          color: var(--primary);
          border: 1px solid rgba(99, 102, 241, 0.3);
        }

        .metric-icon.live {
          background: rgba(244, 63, 94, 0.15);
          color: var(--accent);
          border: 1px solid rgba(244, 63, 94, 0.3);
        }

        .metric-icon.upcoming {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .metric-label {
          display: block;
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-bottom: 0.25rem;
        }

        .metric-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .filter-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1.25rem;
          flex-wrap: wrap;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          padding: 0.5rem 0.85rem;
          flex: 1;
          min-width: 200px;
          max-width: 350px;
        }

        .search-box input {
          background: transparent;
          border: none;
          color: white;
          outline: none;
          width: 100%;
          font-size: 0.9rem;
        }

        .filter-tabs {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
        }

        .filter-tab {
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 500;
          transition: var(--transition-fast);
        }

        .filter-tab:hover {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.05);
        }

        .filter-tab.active {
          color: white;
          background: rgba(99, 102, 241, 0.25);
          border: 1px solid rgba(99, 102, 241, 0.4);
        }

        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        }

        .event-card {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .event-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
        }

        .event-card.border-live {
          border-color: rgba(244, 63, 94, 0.6);
          box-shadow: 0 0 20px rgba(244, 63, 94, 0.2);
        }

        .event-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
        }

        .status-draft {
          background: rgba(148, 163, 184, 0.15);
          color: var(--text-muted);
          border: 1px solid rgba(148, 163, 184, 0.3);
        }

        .status-published {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .status-live {
          background: rgba(244, 63, 94, 0.2);
          color: #fb7185;
          border: 1px solid rgba(244, 63, 94, 0.5);
        }

        .status-ended {
          background: rgba(71, 85, 105, 0.2);
          color: #94a3b8;
          border: 1px solid rgba(71, 85, 105, 0.3);
        }

        .pulsing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #f43f5e;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(244, 63, 94, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(244, 63, 94, 0); }
        }

        .price-tag {
          font-size: 1.1rem;
          font-weight: 800;
          color: #10b981;
        }

        .event-title {
          font-size: 1.25rem;
          font-weight: 700;
          line-height: 1.3;
        }

        .event-desc {
          font-size: 0.9rem;
          color: var(--text-muted);
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .event-meta {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .capacity-bar-container {
          height: 6px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 3px;
          overflow: hidden;
        }

        .capacity-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary) 0%, #10b981 100%);
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .event-card-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: auto;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          flex-wrap: wrap;
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 0.85rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
          border: 1px solid transparent;
        }

        .publish-btn {
          background: rgba(59, 130, 246, 0.2);
          color: #93c5fd;
          border-color: rgba(59, 130, 246, 0.4);
        }

        .live-btn {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }

        .live-btn.active-live {
          background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
        }

        .scheduled-locked-btn {
          background: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
          border-color: rgba(245, 158, 11, 0.3);
        }

        .scheduled-locked-btn:hover {
          background: rgba(245, 158, 11, 0.2);
        }

        .copy-btn {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-muted);
          border-color: var(--glass-border);
        }

        .copy-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .details-btn {
          background: transparent;
          color: var(--text-muted);
          margin-left: auto;
        }

        .details-btn:hover {
          color: var(--primary);
        }

        .end-event-btn {
          background: rgba(244, 63, 94, 0.15);
          color: #fda4af;
          border-color: rgba(244, 63, 94, 0.35);
        }

        .end-event-btn:hover {
          background: #f43f5e;
          color: white;
        }

        .buy-ticket-card-btn {
          background: linear-gradient(135deg, var(--primary) 0%, #4338ca 100%);
          color: white;
          border: none;
        }

        .buy-ticket-card-btn.live-buy {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .buy-ticket-card-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        }

        .icon-only-btn {
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-muted);
          border-color: var(--glass-border);
        }

        .icon-only-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .delete-icon-btn {
          color: #f43f5e;
          border-color: rgba(244, 63, 94, 0.25);
        }

        .delete-icon-btn:hover {
          background: rgba(244, 63, 94, 0.2);
          color: #fda4af;
        }

        /* ── Host attribution row ── */
        .event-host-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: -0.25rem;
        }

        .host-avatar {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), #7c3aed);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }

        .host-name {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        /* ── Ended event card ── */
        .event-card-ended {
          opacity: 0.65;
          filter: saturate(0.4);
          pointer-events: auto; /* keep for details, but buttons are disabled */
        }

        .event-card-ended:hover {
          transform: none;
          box-shadow: none;
        }

        .ended-state-block {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .ended-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.4rem 0.75rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: #94a3b8;
          background: rgba(71, 85, 105, 0.2);
          border: 1px solid rgba(71, 85, 105, 0.3);
          border-radius: 6px;
          width: fit-content;
        }

        .ended-sub {
          font-size: 0.78rem;
          color: var(--text-muted);
          opacity: 0.75;
        }

        .text-success {
          color: #10b981;
        }

        /* Modal */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1.5rem;
        }

        .modal-content {
          width: 100%;
          max-width: 540px;
          padding: 2rem;
          border-radius: 20px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .modal-title-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .modal-title-group h2 {
          font-size: 1.4rem;
          font-weight: 700;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }

        .form-row {
          display: flex;
          gap: 1rem;
        }

        .flex-1 {
          flex: 1;
        }

        .form-group label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .form-group input,
        .form-group textarea {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          padding: 0.75rem;
          color: white;
          font-size: 0.95rem;
          outline: none;
          font-family: inherit;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          border-color: var(--primary);
        }

        .form-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }

        .secondary-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          padding: 0.75rem 1.25rem;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }

        .secondary-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .draft-btn {
          color: #93c5fd;
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.3);
        }

        .empty-state, .loading-state {
          padding: 4rem 2rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .empty-icon {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
};

export default EventsPage;
