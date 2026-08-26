import React, { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import SuperAdminPage from './pages/SuperAdminPage';
import EventsPage from './pages/EventsPage';
import EventDetailsPage from './pages/EventDetailsPage';
import ProfilePage from './pages/ProfilePage';
import HostAnalyticsPage from './pages/HostAnalyticsPage';
import Room from './pages/Room';
import Wallet from './pages/Wallet';
import Layout from './components/Layout';
import AgoraRTC, { AgoraRTCProvider } from "agora-rtc-react";
import { API_BASE } from './config';
import { useToast } from './context/ToastContext';
import type { User } from '../../shared/types';

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

type Page = 'login' | 'events' | 'event-details' | 'dashboard' | 'super-admin' | 'room' | 'wallet' | 'profile' | 'analytics';

const App: React.FC = () => {
  const toast = useToast();
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check if direct event link was visited: e.g. /?event=UUID
    const urlParams = new URLSearchParams(window.location.search);
    const eventParam = urlParams.get('event');
    if (eventParam) {
      setActiveEventId(eventParam);
      setCurrentPage('event-details');
    }

    const validateToken = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      try {
        const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user)); 
          if (!eventParam) {
            if (data.user.role === 'super_admin' || data.user.role === 'admin') {
              setCurrentPage('super-admin');
            } else if (data.user.role === 'host' || data.user.role === 'moderator') {
              setCurrentPage('dashboard');
            } else {
              setCurrentPage('events');
            }
          }
        } else {
          handleLogout();
        }
      } catch (err) {
        console.error('Failed to validate token:', err);
      }
    };

    validateToken();
  }, []);

  const handleLogin = (email: string) => {
    const savedUser = localStorage.getItem('user');
    let loggedUser: User;
    if (savedUser) {
      loggedUser = JSON.parse(savedUser);
      setUser(loggedUser);
    } else {
      loggedUser = {
        id: '',
        email,
        role: 'user',
        pricingTier: 'standard',
        status: 'active',
      };
      setUser(loggedUser);
    }

    if (activeEventId) {
      setCurrentPage('event-details');
    } else if (loggedUser.role === 'super_admin' || loggedUser.role === 'admin') {
      setCurrentPage('super-admin');
    } else if (loggedUser.role === 'host' || loggedUser.role === 'moderator') {
      setCurrentPage('dashboard');
    } else {
      setCurrentPage('events');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    setActiveSessionId(null);
    setActiveEventId(null);
    setCurrentPage('login');
    toast.info('Signed Out', 'You have been successfully signed out of RuleVid.');
  };

  const navigateToEventDetails = (eventId: string) => {
    setActiveEventId(eventId);
    const url = new URL(window.location.href);
    url.searchParams.set('event', eventId);
    window.history.pushState({}, '', url.toString());
    setCurrentPage('event-details');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <LoginPage onLogin={handleLogin} />;
      case 'super-admin':
        return (
          <SuperAdminPage 
            onJoinRoom={(id) => {
              setActiveSessionId(id);
              setActiveEventId(null);
              setCurrentPage('room');
            }}
          />
        );
      case 'events':
        return (
          <EventsPage 
            onJoinEvent={(id) => {
              setActiveEventId(id);
              setActiveSessionId(null);
              setCurrentPage('room');
            }}
            onViewEventDetails={navigateToEventDetails}
          />
        );
      case 'profile':
        return (
          <ProfilePage
            onUpdateUser={(updated) => setUser(updated)}
            onNavigateToEvents={() => setCurrentPage('events')}
            onNavigateToHostStudio={() => setCurrentPage('dashboard')}
          />
        );
      case 'analytics':
        return (
          <HostAnalyticsPage
            onGoToEventDetails={navigateToEventDetails}
            onGoToHostStudio={() => setCurrentPage('dashboard')}
          />
        );
      case 'event-details':
        return activeEventId ? (
          <EventDetailsPage 
            eventId={activeEventId}
            onJoinRoom={(id) => {
              setActiveEventId(id);
              setActiveSessionId(null);
              setCurrentPage('room');
            }}
            onBack={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete('event');
              window.history.pushState({}, '', url.pathname);
              setCurrentPage(user ? (user.role === 'host' ? 'dashboard' : 'events') : 'login');
            }}
            onRequireLogin={() => setCurrentPage('login')}
          />
        ) : (
          <EventsPage 
            onJoinEvent={(id) => {
              setActiveEventId(id);
              setActiveSessionId(null);
              setCurrentPage('room');
            }}
            onViewEventDetails={navigateToEventDetails}
          />
        );
      case 'dashboard':
        return (
          <Dashboard 
            onJoinRoom={(id) => { 
              setActiveSessionId(id); 
              setActiveEventId(null);
              setCurrentPage('room'); 
            }} 
            onGoToWallet={() => setCurrentPage('wallet')} 
          />
        );
      case 'room':
        return (activeSessionId || activeEventId) ? (
          <Room 
            sessionId={activeSessionId || undefined} 
            eventId={activeEventId || undefined}
            onExit={() => { 
              setActiveSessionId(null); 
              setActiveEventId(null); 
              setCurrentPage(user ? (user.role === 'super_admin' ? 'super-admin' : user.role === 'host' ? 'dashboard' : 'events') : 'login'); 
            }} 
            onGoToEventDetails={navigateToEventDetails}
          /> 
        ) : (
          <EventsPage 
            onJoinEvent={(id) => {
              setActiveEventId(id);
              setActiveSessionId(null);
              setCurrentPage('room');
            }}
            onViewEventDetails={navigateToEventDetails}
          />
        );
      case 'wallet':
        return <Wallet onBack={() => setCurrentPage(user?.role === 'host' ? 'dashboard' : 'events')} />;
      default:
        return <LoginPage onLogin={handleLogin} />;
    }
  };

  // If viewing public event landing page without login, allow displaying it inside provider shell
  if (currentPage === 'event-details' && !user && activeEventId) {
    return (
      <AgoraRTCProvider client={client}>
        <div style={{ minHeight: '100vh', padding: '2rem' }}>
          {renderPage()}
        </div>
      </AgoraRTCProvider>
    );
  }

  if (currentPage === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AgoraRTCProvider client={client}>
      <Layout 
        user={user} 
        currentPage={currentPage} 
        onLogout={handleLogout} 
        onNavigate={(page) => {
          if (page === 'events') {
            const url = new URL(window.location.href);
            url.searchParams.delete('event');
            window.history.pushState({}, '', url.pathname);
          }
          setCurrentPage(page);
        }}
      >
        {renderPage()}
      </Layout>
    </AgoraRTCProvider>
  );
};

export default App;
