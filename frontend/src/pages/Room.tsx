import React, { useState, useEffect, useRef, Component } from 'react';
import type { ErrorInfo } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, MessageSquare, Users, Settings, Share2, Hand, AlertTriangle, AlertCircle, Zap } from 'lucide-react';
import * as AgoraChatLib from "agora-chat";
const Chat = (AgoraChatLib as any).default || AgoraChatLib;
import { 
  LocalVideoTrack, 
  RemoteVideoTrack, 
  useJoin, 
  useLocalCameraTrack, 
  useLocalMicrophoneTrack, 
  usePublish,
  useRemoteUsers,
  useLocalScreenTrack,
  useRTCClient
} from "agora-rtc-react";
import { io, Socket } from 'socket.io-client';
import { API_BASE } from '../config';

// SVSM App ID - normally handled via env but currently passed raw per user direction
const APP_ID = import.meta.env.VITE_AGORA_APP_ID as string;
if (!APP_ID) {
  console.error("Missing VITE_AGORA_APP_ID environment variable!");
}

const CHAT_APP_KEY = import.meta.env.VITE_AGORA_CHAT_APP_KEY || "41200015236#200018450";

interface RoomProps {
  sessionId?: string;
  eventId?: string;
  onExit: () => void;
  onGoToEventDetails?: (eventId: string) => void;
}

interface AgoraConfig {
  channel: string;
  token: string;
  uid: number;
  expiresAt: number;
  isHost?: boolean;
  eventTitle?: string;
  // Chat properties
  chatToken: string;
  chatUsername: string;
  agoraChatRoomId: string;
}

