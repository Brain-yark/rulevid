import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Ticket,
  Users,
  Clock,
  Radio,
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import type { HostAnalytics } from '../../../shared/types';

interface HostAnalyticsPageProps {
  onGoToEventDetails: (eventId: string) => void;
  onGoToHostStudio: () => void;
}

const HostAnalyticsPage: React.FC<HostAnalyticsPageProps> = ({
  onGoToEventDetails,
  onGoToHostStudio,
}) => {
  const toast = useToast();
  const [analytics, setAnalytics] = useState<HostAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/events/analytics/host`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      } else {
        toast.error('Failed to load analytics', 'Could not retrieve performance metrics.');
      }
    } catch (err) {
      console.error('Failed to load host analytics:', err);
      toast.error('Network Error', 'Could not communicate with RuleVid servers.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
    toast.info('Analytics Refreshed', 'Latest ticket sales and event metrics loaded.');
  };

  const filteredEvents = (analytics?.eventsBreakdown || []).filter((ev) => {
    if (statusFilter === 'all') return true;
    return ev.status === statusFilter;
  });

  const totalRevenue = (analytics?.totalRevenueCents || 0) / 100;
  const avgTicketPrice = (analytics?.averageTicketPriceCents || 0) / 100;

  return (
    <div className="host-analytics-page animate-fade-in">
      {/* Header Banner */}
      <div className="analytics-header">
        <div>
          <div className="header-badge">
            <TrendingUp size={16} />
            <span>RuleVid Creator &amp; Host Intelligence</span>
          </div>
          <h1>Host Performance Analytics</h1>
          <p className="subtitle">
            Track your ticket sales, audience attendance rates, revenue growth, and live broadcast engagement.
          </p>
        </div>

        <div className="header-actions">
          <button className="secondary-btn" onClick={handleManualRefresh} disabled={refreshing || loading}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
          </button>
          <button className="primary-btn" onClick={onGoToHostStudio}>
            <Radio size={16} />
            <span>Host Studio</span>
          </button>
        </div>
      </div>

      {loading && !analytics ? (
        <div className="loading-state glass-card">Loading your RuleVid analytics...</div>
      ) : (
        <>
          {/* Primary KPI Grid */}
          <div className="kpi-grid">
            <div className="kpi-card glass-card">
              <div className="kpi-icon revenue-icon">
                <DollarSign size={24} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Gross Ticket Revenue</span>
                <span className="kpi-value">${totalRevenue.toFixed(2)}</span>
                <span className="kpi-subtext positive">
                  <ArrowUpRight size={14} /> Total marketplace sales
                </span>
              </div>
            </div>

            <div className="kpi-card glass-card">
              <div className="kpi-icon tickets-icon">
                <Ticket size={24} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Paid Tickets Sold</span>
                <span className="kpi-value">{analytics?.totalTicketsSold || 0}</span>
                <span className="kpi-subtext">Across {analytics?.totalEventsHosted || 0} hosted events</span>
              </div>
            </div>

            <div className="kpi-card glass-card">
              <div className="kpi-icon fill-icon">
                <Users size={24} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Avg. Seat Fill Rate</span>
                <span className="kpi-value">{analytics?.averageFillRatePercent || 0}%</span>
                <div className="progress-bar-mini">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(100, analytics?.averageFillRatePercent || 0)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="kpi-card glass-card">
              <div className="kpi-icon stream-icon">
                <Clock size={24} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Live Broadcast Minutes</span>
                <span className="kpi-value">{analytics?.totalBroadcastMinutes || 0} min</span>
                <span className="kpi-subtext">HD WebRTC streaming time</span>
              </div>
            </div>
          </div>

          {/* Secondary Metric Highlights */}
          <div className="secondary-metrics-row">
            <div className="mini-metric glass">
              <span className="mini-label">Average Ticket Price</span>
              <span className="mini-val">${avgTicketPrice.toFixed(2)}</span>
            </div>
            <div className="mini-metric glass">
              <span className="mini-label">Active Streams Now</span>
              <span className="mini-val text-live">{analytics?.activeLiveEventsCount || 0} Live</span>
            </div>
            <div className="mini-metric glass">
              <span className="mini-label">Scheduled Upcoming</span>
              <span className="mini-val text-upcoming">{analytics?.upcomingEventsCount || 0} Events</span>
            </div>
            <div className="mini-metric glass">
              <span className="mini-label">Completed Sessions</span>
              <span className="mini-val">{analytics?.completedEventsCount || 0} Concluded</span>
            </div>
          </div>

          {/* Event Performance Breakdown Table */}
          <div className="analytics-section glass-card">
            <div className="section-header-bar">
              <div className="section-title-group">
                <BarChart3 size={20} className="text-primary" />
                <h3>Event Sales &amp; Performance Breakdown</h3>
              </div>

              <div className="filter-pill-group">
                {['all', 'live', 'published', 'ended'].map((status) => (
                  <button
                    key={status}
                    className={`filter-pill ${statusFilter === status ? 'active' : ''}`}
                    onClick={() => setStatusFilter(status)}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="empty-table-state">
                <p>No events found in this category.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Event Title</th>
                      <th>Date / Time</th>
                      <th>Status</th>
                      <th>Price</th>
                      <th>Seats Sold / Cap</th>
                      <th>Fill Rate</th>
                      <th>Total Revenue</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((ev) => {
                      const startDate = new Date(ev.startsAt);
                      const isLive = ev.status === 'live';
                      const revenue = (ev.totalRevenueCents || 0) / 100;
                      const price = ev.priceCents === 0 ? 'FREE' : `$${(ev.priceCents / 100).toFixed(2)}`;

                      return (
                        <tr key={ev.id}>
                          <td className="event-title-cell">
                            <strong>{ev.title}</strong>
                          </td>
                          <td className="event-date-cell">
                            <span>{startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span className="time-sub">{startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td>
                            <span className={`status-pill status-${ev.status}`}>
                              {isLive && <span className="pulsing-dot-inline" />}
                              {ev.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="price-cell">{price}</td>
                          <td>
                            {ev.paidTicketsCount} {ev.capacity ? `/ ${ev.capacity}` : 'tickets'}
                          </td>
                          <td className="fill-rate-cell">
                            {ev.capacity ? (
                              <div className="fill-wrapper">
                                <span>{ev.fillRatePercent}%</span>
                                <div className="fill-bar">
                                  <div className="fill-bar-inner" style={{ width: `${ev.fillRatePercent}%` }} />
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted">Unlimited</span>
                            )}
                          </td>
                          <td className="revenue-cell">
                            <strong>${revenue.toFixed(2)}</strong>
                          </td>
                          <td>
                            <button
                              className="view-event-btn"
                              onClick={() => onGoToEventDetails(ev.id)}
                              title="View Event Landing Page"
                            >
                              <ExternalLink size={15} />
                              <span>Details</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Ticket Purchases Feed */}
          {analytics?.recentSales && analytics.recentSales.length > 0 && (
            <div className="analytics-section glass-card">
              <div className="section-title-group" style={{ marginBottom: '1.25rem' }}>
                <Sparkles size={20} className="text-primary" />
                <h3>Recent Ticket Purchases &amp; Registrations</h3>
              </div>

              <div className="sales-feed-grid">
                {analytics.recentSales.map((sale) => (
                  <div key={sale.ticketId} className="sale-card glass">
                    <div className="sale-icon-avatar">
                      {sale.buyerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="sale-details">
                      <div className="sale-buyer-row">
                        <strong>{sale.buyerName}</strong>
                        <span className="sale-amount">
                          {sale.amountCents === 0 ? 'FREE' : `$${(sale.amountCents / 100).toFixed(2)}`}
                        </span>
                      </div>
                      <span className="sale-event-title">{sale.eventTitle}</span>
                      <span className="sale-time">
                        {new Date(sale.purchasedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .host-analytics-page {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .analytics-header {
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

        .analytics-header h1 {
          font-size: 2.2rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 0.5rem;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.25rem;
        }

        .kpi-card {
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1.25rem;
          border-radius: 18px;
        }

        .kpi-icon {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .revenue-icon { background: rgba(16, 185, 129, 0.18); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.35); }
        .tickets-icon { background: rgba(99, 102, 241, 0.18); color: var(--primary); border: 1px solid rgba(99, 102, 241, 0.35); }
        .fill-icon    { background: rgba(245, 158, 11, 0.18); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.35); }
        .stream-icon  { background: rgba(59, 130, 246, 0.18); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.35); }

        .kpi-content {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          flex: 1;
        }

        .kpi-label {
          font-size: 0.82rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 600;
        }

        .kpi-value {
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--text-main);
        }

        .kpi-subtext {
          font-size: 0.78rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .kpi-subtext.positive {
          color: #10b981;
          font-weight: 600;
        }

        .progress-bar-mini {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 0.4rem;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #f59e0b 0%, #10b981 100%);
          border-radius: 3px;
        }

        .secondary-metrics-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .mini-metric {
          padding: 1rem 1.25rem;
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .mini-label {
          font-size: 0.78rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .mini-val {
          font-size: 1.25rem;
          font-weight: 700;
        }

        .text-live { color: #f43f5e; }
        .text-upcoming { color: #60a5fa; }

        .analytics-section {
          padding: 1.75rem;
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .section-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .section-title-group {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .section-title-group h3 {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0;
        }

        .filter-pill-group {
          display: flex;
          gap: 0.4rem;
          background: rgba(0, 0, 0, 0.25);
          padding: 0.25rem;
          border-radius: 10px;
          border: 1px solid var(--glass-border);
        }

        .filter-pill {
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: 0.4rem 0.85rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 600;
          transition: var(--transition-fast);
        }

        .filter-pill:hover {
          color: white;
        }

        .filter-pill.active {
          background: var(--primary);
          color: white;
        }

        .table-responsive {
          overflow-x: auto;
        }

        .analytics-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .analytics-table th {
          padding: 0.85rem 1rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .analytics-table td {
          padding: 1rem;
          font-size: 0.88rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .event-title-cell {
          max-width: 240px;
          color: var(--text-main);
        }

        .event-date-cell {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .time-sub {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .price-cell {
          color: #10b981;
          font-weight: 700;
        }

        .revenue-cell {
          color: #10b981;
          font-size: 0.95rem;
        }

        .fill-wrapper {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .fill-bar {
          width: 60px;
          height: 5px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 3px;
          overflow: hidden;
        }

        .fill-bar-inner {
          height: 100%;
          background: #10b981;
          border-radius: 3px;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.2rem 0.55rem;
          border-radius: 6px;
        }

        .status-live { background: rgba(244, 63, 94, 0.2); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.5); }
        .status-published { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
        .status-ended { background: rgba(71, 85, 105, 0.2); color: #94a3b8; border: 1px solid rgba(71, 85, 105, 0.3); }
        .status-draft { background: rgba(148, 163, 184, 0.15); color: var(--text-muted); border: 1px solid rgba(148, 163, 184, 0.3); }

        .pulsing-dot-inline {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #f43f5e;
          animation: pulse 1.5s infinite;
        }

        .view-event-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          padding: 0.4rem 0.75rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.8rem;
          transition: var(--transition-fast);
        }

        .view-event-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .sales-feed-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        .sale-card {
          padding: 1rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .sale-icon-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), #7c3aed);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.95rem;
          color: white;
          flex-shrink: 0;
        }

        .sale-details {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          flex: 1;
          min-width: 0;
        }

        .sale-buyer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sale-amount {
          color: #10b981;
          font-weight: 700;
          font-size: 0.9rem;
        }

        .sale-event-title {
          font-size: 0.8rem;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sale-time {
          font-size: 0.72rem;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
};

export default HostAnalyticsPage;
