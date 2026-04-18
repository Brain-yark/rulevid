import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, MessageSquare, Users, Settings, Share2, Hand } from 'lucide-react';
import { 
  LocalVideoTrack, 
  RemoteVideoTrack, 
  useJoin, 
  useLocalCameraTrack, 
  useLocalMicrophoneTrack, 
  usePublish, 
  useRemoteUsers 
} from "agora-rtc-react";

// SVSM App ID - normally handled via env but currently passed raw per user direction
const APP_ID = "81aeffb4262b45a8ad4c91286f55da3a";

interface RoomProps {
  sessionId: string;
  onExit: () => void;
}

interface AgoraConfig {
  channel: string;
  token: string;
  uid: number;
}

const Room: React.FC<RoomProps> = ({ sessionId, onExit }) => {
  const [config, setConfig] = useState<AgoraConfig | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      const authToken = localStorage.getItem('auth_token');
      try {
        const res = await fetch(`http://localhost:3001/api/v1/sessions/${sessionId}/join`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.agoraToken && data.session) {
          setConfig({
            channel: data.session.channelName,
            token: data.agoraToken,
            uid: data.uid
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
  }, [sessionId, onExit]);

  if (!config) {
    return <div className="room-container loading">Initializing securely...</div>;
  }

  return <ActiveRoom config={config} onExit={onExit} />;
};

const ActiveRoom: React.FC<{config: AgoraConfig, onExit: () => void}> = ({ config, onExit }) => {
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, user: 'System', text: 'Welcome to securely tokenized session!' },
  ]);
  const [inputMessage, setInputMessage] = useState('');

  // Agora Hooks
  const { localMicrophoneTrack } = useLocalMicrophoneTrack();
  const { localCameraTrack } = useLocalCameraTrack();
  
  useJoin({
    appid: APP_ID,
    channel: config.channel,
    token: config.token,
    uid: config.uid
  });

  usePublish([localMicrophoneTrack, localCameraTrack]);

  const remoteUsers = useRemoteUsers();

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      setMessages([...messages, { id: Date.now(), user: 'You', text: inputMessage }]);
      setInputMessage('');
    }
  };

  const toggleMic = () => {
    if (localMicrophoneTrack) {
      localMicrophoneTrack.setEnabled(!localMicrophoneTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (localCameraTrack) {
      localCameraTrack.setEnabled(!localCameraTrack.enabled);
    }
  };

  return (
    <div className="room-container animate-fade-in">
      <div className="main-room-layout">
        <div className="video-area">
          <div className="video-grid">
            {/* Main Speaker / Stream - Local Video */}
            <div className="video-tile main-host glass">
              {localCameraTrack ? (
                <LocalVideoTrack 
                  track={localCameraTrack} 
                  play={true} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div className="video-placeholder">
                  <div className="host-avatar">HD</div>
                  <span>Camera is off</span>
                </div>
              )}
              <div className="live-indicator">LIVE</div>
              <div className="room-info">Channel: {CHANNEL}</div>
            </div>

            {/* Audience / Co-hosts - Remote Videos */}
            <div className="audience-grid">
              {remoteUsers.length > 0 ? remoteUsers.map(user => (
                <div key={user.uid} className="video-tile audience-tile glass">
                  <RemoteVideoTrack 
                    user={user} 
                    playVideo={true} 
                    playAudio={true}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div className="video-label">User {user.uid}</div>
                </div>
              )) : (
                <div className="waiting-pill">Waiting for participants...</div>
              )}
            </div>
          </div>

          <div className="room-controls glass">
            <button 
              className={`control-btn ${!localMicrophoneTrack?.enabled ? 'off' : ''}`} 
              onClick={toggleMic}
            >
              {!localMicrophoneTrack?.enabled ? <MicOff /> : <Mic />}
            </button>
            <button 
              className={`control-btn ${!localCameraTrack?.enabled ? 'off' : ''}`} 
              onClick={toggleVideo}
            >
              {!localCameraTrack?.enabled ? <VideoOff /> : <VideoIcon />}
            </button>
            <button className="control-btn" onClick={() => alert('Hand raised')}><Hand /></button>
            <button className="control-btn" onClick={() => alert('Screen share coming soon')}><Share2 /></button>
            <button className="control-btn" onClick={() => alert('Settings coming soon')}><Settings /></button>
            <button className="control-btn end-call" onClick={onExit}><PhoneOff /></button>
          </div>
        </div>

        {isChatOpen && (
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
                <Users size={18} /> Participants (256)
              </button>
            </div>

            {!showParticipants ? (
              <div className="chat-content">
                <div className="message-list">
                  {messages.map(msg => (
                    <div key={msg.id} className="message-item">
                      <span className="msg-user">{msg.user}</span>
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
                {[1,2,3,4,5,6,7,8].map(i => (
                  <div key={i} className="participant-item">
                    <div className="avatar-small">U</div>
                    <span>User {i}</span>
                    <div className="user-perms">Audience</div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      <style>{`
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
        }

        .video-tile {
          border-radius: 20px;
          overflow: hidden;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
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
      `}</style>
    </div>
  );
};

export default Room;