const Room: React.FC<RoomProps> = ({ sessionId, eventId, onExit, onGoToEventDetails }) => {
  const [config, setConfig] = useState<AgoraConfig | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduledStartsAt, setScheduledStartsAt] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      const authToken = localStorage.getItem('auth_token');
      try {
        const joinUrl = eventId
          ? `${API_BASE}/api/v1/events/${eventId}/join`
          : `${API_BASE}/api/v1/sessions/${sessionId}/join`;

        const res = await fetch(joinUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          setErrorMessage(data.message || data.error || 'Failed to access live session');
          return;
        }

        if (data.status === 'scheduled') {
          setIsScheduled(true);
          setScheduledStartsAt(data.startsAt);
          return;
        }

        if (data.agoraToken && (data.session || data.event)) {
          const channelName = data.session?.channelName || data.event?.session?.channelName;
          setConfig({
            channel: channelName,
            token: data.agoraToken,
            uid: data.uid,
            expiresAt: data.expiresAt,
            isHost: data.isHost,
            eventTitle: data.event?.title || data.session?.title,
            chatToken: data.chatToken,
            chatUsername: data.chatUsername,
            agoraChatRoomId: data.agoraChatRoomId,
          });
        } else {
          setErrorMessage(data.message || data.error || 'Failed to join live session');
        }
      } catch (e: any) {
        setErrorMessage('Unable to connect to live room server');
      }
    };
    fetchToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, eventId]);

  if (errorMessage) {
    return (
      <div className="room-container error-state glass-card animate-fade-in" style={{ padding: '3rem', textAlign: 'center', maxWidth: '500px', margin: '4rem auto' }}>
        <h3 style={{ color: '#f43f5e', marginBottom: '1rem', fontSize: '1.4rem' }}>Access Restricted</h3>
        <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.5' }}>{errorMessage}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="secondary-btn" onClick={onExit} style={{ padding: '0.75rem 1.25rem', borderRadius: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
            Exit
          </button>
          {eventId && onGoToEventDetails && (
            <button className="primary-btn" onClick={() => onGoToEventDetails(eventId)} style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', cursor: 'pointer', background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', color: 'white', border: 'none', fontWeight: 600 }}>
              Buy Ticket
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isScheduled) {
    return (
      <div className="room-container scheduled-state glass-card animate-fade-in" style={{ padding: '3rem', textAlign: 'center', maxWidth: '500px', margin: '4rem auto' }}>
        <h3 style={{ color: '#6366f1', marginBottom: '1rem', fontSize: '1.4rem' }}>Ticket Confirmed — Waiting for Host</h3>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', lineHeight: '1.5' }}>
          Your seat is confirmed! The host has not started the live broadcast yet.
        </p>
        {scheduledStartsAt && (
          <p style={{ color: '#f8fafc', fontWeight: 600, marginBottom: '2rem' }}>
            Scheduled for: {new Date(scheduledStartsAt).toLocaleString()}
          </p>
        )}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="secondary-btn" onClick={onExit} style={{ padding: '0.75rem 1.25rem', borderRadius: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
            Back
          </button>
          <button className="primary-btn" onClick={() => window.location.reload()} style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', cursor: 'pointer', background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', color: 'white', border: 'none', fontWeight: 600 }}>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  if (!config) {
    return <div className="room-container loading">Initializing securely...</div>;
  }

  return (
    <RoomErrorBoundary onExit={onExit}>
      <ActiveRoom config={config} sessionId={sessionId || eventId || ''} eventId={eventId} onExit={onExit} />
    </RoomErrorBoundary>
  );
};

class RoomErrorBoundary extends Component<{children: React.ReactNode, onExit?: () => void}, {hasError: boolean, error: Error | null, info: ErrorInfo | null}> {
  constructor(props: {children: React.ReactNode, onExit?: () => void}) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("RoomErrorBoundary caught an error:", error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#0f172a',
          color: '#f8fafc',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div className="glass-card" style={{
            padding: '2.5rem',
            maxWidth: '500px',
            borderRadius: '20px',
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#f43f5e' }}>Room Initialization Notice</h2>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              {this.state.error?.message || 'Media stream initialization notice.'}
            </p>
            <button 
              onClick={this.props.onExit || (() => window.location.reload())}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const defaultScreenConfig = {};

const ActiveRoom: React.FC<{config: AgoraConfig, sessionId: string, eventId?: string, onExit: () => void}> = ({ config, sessionId, eventId, onExit }) => {
  const mainClient = useRTCClient();
  const [showParticipants, setShowParticipants] = useState(false);
  const [messages, setMessages] = useState<{ id: string; sender: string; text: string; time: string; self: boolean }[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [participantCount, setParticipantCount] = useState(1);
  const [isSharing, setIsSharing] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const chatConnRef = useRef<null | any>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);

  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // Fallback local video preview for demo / offline test mode
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    if (isCameraOn) {
      navigator.mediaDevices?.getUserMedia({ video: true, audio: false })
        .then((stream) => {
          activeStream = stream;
          setLocalVideoStream(stream);
        })
        .catch((err) => {
          console.warn('[Room] Local camera preview fallback notice:', err);
        });
    } else {
      setLocalVideoStream(null);
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraOn]);

  useEffect(() => {
    if (localVideoRef.current && localVideoStream) {
      localVideoRef.current.srcObject = localVideoStream;
    }
  }, [localVideoStream]);

  const isAgoraReady = Boolean(APP_ID && config.token && config.channel);

  // Agora Hooks
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(isMicOn && isAgoraReady);
  const { localCameraTrack } = useLocalCameraTrack(isCameraOn && isAgoraReady);
  
  const { screenTrack, error: screenError } = useLocalScreenTrack(isSharing && isAgoraReady, defaultScreenConfig, "disable");

  useEffect(() => {
    if (screenError) {
      console.error('Screen share error:', screenError);
      setIsSharing(false);
    }
  }, [screenError]);

  useJoin({
    appid: APP_ID || '',
    channel: config.channel,
    token: config.token,
    uid: config.uid
  }, isAgoraReady);

  const tracksToPublish = React.useMemo(() => {
    const tracks = [];
    if (localMicrophoneTrack) tracks.push(localMicrophoneTrack);
    if (localCameraTrack) tracks.push(localCameraTrack);
    if (isSharing && screenTrack) {
      if (Array.isArray(screenTrack)) {
        tracks.push(...screenTrack);
      } else {
        tracks.push(screenTrack);
      }
    }
    return tracks;
  }, [localMicrophoneTrack, localCameraTrack, isSharing, screenTrack]);

  usePublish(tracksToPublish, isAgoraReady);

  useEffect(() => {
    console.log('[Room] Local tracks status:', {
      mic: !!localMicrophoneTrack,
      camera: !!localCameraTrack,
      isSharing: isSharing
    });
  }, [localMicrophoneTrack, localCameraTrack, isSharing]);

  const remoteUsers = useRemoteUsers();

  // ─── Token Auto-Refresh ─────────────────────────────────────────────────────
  useEffect(() => {
    const scheduleRefresh = (expiresAt: number) => {
      const msUntilExpiry = (expiresAt * 1000) - Date.now();
      const refreshAt = msUntilExpiry - 5 * 60 * 1000; // 5 minutes before expiry

      if (refreshAt <= 0) return; // Token already near expiry

      tokenRefreshTimerRef.current = setTimeout(async () => {
        try {
          const authToken = localStorage.getItem('auth_token');
          const res = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/refresh-token`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
          });
          const data = await res.json();
          if (data.agoraToken) {
            // Renew the token on the active Agora client without disconnecting
            await mainClient.renewToken(data.agoraToken);
            console.log('[Room] Agora token refreshed successfully');
            scheduleRefresh(data.expiresAt); // Schedule next refresh
          }
        } catch (err) {
          console.error('[Room] Token refresh failed:', err);
        }
      }, refreshAt);
    };

    scheduleRefresh(config.expiresAt);

    return () => {
      if (tokenRefreshTimerRef.current) clearTimeout(tokenRefreshTimerRef.current);
    };
  }, [sessionId, config.expiresAt, mainClient]);

  // ─── Agora Chat Integration ─────────────────────────────────────────────
  useEffect(() => {
    const APP_KEY = CHAT_APP_KEY;
    if (!Chat || !Chat.connection) {
      console.error('[Chat] Agora Chat library or connection constructor not found');
      return;
    }

    const conn = new Chat.connection({
      appKey: APP_KEY,
    });
    chatConnRef.current = conn;

    conn.addEventHandler('SESSION_CHAT', {
      onConnected: () => {
        console.log('[Chat] Connected to Agora Chat');
        if (config.agoraChatRoomId) {
          conn.joinChatRoom({ roomId: config.agoraChatRoomId });
        } else {
          console.warn('[Chat] No chat room ID available for this session.');
        }
      },
      onTextMessage: (message: any) => {
        console.log('[Chat] Message received:', message);
        setMessages((prev) => [...prev, {
          id: message.id,
          sender: message.from,
          text: message.msg,
          time: new Date().toLocaleTimeString(),
          self: false
        }]);
      },
      onError: (error: any) => {
        console.error('[Chat] Error:', error);
      }
    });

    conn.open({
      user: config.chatUsername,
      agoraToken: config.chatToken,
    });

    return () => {
      conn.close();
    };
  }, [config.chatUsername, config.chatToken, config.agoraChatRoomId]);

  // In-stream Billing & Low Balance States
  const [lowBalanceAlert, setLowBalanceAlert] = useState<{
    minutesRemaining: number;
    estimatedMinutesLeft: number;
    percentRemaining: number;
    message: string;
    canOneClickTopup: boolean;
  } | null>(null);
  const [graceCountdown, setGraceCountdown] = useState<number | null>(null);
  const [isTopupProcessing, setIsTopupProcessing] = useState(false);

  // ─── Socket.io Presence & Billing Monitoring ───────────────────────────────
  useEffect(() => {
    const socket = io(API_BASE, {
      withCredentials: true,
    });
    socketRef.current = socket;

    const storedUser = (() => {
      try {
        return JSON.parse(localStorage.getItem('user') || '{}');
      } catch {
        return {};
      }
    })();

    if (storedUser?.id) {
      socket.emit('register_user', storedUser.id);
    }

    socket.emit('join_session', sessionId);

    socket.on('count_updated', (data) => {
      setParticipantCount(data.count);
    });

    socket.on('billing:low_balance', (data) => {
      setLowBalanceAlert(data);
    });

    socket.on('billing:grace_period', (data) => {
      setGraceCountdown(data.secondsRemaining);
    });

    socket.on('billing:overage_charged', () => {
      setLowBalanceAlert(null);
      setGraceCountdown(null);
    });

    socket.on('billing:stream_ending', (data) => {
      alert(data.message || 'This live stream has ended.');
      onExit();
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId, onExit]);

  const handleInStreamTopup = async () => {
    setIsTopupProcessing(true);
    try {
      const authToken = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE}/api/v1/billing/one-click-topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (res.ok) {
        setLowBalanceAlert(null);
        setGraceCountdown(null);
      } else {
        alert(data.error || 'Failed to top up. Please check your payment method on file.');
      }
    } catch (err: any) {
      console.error('In-stream topup failed:', err);
    } finally {
      setIsTopupProcessing(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && chatConnRef.current) {
      const msg = Chat.message.create({
        type: 'txt',
        msg: inputMessage,
        to: config.agoraChatRoomId,
        chatType: 'chatRoom',
      });

      chatConnRef.current.send(msg).then(() => {
        console.log('[Chat] Message sent');
        setMessages((prev) => [...prev, {
          id: Date.now().toString(),
          sender: config.chatUsername,
          text: inputMessage,
          time: new Date().toLocaleTimeString(),
          self: true
        }]);
        setInputMessage('');
      }).catch((err: unknown) => {
        console.error('[Chat] Failed to send message:', err);
      });
    }
  };

  const toggleMic = () => {
    setIsMicOn(prev => !prev);
  };

  const toggleVideo = () => {
    setIsCameraOn(prev => !prev);
  };

  const toggleScreenShare = () => {
    setIsSharing(!isSharing);
  };

  const handleEndSessionForAll = async () => {
    if (!window.confirm('Are you sure you want to end this live session for everyone?')) return;
    const authToken = localStorage.getItem('auth_token');
    try {
      if (eventId && config.isHost) {
        await fetch(`${API_BASE}/api/v1/events/${eventId}/end`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } else if (sessionId && !eventId) {
        await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/end`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    } catch (e) {
      console.error('Failed to end session/event on backend:', e);
    }
    onExit();
  };

  const handleLeaveRoom = () => {
    onExit();
  };

  return (
    <div className="room-container animate-fade-in">
        {/* ── In-Stream Low Balance Alert Banner for Host ── */}
        {lowBalanceAlert && !graceCountdown && (
          <div className="in-stream-warning-banner low-balance animate-fade-in">
            <div className="warning-content">
              <AlertTriangle size={20} className="warning-icon" />
              <div>
                <strong>Low on Minutes ({lowBalanceAlert.percentRemaining}% remaining)</strong>
                <span>
                  {lowBalanceAlert.minutesRemaining.toLocaleString()} mins left — ~{lowBalanceAlert.estimatedMinutesLeft} mins left at current audience size
                </span>
              </div>
            </div>
            <div className="warning-actions">
              <button
                type="button"
                className="instream-topup-btn"
                onClick={handleInStreamTopup}
                disabled={isTopupProcessing}
              >
                <Zap size={16} />
                <span>{isTopupProcessing ? 'Processing...' : '1-Click Top Up ($10)'}</span>
              </button>
              <button
                type="button"
                className="close-warning-btn"
                onClick={() => setLowBalanceAlert(null)}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* ── Grace Period Cutoff Countdown Banner ── */}
        {graceCountdown !== null && (
          <div className="in-stream-warning-banner grace-period animate-fade-in">
            <div className="warning-content">
              <AlertCircle size={22} className="danger-icon pulse" />
              <div>
                <strong>Participant-Minutes Depleted — Stream Ending Soon!</strong>
                <span>
                  Grace period active: <strong>{graceCountdown}s</strong> remaining before stream ends gracefully.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="instream-topup-btn urgent"
              onClick={handleInStreamTopup}
              disabled={isTopupProcessing}
            >
              <Zap size={16} />
              <span>{isTopupProcessing ? 'Processing...' : 'Top Up Now ($10)'}</span>
            </button>
          </div>
        )}

        <div className="main-room-layout">
          <div className="video-area">
            <div className="video-grid">
              {/* Main Speaker / Stream - Local Video or Screen Share */}
              <div className="video-tile main-host glass">
                {isSharing && screenTrack ? (
                  <LocalVideoTrack 
                    track={Array.isArray(screenTrack) ? screenTrack[0] : screenTrack} 
                    play={true} 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                  />
                ) : isAgoraReady && localCameraTrack ? (
                  <LocalVideoTrack 
                    track={localCameraTrack} 
                    play={true} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : isCameraOn && localVideoStream ? (
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
                  />
                ) : (
                  <div className="video-placeholder">
                    <div className="host-avatar">HD</div>
                    <span>{isCameraOn ? "Camera feed initializing..." : "Camera is turned off"}</span>
                  </div>
                )}
                <div className="live-indicator">{isSharing ? 'SCREEN SHARING' : 'LIVE'}</div>
                <div className="room-info">Channel: {config.channel}</div>
              </div>

              {/* Audience / Co-hosts - Remote Videos */}
              <div className="audience-grid">
                {remoteUsers.length > 0 ? remoteUsers.map(user => (
                  <div key={user.uid} className="video-tile audience-tile glass">
                    {user.videoTrack ? (
                      <RemoteVideoTrack 
                        track={user.videoTrack} 
                        play={true}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="video-placeholder">Audio Only</div>
                    )}
                    <div className="video-label">User {user.uid}</div>
                  </div>
                )) : (
                  <div className="waiting-pill">Waiting for participants...</div>
                )}
              </div>
            </div>

            <div className="room-controls glass">
              <button 
                className={`control-btn ${!isMicOn ? 'off' : ''}`} 
                onClick={toggleMic}
                title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
              >
                {!isMicOn ? <MicOff /> : <Mic />}
              </button>
              <button 
                className={`control-btn ${!isCameraOn ? 'off' : ''}`} 
                onClick={toggleVideo}
                title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
              >
                {!isCameraOn ? <VideoOff /> : <VideoIcon />}
              </button>
              <button className="control-btn" onClick={() => alert('Hand raised')} title="Raise Hand"><Hand /></button>
              <button 
                className={`control-btn ${isSharing ? 'active-share' : ''}`} 
                onClick={toggleScreenShare}
                title="Toggle Screen Share"
              >
                <Share2 />
              </button>
              <button className="control-btn" onClick={() => alert('Settings coming soon')} title="Settings"><Settings /></button>
              
              {/* Leave Room for Attendees / Hosts */}
              <button className="control-btn leave-call-btn" onClick={handleLeaveRoom} title="Leave room">
                <PhoneOff />
              </button>

              {/* Explicit End Session button for Hosts */}
              {config.isHost && (
                <button 
                  className="control-btn end-session-host-btn" 
                  onClick={handleEndSessionForAll}
                  title="End live broadcast for all participants"
                >
                  End Session
                </button>
              )}
            </div>
          </div>

        <aside className="side-panel glass-card">
          <div className="panel-tabs">
            <button 
              className={`panel-tab ${!showParticipants ? 'active' : ''}`}
              onClick={() => setShowParticipants(false)}
            >
              <MessageSquare size={18} /> Chat
            </button>
            <button 
              className={`panel-tab ${showParticipants ? 'active' : ''}`}
              onClick={() => setShowParticipants(true)}
            >
              <Users size={18} /> Participants ({participantCount})
            </button>
          </div>

          {!showParticipants ? (
            <div className="chat-content">
              <div className="message-list">
                {messages.length === 0 && (
                   <div className="message-item system">
                      <span className="msg-user">System</span>
                      <p className="msg-text">Welcome to securely tokenized session!</p>
                   </div>
                )}
                {messages.map(msg => (
                  <div key={msg.id} className={`message-item ${msg.self ? 'self' : ''}`}>
                    <span className="msg-user">{msg.sender}</span>
                    <p className="msg-text">{msg.text}</p>
                  </div>
                ))}
              </div>
              <form className="chat-input-area" onSubmit={handleSendMessage}>
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                />
                <button type="submit">Send</button>
              </form>
            </div>
          ) : (
            <div className="participant-list">
              <div className="participant-item">
                <div className="avatar-small">ME</div>
                <span>You (Facilitator)</span>
                <div className="user-perms">Host</div>
              </div>
              {remoteUsers.map(user => (
                <div key={user.uid} className="participant-item">
                  <div className="avatar-small">U</div>
                  <span>User {user.uid}</span>
                  <div className="user-perms">Attendee</div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .room-container {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: #000;
          z-index: 1000;
        }

        .main-room-layout {
          display: flex;
          height: 100%;
        }

        .video-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 1.5rem;
          gap: 1.5rem;
          position: relative;
        }

        .video-grid {
          flex: 1;
          display: grid;
          grid-template-rows: 1fr auto;
          gap: 1.5rem;
          min-height: 0; /* Fix flex child height issue */
        }

        .video-tile {
          border-radius: 20px;
          overflow: hidden;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }

        .video-tile video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          position: absolute;
          top: 0;
          left: 0;
        }

        /* Ensure agora-rtc-react internal div fills the tile, excluding badge overlays */
        .video-tile > div:not(.live-indicator):not(.room-info):not(.video-placeholder) {
          width: 100% !important;
          height: 100% !important;
        }

        .main-host {
          grid-row: 1;
          background: #1e293b;
        }

        .audience-grid {
          display: flex;
          gap: 1rem;
          overflow-x: auto;
          padding: 0.5rem 0;
          height: 120px;
        }

        .audience-tile {
          flex: 0 0 160px;
          background: #334155;
        }

        .video-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          color: var(--text-muted);
          width: 100% !important;
          height: 100% !important;
        }

        .host-avatar {
          width: 80px;
          height: 80px;
          background: var(--primary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          font-weight: 700;
          color: white;
        }

        .live-indicator {
          position: absolute;
          top: 1.5rem;
          left: 1.5rem;
          width: auto !important;
          height: auto !important;
          background: var(--accent);
          color: white;
          padding: 0.35rem 0.75rem;
          border-radius: 6px;
          font-weight: 800;
          font-size: 0.75rem;
          letter-spacing: 1px;
          z-index: 20;
          box-shadow: 0 4px 12px rgba(244, 63, 94, 0.4);
        }

        .room-info {
          position: absolute;
          top: 1.5rem;
          right: 1.5rem;
          width: auto !important;
          height: auto !important;
          background: rgba(0, 0, 0, 0.6);
          color: var(--text-muted);
          padding: 0.35rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
          backdrop-filter: blur(4px);
          z-index: 20;
        }

        .waiting-pill {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-muted);
          padding: 1rem 2rem;
          border-radius: 50px;
          font-size: 0.9rem;
          border: 1px dashed var(--glass-border);
          margin: auto;
        }

        .video-label {
          position: absolute;
          bottom: 0.75rem;
          left: 0.75rem;
          background: rgba(0, 0, 0, 0.5);
          color: white;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.7rem;
          backdrop-filter: blur(4px);
        }

        .room-controls {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          padding: 1rem;
          max-width: fit-content;
          margin: 0 auto;
          border-radius: 50px;
        }

        .control-btn {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .control-btn:hover { background: rgba(255, 255, 255, 0.2); }
        .control-btn.off { background: var(--accent); }
        .end-call, .leave-call-btn { background: rgba(244, 63, 94, 0.2); color: #fda4af; border: 1px solid rgba(244, 63, 94, 0.4); }
        .leave-call-btn:hover { background: #f43f5e; color: white; }
        .end-session-host-btn {
          background: #f43f5e;
          color: white;
          width: auto !important;
          padding: 0 1.25rem !important;
          font-weight: 700;
          font-size: 0.9rem;
          letter-spacing: 0.02em;
          box-shadow: 0 4px 14px rgba(244, 63, 94, 0.4);
        }
        .end-session-host-btn:hover {
          background: #e11d48;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(244, 63, 94, 0.6);
        }

        .side-panel {
          width: 350px;
          display: flex;
          flex-direction: column;
          margin: 1.5rem;
          margin-left: 0;
          padding: 0;
          overflow: hidden;
        }

        .panel-tabs {
          display: flex;
          border-bottom: 1px solid var(--glass-border);
        }

        .panel-tab {
          flex: 1;
          padding: 1rem;
          background: none;
          border: none;
          color: var(--text-muted);
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: var(--transition-fast);
        }

        .panel-tab.active {
          color: var(--primary);
          background: rgba(99, 102, 241, 0.05);
          border-bottom: 2px solid var(--primary);
        }

        .chat-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .message-list {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .message-item {
          background: rgba(255, 255, 255, 0.03);
          padding: 0.75rem;
          border-radius: 12px;
        }

        .msg-user {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--primary);
          display: block;
          margin-bottom: 0.25rem;
        }

        .msg-text {
          font-size: 0.9rem;
          color: var(--text-main);
        }

        .chat-input-area {
          padding: 1.5rem;
          border-top: 1px solid var(--glass-border);
          display: flex;
          gap: 0.5rem;
        }

        .chat-input-area input {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 0.5rem 1rem;
          color: white;
          outline: none;
        }

        .chat-input-area button {
          background: var(--primary);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .participant-list {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .participant-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
        }

        .avatar-small {
          width: 32px;
          height: 32px;
          background: #475569;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          color: white;
        }

        .user-perms {
          margin-left: auto;
          font-size: 0.7rem;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.05);
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
        }

        /* ── In-Stream Billing Alert Banners ── */
        .in-stream-warning-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.85rem 1.5rem;
          margin: 0.75rem 1.5rem 0 1.5rem;
          border-radius: 14px;
          z-index: 50;
        }

        .in-stream-warning-banner.low-balance {
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.4);
          color: #fbbf24;
          box-shadow: 0 4px 20px rgba(245, 158, 11, 0.2);
        }

        .in-stream-warning-banner.grace-period {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.5);
          color: #fca5a5;
          box-shadow: 0 4px 25px rgba(239, 68, 68, 0.35);
        }

        .warning-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .warning-content div {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .warning-content strong {
          color: white;
          font-size: 0.95rem;
        }

        .warning-content span {
          font-size: 0.82rem;
          opacity: 0.9;
        }

        .warning-icon {
          color: #f59e0b;
          flex-shrink: 0;
        }

        .danger-icon {
          color: #ef4444;
          flex-shrink: 0;
        }

        .warning-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .instream-topup-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.55rem 1.1rem;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border: none;
          color: white;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
        }

        .instream-topup-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.5);
        }

        .instream-topup-btn.urgent {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
        }

        .instream-topup-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .close-warning-btn {
          background: none;
          border: none;
          color: inherit;
          font-size: 1.3rem;
          cursor: pointer;
          padding: 0.2rem 0.5rem;
          line-height: 1;
        }
      ` }} />
    </div>
  );
};

export default Room;
