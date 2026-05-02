import React, { useState, useEffect, useRef, Component, ErrorInfo } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, MessageSquare, Users, Settings, Share2, Hand } from 'lucide-react';
import AgoraRTC from "agora-rtc-sdk-ng";
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

const screenShareClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

// SVSM App ID - normally handled via env but currently passed raw per user direction
const APP_ID = import.meta.env.VITE_AGORA_APP_ID as string;
if (!APP_ID) {
  console.error("Missing VITE_AGORA_APP_ID environment variable!");
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CHAT_APP_KEY = import.meta.env.VITE_AGORA_CHAT_APP_KEY || "41200015236#200018450";

interface RoomProps {
  sessionId: string;
  onExit: () => void;
}

interface AgoraConfig {
  channel: string;
  token: string;
  uid: number;
  expiresAt: number;
  // Chat properties
  chatToken: string;
  chatUsername: string;
  agoraChatRoomId: string;
}

const Room: React.FC<RoomProps> = ({ sessionId, onExit }) => {
  const [config, setConfig] = useState<AgoraConfig | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      const authToken = localStorage.getItem('auth_token');
      try {
        const res = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/join`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.agoraToken && data.session) {
          setConfig({
            channel: data.session.channelName,
            token: data.agoraToken,
            uid: data.uid,
            expiresAt: data.expiresAt,
            chatToken: data.chatToken,
            chatUsername: data.chatUsername,
            agoraChatRoomId: data.agoraChatRoomId
          });
        } else {
          alert('Failed to connect to room');
          onExit();
        }
      } catch (e) {
        console.error(e);
        onExit();
      }
    };
    fetchToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (!config) {
    return <div className="room-container loading">Initializing securely...</div>;
  }

  return (
    <RoomErrorBoundary>
      <ActiveRoom config={config} sessionId={sessionId} onExit={onExit} />
    </RoomErrorBoundary>
  );
};

class RoomErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null, info: ErrorInfo | null}> {
  constructor(props: {children: React.ReactNode}) {
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
        <div style={{ padding: '2rem', background: '#fee2e2', color: '#991b1b', height: '100vh', overflow: 'auto' }}>
          <h2>Room UI Crashed!</h2>
          <p><strong>Error:</strong> {this.state.error?.message}</p>
          <pre style={{ fontSize: '12px', background: 'rgba(0,0,0,0.1)', padding: '1rem' }}>
            {this.state.info?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const defaultScreenConfig = {};

const ActiveRoom: React.FC<{config: AgoraConfig, sessionId: string, onExit: () => void}> = ({ config, sessionId, onExit }) => {
  const mainClient = useRTCClient();
  const [showParticipants, setShowParticipants] = useState(false);
  const [messages, setMessages] = useState<{ id: string; sender: string; text: string; time: string; self: boolean }[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [participantCount, setParticipantCount] = useState(1);
  const [isSharing, setIsSharing] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const chatConnRef = useRef<null | any>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Agora Hooks
  const { localMicrophoneTrack, error: micError } = useLocalMicrophoneTrack(isMicOn);
  const { localCameraTrack, error: camError } = useLocalCameraTrack(isCameraOn);
  
  const { screenTrack, error: screenError } = useLocalScreenTrack(isSharing, defaultScreenConfig, "disable");

  useEffect(() => {
    if (screenError) {
      console.error('Screen share error:', screenError);
      setIsSharing(false);
    }
  }, [screenError]);

  useJoin({
    appid: APP_ID,
    channel: config.channel,
    token: config.token,
    uid: config.uid
  });

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

  usePublish(tracksToPublish);

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

  // ─── Socket.io Presence (Legacy Chat removed) ───────────────────────────────
  useEffect(() => {
    const socket = io(API_BASE, {
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.emit('join_session', sessionId);

    socket.on('count_updated', (data) => {
      setParticipantCount(data.count);
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

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

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);

  const toggleMic = () => {
    setIsMicOn(prev => !prev);
  };

  const toggleVideo = () => {
    setIsCameraOn(prev => !prev);
  };

  const toggleScreenShare = () => {
    setIsSharing(!isSharing);
  };

  const handleExit = async () => {
    const authToken = localStorage.getItem('auth_token');
    try {
      await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
    } catch (e) {
      console.error('Failed to end session on backend:', e);
    }
    onExit();
  };

  return (
    <div className="room-container animate-fade-in">
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
                ) : localCameraTrack ? (
                  <>
                    <LocalVideoTrack 
                      track={localCameraTrack} 
                      play={true} 
                    />
                    {!localCameraTrack && <div className="track-loading">Initializing camera...</div>}
                  </>
                ) : (
                  <div className="video-placeholder">
                    <div className="host-avatar">HD</div>
                    <span>Camera is off or initializing...</span>
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
              >
                {!isMicOn ? <MicOff /> : <Mic />}
              </button>
              <button 
                className={`control-btn ${!isCameraOn ? 'off' : ''}`} 
                onClick={toggleVideo}
              >
                {!isCameraOn ? <VideoOff /> : <VideoIcon />}
              </button>
              <button className="control-btn" onClick={() => alert('Hand raised')}><Hand /></button>
              <button 
                className={`control-btn ${isSharing ? 'active-share' : ''}`} 
                onClick={toggleScreenShare}
              >
                <Share2 />
              </button>
              <button className="control-btn" onClick={() => alert('Settings coming soon')}><Settings /></button>
              <button className="control-btn end-call" onClick={handleExit}><PhoneOff /></button>
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

        /* Ensure agora-rtc-react internal div fills the tile */
        .video-tile > div {
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
          gap: 1rem;
          color: var(--text-muted);
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
          background: var(--accent);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-weight: 800;
          font-size: 0.8rem;
          letter-spacing: 1px;
          z-index: 10;
        }

        .room-info {
          position: absolute;
          top: 1.5rem;
          right: 1.5rem;
          background: rgba(0, 0, 0, 0.5);
          color: var(--text-muted);
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          backdrop-filter: blur(4px);
          z-index: 10;
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
        .end-call { background: var(--accent); }
        .end-call:hover { background: #e11d48; }

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
      ` }} />
    </div>
  );
};

export default Room;
