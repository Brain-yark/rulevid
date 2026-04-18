import React, { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Room from './pages/Room';
import Wallet from './pages/Wallet';
import Layout from './components/Layout';
import AgoraRTC, { AgoraRTCProvider } from "agora-rtc-react";

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

type Page = 'login' | 'dashboard' | 'room' | 'wallet';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [user, setUser] = useState<{ email: string } | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      try {
        const response = await fetch('http://localhost:3001/api/v1/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user)); // refresh local cache
          setCurrentPage('dashboard');
        } else {
          // Token invalid or expired
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
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    } else {
      setUser({ email });
    }
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    setCurrentPage('login');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <LoginPage onLogin={handleLogin} />;
      case 'dashboard':
        return <Dashboard onJoinRoom={() => setCurrentPage('room')} onGoToWallet={() => setCurrentPage('wallet')} />;
      case 'room':
        return <Room onExit={() => setCurrentPage('dashboard')} />;
      case 'wallet':
        return <Wallet onBack={() => setCurrentPage('dashboard')} />;
      default:
        return <LoginPage onLogin={handleLogin} />;
    }
  };

  if (currentPage === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AgoraRTCProvider client={client}>
      <Layout user={user} onLogout={handleLogout} onNavigate={setCurrentPage}>
        {renderPage()}
      </Layout>
    </AgoraRTCProvider>
  );
};

export default App;
