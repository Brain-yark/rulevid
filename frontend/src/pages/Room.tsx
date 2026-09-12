import React, { useState, useEffect, useRef, Component } from "react";
import type { ErrorInfo } from "react";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  MessageSquare,
  Users,
  Settings,
  Monitor,
  MonitorOff,
  StopCircle,
  Maximize2,
  Minimize2,
  Hand,
  AlertTriangle,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import * as AgoraChatLib from "agora-chat";
const Chat = (AgoraChatLib as any).default || AgoraChatLib;
import {
  LocalVideoTrack,
  RemoteVideoTrack,
  RemoteAudioTrack,
  useJoin,
  useLocalCameraTrack,
  useLocalMicrophoneTrack,
  usePublish,
  useRemoteUsers,
  useRemoteUserTrack,
  useLocalScreenTrack,
  useTrackEvent,
  useRTCClient,
  useConnectionState,
} from "agora-rtc-react";
import { io, Socket } from "socket.io-client";
import { API_BASE } from "../config";

// SVSM App ID - with resilient fallback
const APP_ID =
  (import.meta.env.VITE_AGORA_APP_ID as string) ||
  "81aeffb4262b45a8ad4c91286f55da3a";

const CHAT_APP_KEY =
  import.meta.env.VITE_AGORA_CHAT_APP_KEY || "41200015236#200018450";

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
  hostUid?: number;
  expiresAt: number;
  isHost?: boolean;
  eventTitle?: string;
  // Chat properties
  chatToken: string;
  chatUsername: string;
  agoraChatRoomId: string;
}

const Room: React.FC<RoomProps> = ({
  sessionId,
  eventId,
  onExit,
  onGoToEventDetails,
}) => {
  const [config, setConfig] = useState<AgoraConfig | null>(null);
  const [resolvedSessionId, setResolvedSessionId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [isSessionEnded, setIsSessionEnded] = useState<boolean>(false);
  const [scheduledStartsAt, setScheduledStartsAt] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const fetchToken = async () => {
      const authToken = localStorage.getItem("auth_token");
      try {
        const joinUrl = eventId
          ? `${API_BASE}/api/v1/events/${eventId}/join`
          : `${API_BASE}/api/v1/sessions/${sessionId}/join`;

        const res = await fetch(joinUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          const msg =
            data.message || data.error || "Failed to access live session";
          if (
            data.error === "Event has ended" ||
            data.error === "Event has concluded" ||
            (typeof msg === "string" && msg.toLowerCase().includes("ended")) ||
            data.status === "ended"
          ) {
            setIsSessionEnded(true);
            return;
          }
          console.error("[Room] API error joining live session:", {
            status: res.status,
            data,
          });
          setErrorMessage(msg);
          return;
        }

        if (data.status === "scheduled") {
          setIsScheduled(true);
          setScheduledStartsAt(data.startsAt);
          return;
        }

        if (data.agoraToken && (data.session || data.event)) {
          const channelName =
            data.session?.channelName || data.event?.session?.channelName;
          const actualSessionId =
            data.sessionId ||
            data.session?.id ||
            data.event?.session?.id ||
            data.event?.sessionId ||
            sessionId ||
            eventId ||
            "";

          setResolvedSessionId(actualSessionId);
          setIsScheduled(false);
          setConfig({
            channel: channelName,
            token: data.agoraToken,
            uid: data.uid,
            hostUid: data.hostUid,
            expiresAt: data.expiresAt,
            isHost: data.isHost,
            eventTitle: data.event?.title || data.session?.title,
            chatToken: data.chatToken,
            chatUsername: data.chatUsername,
            agoraChatRoomId: data.agoraChatRoomId,
          });
        } else {
          console.error("[Room] Invalid room response payload:", data);
          setErrorMessage(
            data.message || data.error || "Failed to join live session",
          );
        }
      } catch (e: any) {
        console.error(
          "[Room] Network or server exception fetching live token:",
          e,
        );
        setErrorMessage(
          "Unable to connect to live room server: " + (e?.message || e),
        );
      }
    };
    fetchToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, eventId]);

  // Auto-poll when scheduled: attendees need to know when the host starts the event
  useEffect(() => {
    if (!isScheduled) return;

    const pollInterval = setInterval(async () => {
      const authToken = localStorage.getItem("auth_token");
      if (!authToken) return;

      try {
        const joinUrl = eventId
          ? `${API_BASE}/api/v1/events/${eventId}/join`
          : `${API_BASE}/api/v1/sessions/${sessionId}/join`;

        const res = await fetch(joinUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        });

        const data = await res.json();

        if (
          !res.ok &&
          (data.error === "Event has ended" ||
            data.error === "Event has concluded" ||
            (typeof data.message === "string" &&
              data.message.toLowerCase().includes("ended")) ||
            data.status === "ended")
        ) {
          setIsSessionEnded(true);
          return;
        }

        if (res.ok && data.agoraToken && data.status !== "scheduled") {
          const channelName =
            data.session?.channelName || data.event?.session?.channelName;
          const actualSessionId =
            data.sessionId ||
            data.session?.id ||
            data.event?.session?.id ||
            data.event?.sessionId ||
            sessionId ||
            eventId ||
            "";

          setResolvedSessionId(actualSessionId);
          setIsScheduled(false);
          setConfig({
            channel: channelName,
            token: data.agoraToken,
            uid: data.uid,
            hostUid: data.hostUid,
            expiresAt: data.expiresAt,
            isHost: data.isHost,
            eventTitle: data.event?.title || data.session?.title,
            chatToken: data.chatToken,
            chatUsername: data.chatUsername,
            agoraChatRoomId: data.agoraChatRoomId,
          });
        }
      } catch (err) {
        // Silently fail during polling
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [isScheduled, eventId, sessionId]);

  if (errorMessage) {
    return (
      <div
        className="room-container error-state glass-card animate-fade-in"
        style={{
          padding: "3rem",
          textAlign: "center",
          maxWidth: "500px",
          margin: "4rem auto",
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f43f5e',
            }}
          >
            <Users size={28} />
          </div>
        </div>
        <h3
          style={{ color: "#f43f5e", marginBottom: "1rem", fontSize: "1.4rem" }}
        >
          {errorMessage.toLowerCase().includes('capacity') || errorMessage.toLowerCase().includes('participant')
            ? 'Session Capacity Reached'
            : 'Access Restricted'}
        </h3>
        <p
          style={{ color: "#94a3b8", marginBottom: "2rem", lineHeight: "1.6", fontSize: '0.95rem' }}
        >
          {errorMessage}
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <button
            className="secondary-btn"
            onClick={onExit}
            style={{
              padding: "0.75rem 1.25rem",
              borderRadius: "10px",
              cursor: "pointer",
              background: "rgba(255,255,255,0.05)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            Exit
          </button>
          {eventId && onGoToEventDetails && (
            <button
              className="primary-btn"
              onClick={() => onGoToEventDetails(eventId)}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "10px",
                cursor: "pointer",
                background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
                color: "white",
                border: "none",
                fontWeight: 600,
              }}
            >
              Buy Ticket
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isScheduled || isSessionEnded) {
    return (
      <div
        className="room-container scheduled-state glass-card animate-fade-in"
        style={{
          padding: "3rem",
          textAlign: "center",
          maxWidth: "500px",
          margin: "4rem auto",
        }}
      >
        <h3
          style={{
            color: isSessionEnded ? "#ef4444" : "#6366f1",
            marginBottom: "1rem",
            fontSize: "1.4rem",
            fontWeight: 700,
          }}
        >
          {isSessionEnded
            ? "🔴 This session has been ended by the host"
            : "Ticket Confirmed — Waiting for Host"}
        </h3>
        <p
          style={{
            color: "#94a3b8",
            marginBottom: "1.5rem",
            lineHeight: "1.5",
          }}
        >
          {isSessionEnded
            ? "The host has concluded this live event. Thank you for attending!"
            : "Your seat is confirmed! The host has not started the live broadcast yet."}
        </p>
        {!isSessionEnded && (
          <p
            style={{
              color: "#64748b",
              fontSize: "0.85rem",
              marginBottom: "1.5rem",
            }}
          >
            Auto-refreshing every 3 seconds...
          </p>
        )}
        {!isSessionEnded && scheduledStartsAt && (
          <p
            style={{ color: "#f8fafc", fontWeight: 600, marginBottom: "2rem" }}
          >
            Scheduled for: {new Date(scheduledStartsAt).toLocaleString()}
          </p>
        )}
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <button
            className="secondary-btn"
            onClick={onExit}
            style={{
              padding: "0.75rem 1.25rem",
              borderRadius: "10px",
              cursor: "pointer",
              background: isSessionEnded
                ? "rgba(239, 68, 68, 0.15)"
                : "rgba(255,255,255,0.05)",
              color: isSessionEnded ? "#fca5a5" : "white",
              border: isSessionEnded
                ? "1px solid rgba(239, 68, 68, 0.3)"
                : "1px solid rgba(255,255,255,0.1)",
              fontWeight: 600,
            }}
          >
            {isSessionEnded ? "Return to Events" : "Back"}
          </button>
          {!isSessionEnded && (
            <button
              className="primary-btn"
              onClick={() => window.location.reload()}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "10px",
                cursor: "pointer",
                background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
                color: "white",
                border: "none",
                fontWeight: 600,
              }}
            >
              Refresh Now
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="room-container loading">Initializing securely...</div>
    );
  }

  return (
    <RoomErrorBoundary onExit={onExit}>
      <ActiveRoom
        config={config}
        sessionId={resolvedSessionId || sessionId || eventId || ""}
        eventId={eventId}
        onExit={onExit}
      />
    </RoomErrorBoundary>
  );
};

class RoomErrorBoundary extends Component<
  { children: React.ReactNode; onExit?: () => void },
  { hasError: boolean; error: Error | null; info: ErrorInfo | null }
> {
  constructor(props: { children: React.ReactNode; onExit?: () => void }) {
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: "#0f172a",
            color: "#f8fafc",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div
            className="glass-card"
            style={{
              padding: "2.5rem",
              maxWidth: "500px",
              borderRadius: "20px",
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
            }}
          >
            <h2
              style={{
                fontSize: "1.5rem",
                marginBottom: "1rem",
                color: "#f43f5e",
              }}
            >
              Room Initialization Notice
            </h2>
            <p
              style={{
                color: "#94a3b8",
                marginBottom: "1.5rem",
                fontSize: "0.95rem",
              }}
            >
              {this.state.error?.message ||
                "Media stream initialization notice."}
            </p>
            <button
              onClick={this.props.onExit || (() => window.location.reload())}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#6366f1",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                cursor: "pointer",
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

const defaultScreenConfig = {
  encoderConfig: "1080p_2" as const,
  optimizationMode: "detail" as const,
};

export interface SessionParticipant {
  socketId: string;
  userId?: string;
  name: string;
  email?: string;
  role: string;
  agoraUid?: number;
  isHost: boolean;
  handRaised?: boolean;
  canSpeak?: boolean;
  joinedAt?: string;
}

const AttendeeProfileCard: React.FC<{
  participant?: SessionParticipant;
  remoteUser?: any;
  audioTrack?: any;
  videoTrack?: any;
  isHost?: boolean;
  isHostView?: boolean;
  onAllowSpeak?: (socketId: string) => void;
  onGrantSpeak?: (socketId: string, userId?: string) => void;
  onRevokeSpeak?: (socketId: string) => void;
}> = ({
  participant,
  remoteUser,
  audioTrack: audioTrackProp,
  isHost: isHostProp,
  isHostView,
  onAllowSpeak,
  onGrantSpeak,
  onRevokeSpeak,
}) => {
  const isHostView2 = isHostProp || isHostView;
  const { track: remoteAudioTrack } = useRemoteUserTrack(remoteUser, "audio");
  const effectiveAudioTrack = audioTrackProp || remoteAudioTrack;
  const displayName =
    participant?.name ||
    (remoteUser ? `Attendee ${remoteUser.uid}` : "Attendee");
  const initial = displayName.charAt(0).toUpperCase() || "A";
  const isSpeaking = Boolean(effectiveAudioTrack && participant?.canSpeak);

  return (
    <div
      className={`attendee-profile-card glass ${participant?.handRaised ? "hand-raised" : ""} ${isSpeaking ? "speaking" : ""}`}
    >
      {effectiveAudioTrack && participant?.canSpeak && (
        <RemoteAudioTrack track={effectiveAudioTrack} play={true} />
      )}
      <div className="attendee-avatar-wrapper">
        <div className="attendee-avatar">{initial}</div>
        {participant?.handRaised && (
          <span className="hand-indicator" title="Raised hand to speak">
            ✋
          </span>
        )}
        {isSpeaking && (
          <span className="speaking-indicator" title="Currently speaking">
            🎙️
          </span>
        )}
      </div>
      <div className="attendee-card-meta">
        <span className="attendee-card-name" title={displayName}>
          {displayName}
        </span>
        <span
          className={`attendee-card-badge ${participant?.canSpeak ? "speaker" : participant?.handRaised ? "raised" : "viewer"}`}
        >
          {participant?.canSpeak
            ? "Speaker"
            : participant?.handRaised
              ? "Hand Raised"
              : "Attendee"}
        </span>
      </div>
      {isHostView2 &&
        participant?.handRaised &&
        (onGrantSpeak || onAllowSpeak) && (
          <button
            className="card-quick-grant-btn"
            onClick={() =>
              onAllowSpeak
                ? onAllowSpeak(participant!.socketId)
                : onGrantSpeak!(participant!.socketId, participant!.userId)
            }
            title="Allow this attendee to speak"
          >
            Allow Speak
          </button>
        )}
      {isHostView2 && participant?.canSpeak && onRevokeSpeak && (
        <button
          className="card-quick-mute-btn"
          onClick={() => onRevokeSpeak(participant.socketId)}
          title="Revoke speaking permission"
        >
          Mute
        </button>
      )}
    </div>
  );
};

const ActiveRoom: React.FC<{
  config: AgoraConfig;
  sessionId: string;
  eventId?: string;
  onExit: () => void;
}> = ({ config, sessionId, eventId, onExit }) => {
  const mainClient = useRTCClient();
  const connectionState = useConnectionState();
  const [showParticipants, setShowParticipants] = useState(false);
  const [messages, setMessages] = useState<
    { id: string; sender: string; text: string; time: string; self: boolean; role?: string }[]
  >([]);
  const sentLocalIdsRef = useRef<Set<string>>(new Set());
  const [isSessionEnded, setIsSessionEnded] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [participantCount, setParticipantCount] = useState(1);
  const [isSharing, setIsSharing] = useState(false);
  // For participants: tracks whether the host is currently screen sharing
  const [hostIsSharing, setHostIsSharing] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isScreenSharingActive = isSharing || hostIsSharing;
  const socketRef = useRef<Socket | null>(null);
  const chatConnRef = useRef<null | any>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const isAgoraReady = Boolean(APP_ID && config.token && config.channel);
  const isHost = config.isHost === true;

  // Moderated speaking state
  const [canSpeak, setCanSpeak] = useState(isHost);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [sessionParticipants, setSessionParticipants] = useState<
    SessionParticipant[]
  >([]);
  const [raisedHands, setRaisedHands] = useState<
    Array<{
      socketId: string;
      userId?: string;
      name: string;
      agoraUid?: number;
    }>
  >([]);
  const [isHostMutedLocally, setIsHostMutedLocally] = useState(false);

  // Host starts mic/cam on. Attendees start muted with no cam.
  const [isMicOn, setIsMicOn] = useState(isHost);
  const [isCameraOn, setIsCameraOn] = useState(isHost);
  const [showDebug, setShowDebug] = useState(false);

  // Host always publishes; attendees publish only when granted permission to speak
  const shouldPublish = isAgoraReady && (isHost || canSpeak);

  // High-clarity speech configuration with noise suppression, echo cancellation, and auto gain
  const microphoneConfig = React.useMemo(
    () => ({
      AEC: true, // Acoustic Echo Cancellation (eliminates speaker-to-mic loopback feedback)
      ANS: true, // Automatic Noise Suppression (filters laptop fan noise, room reverb, and static hiss)
      AGC: true, // Automatic Gain Control (normalizes voice level and prevents clipping/distortion)
      encoderConfig: "speech_standard" as const, // Agora standard speech profile with voice bandpass filtering
    }),
    [],
  );

  // Agora Hooks - host acquires camera and mic; attendees join as subscribers
  const { localMicrophoneTrack, error: micError } = useLocalMicrophoneTrack(
    shouldPublish && isMicOn,
    microphoneConfig,
  );
  const { localCameraTrack, error: cameraError } = useLocalCameraTrack(
    shouldPublish && isCameraOn,
  );

  const { screenTrack, error: screenError } = useLocalScreenTrack(
    shouldPublish && isSharing,
    defaultScreenConfig,
    "disable",
  );

  useEffect(() => {
    if (cameraError) {
      console.error(
        "[Room] Camera track initialization error:",
        cameraError.name,
        cameraError.message,
        cameraError,
      );
    }
  }, [cameraError]);

  useEffect(() => {
    if (micError) {
      console.error(
        "[Room] Microphone track initialization error:",
        micError.name,
        micError.message,
        micError,
      );
    }
  }, [micError]);

  useEffect(() => {
    if (screenError) {
      console.error("[Room] Screen share error:", screenError);
      setIsSharing(false);
    }
  }, [screenError]);

  const { error: joinError } = useJoin(
    {
      appid: APP_ID || "",
      channel: config.channel,
      token: config.token,
      uid: config.uid,
    },
    isAgoraReady,
  );

  useEffect(() => {
    if (joinError) {
      console.error("[Room] Agora RTC join error:", joinError);
    }
  }, [joinError]);

  // Agora Client Event Listeners for Comprehensive Logging
  useEffect(() => {
    if (!mainClient) return;

    const handleException = (event: any) => {
      console.error("[AgoraRTC] Client exception occurred:", event);
    };
    const handleStateChange = (cur: string, rev: string, reason?: string) => {
      console.warn(
        `[AgoraRTC] Connection state: ${rev} -> ${cur}${reason ? ` (${reason})` : ""}`,
      );
    };
    const handleUserPublished = (user: any, mediaType: "audio" | "video") => {
      console.log(
        `[AgoraRTC] Remote user published: uid=${user.uid}, mediaType=${mediaType}`,
      );
    };
    const handleUserUnpublished = (user: any, mediaType: "audio" | "video") => {
      console.log(
        `[AgoraRTC] Remote user unpublished: uid=${user.uid}, mediaType=${mediaType}`,
      );
    };
    const handleTokenExpire = () => {
      console.warn("[AgoraRTC] Token privilege will expire in 30 seconds");
    };

    mainClient.on("exception", handleException);
    mainClient.on("connection-state-change", handleStateChange);
    mainClient.on("user-published", handleUserPublished);
    mainClient.on("user-unpublished", handleUserUnpublished);
    mainClient.on("token-privilege-will-expire", handleTokenExpire);

    return () => {
      mainClient.off("exception", handleException);
      mainClient.off("connection-state-change", handleStateChange);
      mainClient.off("user-published", handleUserPublished);
      mainClient.off("user-unpublished", handleUserUnpublished);
      mainClient.off("token-privilege-will-expire", handleTokenExpire);
    };
  }, [mainClient]);

  const tracksToPublish = React.useMemo(() => {
    if (!shouldPublish) return [];
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
  }, [
    shouldPublish,
    localMicrophoneTrack,
    localCameraTrack,
    isSharing,
    screenTrack,
  ]);

  const { error: publishError } = usePublish(tracksToPublish, shouldPublish);

  useEffect(() => {
    if (publishError) {
      console.error("[Room] Agora publish error:", publishError);
    }
  }, [publishError]);

  const remoteUsers = useRemoteUsers();

  // ─── Token Auto-Refresh ─────────────────────────────────────────────────────
  useEffect(() => {
    const scheduleRefresh = (expiresAt: number) => {
      const msUntilExpiry = expiresAt * 1000 - Date.now();
      const refreshAt = msUntilExpiry - 5 * 60 * 1000; // 5 minutes before expiry

      if (refreshAt <= 0) return; // Token already near expiry

      tokenRefreshTimerRef.current = setTimeout(async () => {
        try {
          const authToken = localStorage.getItem("auth_token");
          const roomId = eventId || sessionId;
          const refreshRoute = eventId
            ? `${API_BASE}/api/v1/events/${roomId}/refresh-token`
            : `${API_BASE}/api/v1/sessions/${roomId}/refresh-token`;

          const res = await fetch(refreshRoute, {
            method: "POST",
            headers: { Authorization: `Bearer ${authToken}` },
          });
          const data = await res.json();
          if (data.agoraToken) {
            // Renew the token on the active Agora client without disconnecting
            await mainClient.renewToken(data.agoraToken);
            console.log("[Room] Agora token refreshed successfully");
            scheduleRefresh(data.expiresAt); // Schedule next refresh
          }
        } catch (err) {
          console.error("[Room] Token refresh failed:", err);
        }
      }, refreshAt);
    };

    scheduleRefresh(config.expiresAt);

    return () => {
      if (tokenRefreshTimerRef.current)
        clearTimeout(tokenRefreshTimerRef.current);
    };
  }, [sessionId, config.expiresAt, mainClient]);

  // ─── Agora Chat Integration ─────────────────────────────────────────────
  useEffect(() => {
    const APP_KEY = CHAT_APP_KEY;
    if (!Chat || !Chat.connection) {
      console.error(
        "[Chat] Agora Chat library or connection constructor not found",
      );
      return;
    }

    const conn = new Chat.connection({
      appKey: APP_KEY,
    });
    chatConnRef.current = conn;

    conn.addEventHandler("SESSION_CHAT", {
      onConnected: () => {
        console.log("[Chat] Connected to Agora Chat");
        if (config.agoraChatRoomId) {
          conn.joinChatRoom({ roomId: config.agoraChatRoomId })
            .then(() => console.log("[Chat] Successfully joined Agora chat room:", config.agoraChatRoomId))
            .catch((err: any) => console.warn("[Chat] Agora joinChatRoom notice:", err));
        } else {
          console.warn("[Chat] No chat room ID available for this session.");
        }
      },
      onTextMessage: (message: any) => {
        console.log("[Chat] Message received via Agora:", message);
        // Skip messages sent by self — socket.io already handles optimistic local add
        if (message.from === config.chatUsername) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === String(message.id))) return prev;
          return [
            ...prev,
            {
              id: String(message.id || Date.now()),
              sender: message.from,
              text: message.msg,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              self: false,
            },
          ];
        });
      },
      onError: (error: any) => {
        console.error("[Chat] Error:", error);
      },
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
    if (!sessionId) return; // Wait until the session ID is resolved

    const socket = io(API_BASE || undefined, {
      withCredentials: true,
    });
    socketRef.current = socket;

    const storedUser = (() => {
      try {
        return JSON.parse(localStorage.getItem("user") || "{}");
      } catch {
        return {};
      }
    })();

    if (storedUser?.id) {
      socket.emit("register_user", storedUser.id);
    }

    // Join the socket room keyed by the actual session DB ID
    const hostDisplayName = storedUser?.name
      ? `${storedUser.name} (Host)`
      : "Host";
    const attendeeDisplayName = storedUser?.name || "Attendee";
    socket.emit("join_session", {
      sessionId,
      user: {
        id: storedUser?.id,
        name: isHost ? hostDisplayName : attendeeDisplayName,
        email: storedUser?.email,
        isHost: isHost,
        role: isHost ? "host" : "attendee",
        agoraUid: config.uid,
      },
    });

    socket.on("count_updated", (data) => {
      setParticipantCount(data.count);
    });

    // Real-time Chat via Socket.io
    socket.on("message_received", (msgData: any) => {
      console.log("[Socket.io Chat] Message received:", msgData);
      // Check if message was sent by THIS specific client connection
      const isSentByMe = Boolean(
        (msgData.senderSocketId && msgData.senderSocketId === socket.id) ||
        (msgData.localId && sentLocalIdsRef.current.has(msgData.localId))
      );

      setMessages((prev) => {
        if (isSentByMe) {
          // If we added it optimistically, update its id from localId to server id
          if (msgData.localId && prev.some((m) => m.id === msgData.localId)) {
            return prev.map((m) =>
              m.id === msgData.localId ? { ...m, id: String(msgData.id) } : m
            );
          }
          if (prev.some((m) => m.id === String(msgData.id))) return prev;
          return [
            ...prev,
            {
              id: String(msgData.id),
              sender: "You",
              text: msgData.text,
              time: msgData.timestamp
                ? new Date(msgData.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              self: true,
              role: isHost ? "host" : "attendee",
            },
          ];
        }

        // Message sent by someone else (e.g. host sent to attendees, or attendee sent to host)
        if (prev.some((m) => m.id === String(msgData.id))) return prev;
        return [
          ...prev,
          {
            id: String(msgData.id || Date.now()),
            sender: msgData.user || (msgData.role === "host" ? "Host" : "Participant"),
            text: msgData.text,
            time: msgData.timestamp
              ? new Date(msgData.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            self: false,
            role: msgData.role,
          },
        ];
      });
    });

    socket.on("participants_updated", (rawParticipants: any) => {
      const participants: SessionParticipant[] = Array.isArray(rawParticipants)
        ? rawParticipants
        : Array.isArray(rawParticipants?.participants)
          ? rawParticipants.participants
          : [];
      setSessionParticipants(participants);
      // Clean up raisedHands if someone lowered their hand or left
      setRaisedHands((prev) =>
        (Array.isArray(prev) ? prev : []).filter((hand) =>
          participants.some(
            (p) => p.socketId === hand.socketId && p.handRaised,
          ),
        ),
      );

      // If we are an attendee and the host revoked our permission
      if (!isHost) {
        const me = participants.find((p) => p.socketId === socket.id);
        if (me && !me.canSpeak && canSpeak) {
          setCanSpeak(false);
          setIsMicOn(false);
          setIsCameraOn(false);
        }
      }
    });

    socket.on("hand_raised", (data) => {
      if (isHost) {
        setRaisedHands((prev) => {
          if (prev.find((h) => h.socketId === data.socketId)) return prev;
          return [...prev, data];
        });
      }
    });

    socket.on("hand_lowered", (data) => {
      if (isHost) {
        setRaisedHands((prev) =>
          prev.filter((h) => h.socketId !== data.socketId),
        );
      }
    });

    socket.on("speak_permission_granted", () => {
      setCanSpeak(true);
      setIsMicOn(true);
      setIsCameraOn(true);
      setIsHandRaised(false);
    });

    socket.on("speak_permission_revoked", () => {
      setCanSpeak(false);
      setIsMicOn(false);
      setIsCameraOn(false);
    });

    socket.on("billing:low_balance", (data) => {
      setLowBalanceAlert(data);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket.io] Connection error:", err.message, err);
    });

    socket.on("error", (err) => {
      console.error("[Socket.io] Socket general error:", err);
    });

    socket.on("billing:grace_period", (data) => {
      setGraceCountdown(data.secondsRemaining);
    });

    socket.on("billing:overage_charged", () => {
      setLowBalanceAlert(null);
      setGraceCountdown(null);
    });

    const handleStreamEnd = async (data: any) => {
      console.log("[Room] Received stream ending signal:", data);
      setIsSessionEnded(true);
      setHostIsSharing(false);
      await cleanupTracksAndLeave();
    };

    socket.on("stream_ended", handleStreamEnd);
    socket.on("billing:stream_ending", handleStreamEnd);

    // Screen share state broadcast from host
    socket.on("host_screen_share_started", () => {
      setHostIsSharing(true);
    });
    socket.on("host_screen_share_stopped", () => {
      setHostIsSharing(false);
    });

    return () => {
      socket.emit("leave_session", sessionId);
      socket.disconnect();
    };
  }, [sessionId, onExit, isHost]);

  const handleInStreamTopup = async () => {
    setIsTopupProcessing(true);
    try {
      const authToken = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/api/v1/billing/one-click-topup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (res.ok) {
        setLowBalanceAlert(null);
        setGraceCountdown(null);
      } else {
        alert(
          data.error ||
            "Failed to top up. Please check your payment method on file.",
        );
      }
    } catch (err: any) {
      console.error("In-stream topup failed:", err);
    } finally {
      setIsTopupProcessing(false);
    }
  };

  const toggleMic = async () => {
    const next = !isMicOn;
    setIsMicOn(next);
    if (localMicrophoneTrack) {
      try {
        await localMicrophoneTrack.setEnabled(next);
      } catch (e) {
        console.error("Failed to set mic enabled:", e);
      }
    }
  };

  const toggleVideo = async () => {
    const next = !isCameraOn;
    setIsCameraOn(next);
    if (localCameraTrack) {
      try {
        await localCameraTrack.setEnabled(next);
      } catch (e) {
        console.error("Failed to set camera enabled:", e);
      }
    }
  };

  const stopScreenShare = () => {
    if (!isHost) return;
    if (screenTrack) {
      const tracks = Array.isArray(screenTrack) ? screenTrack : [screenTrack];
      tracks.forEach((t) => {
        try {
          t.stop();
          t.close();
        } catch (e) {
          console.warn("[Room] Error stopping screen track:", e);
        }
      });
    }
    setIsSharing(false);
    socketRef.current?.emit("host_screen_share_stopped", { sessionId });
  };

  const toggleScreenShare = () => {
    if (!isHost) return;
    if (isSharing) {
      stopScreenShare();
    } else {
      setIsSharing(true);
      socketRef.current?.emit("host_screen_share_started", { sessionId });
    }
  };

  // Detect when the user clicks "Stop sharing" in the browser's native dialog
  const screenVideoTrack = screenTrack
    ? Array.isArray(screenTrack)
      ? screenTrack[0]
      : screenTrack
    : null;
  useTrackEvent(screenVideoTrack, "track-ended", () => {
    stopScreenShare();
  });

  const toggleHandRaise = () => {
    if (!socketRef.current) return;
    const next = !isHandRaised;
    setIsHandRaised(next);
    if (next) {
      socketRef.current.emit("raise_hand", { sessionId });
    } else {
      socketRef.current.emit("lower_hand", { sessionId });
    }
  };

  const handleGrantSpeak = (targetSocketId: string) => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.emit("grant_speak_permission", {
      sessionId,
      targetSocketId,
    });
    setRaisedHands((prev) => prev.filter((h) => h.socketId !== targetSocketId));
  };

  const handleRevokeSpeak = (targetSocketId: string) => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.emit("revoke_speak_permission", {
      sessionId,
      targetSocketId,
    });
  };

  const cleanupTracksAndLeave = async () => {
    console.log("[Room] Cleaning up tracks and leaving...");
    try {
      if (localMicrophoneTrack) {
        localMicrophoneTrack.stop();
        localMicrophoneTrack.close();
        try {
          localMicrophoneTrack.getMediaStreamTrack()?.stop();
        } catch {}
      }
      if (localCameraTrack) {
        localCameraTrack.stop();
        localCameraTrack.close();
        try {
          localCameraTrack.getMediaStreamTrack()?.stop();
        } catch {}
      }
      if (screenTrack) {
        const tracks = Array.isArray(screenTrack) ? screenTrack : [screenTrack];
        tracks.forEach((t) => {
          t.stop();
          t.close();
          try {
            t.getMediaStreamTrack()?.stop();
          } catch {}
        });
      }
      if (mainClient) await mainClient.leave();
    } catch (err) {
      console.error("[Room] Cleanup error:", err);
    }
  };

  useEffect(() => {
    return () => {
      cleanupTracksAndLeave();
      if (chatConnRef.current) chatConnRef.current.close();
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // Identify the host in remote users list using hostUid
  const hostRemoteUser = config.hostUid
    ? remoteUsers.find((user) => Number(user.uid) === Number(config.hostUid)) ||
      null
    : remoteUsers[0] || null;

  // Subscribed remote tracks for host stream
  const { track: hostVideoTrack } = useRemoteUserTrack(
    hostRemoteUser ?? undefined,
    "video",
  );
  const { track: hostAudioTrack } = useRemoteUserTrack(
    hostRemoteUser ?? undefined,
    "audio",
  );

  const audienceUsers = remoteUsers.filter((user) => {
    // Always exclude self (shouldn't appear in remote users, but safety check)
    if (Number(user.uid) === Number(config.uid)) return false;
    // If I'm an attendee, exclude the host from audience grid (they're already rendered in main tile)
    if (!isHost) {
      if (config.hostUid && Number(user.uid) === Number(config.hostUid))
        return false;
      if (hostRemoteUser && Number(user.uid) === Number(hostRemoteUser.uid))
        return false;
    }
    return true;
  });

  const displayParticipantCount = Math.max(
    participantCount,
    remoteUsers.length + 1,
  );

  const handleLeaveRoom = async () => {
    await cleanupTracksAndLeave();
    onExit();
  };

  const handleEndSessionForAll = async () => {
    if (
      !window.confirm(
        "Are you sure you want to end this live session for everyone?",
      )
    )
      return;

    const authToken = localStorage.getItem("auth_token");
    try {
      if (eventId && config.isHost) {
        await fetch(`${API_BASE}/api/v1/events/${eventId}/end`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } else if (sessionId && !eventId) {
        await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/end`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    } catch (e) {
      console.error("Failed to end session/event on backend:", e);
    }
    // Small delay to allow socket broadcast to reach all attendees before host disconnects
    await new Promise((resolve) => setTimeout(resolve, 500));
    await cleanupTracksAndLeave();
    onExit();
  };

  // Auto-scroll chat to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text) return;

    const storedUser = (() => {
      try {
        return JSON.parse(localStorage.getItem("user") || "{}");
      } catch {
        return {};
      }
    })();

    const senderDisplayName =
      storedUser?.name ||
      storedUser?.email?.split("@")[0] ||
      (isHost ? "Host" : "Attendee");

    // Optimistically add to local state immediately so sender sees it right away
    const optimisticId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    sentLocalIdsRef.current.add(optimisticId);

    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        sender: "You",
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        self: true,
        role: isHost ? "host" : "attendee",
      },
    ]);

    // 1. Send via Socket.io (real-time delivery to all other participants)
    if (socketRef.current && sessionId) {
      socketRef.current.emit("send_message", {
        sessionId,
        user: senderDisplayName,
        senderId: storedUser?.id,
        role: isHost ? "host" : "attendee",
        text,
        localId: optimisticId, // Let the server echo include this so we can deduplicate
      });
    }

    // 2. Also send via Agora Chat SDK if active and room is defined
    if (chatConnRef.current && config.agoraChatRoomId) {
      try {
        const msg = Chat.message.create({
          type: "txt",
          msg: text,
          to: config.agoraChatRoomId,
          chatType: "chatRoom",
        });

        chatConnRef.current
          .send(msg)
          .then(() => {
            console.log("[Chat] Agora message sent");
          })
          .catch((err: unknown) => {
            console.warn("[Chat] Agora chat notice (message delivered via Socket.io):", err);
          });
      } catch (err) {
        console.warn("[Chat] Agora create message notice:", err);
      }
    }

    setInputMessage("");
  };

  return (
    <div
      className={`room-container animate-fade-in${
        isScreenSharingActive ? " is-sharing" : ""
      }${isSidebarCollapsed ? " sidebar-collapsed" : ""}`}
    >
      {/* ── Floating Screen Share Host Controller Banner ── */}
      {isHost && isSharing && (
        <div className="host-screen-sharing-banner animate-fade-in">
          <div className="sharing-status-badge">
            <span className="pulsing-share-dot" />
            <Monitor size={16} />
            <span>You are sharing your screen</span>
          </div>
          <button
            type="button"
            className="stop-share-floating-btn"
            onClick={stopScreenShare}
            title="Stop Screen Share (releases your screen)"
          >
            <StopCircle size={16} />
            <span>Stop Sharing</span>
          </button>
        </div>
      )}


      {/* ── In-Stream Low Balance Alert Banner for Host ── */}
      {lowBalanceAlert && !graceCountdown && (
        <div className="in-stream-warning-banner low-balance animate-fade-in">
          <div className="warning-content">
            <div>
              <strong>
                Low on Minutes ({lowBalanceAlert.percentRemaining}% remaining)
              </strong>
              <span>
                {lowBalanceAlert.minutesRemaining.toLocaleString()} mins left
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
              {isTopupProcessing ? "Processing..." : "1-Click Top Up"}
            </button>
          </div>
        </div>
      )}

      <div className="main-room-layout">
        <div className="video-area">
          <div className="video-grid">
            <div
              className={`video-tile main-host glass ${
                isScreenSharingActive ? "is-screen-sharing" : ""
              }`}
            >
              {isHost ? (
                isSharing && screenTrack ? (
                  <LocalVideoTrack
                    track={
                      Array.isArray(screenTrack) ? screenTrack[0] : screenTrack
                    }
                    play={true}
                    videoPlayerConfig={{ fit: "contain" }}
                    className="screen-share-track"
                    style={{
                      width: "100%",
                      height: "100%",
                      position: "absolute",
                      top: 0,
                      left: 0,
                    }}
                  />
                ) : localCameraTrack && isCameraOn ? (
                  <LocalVideoTrack
                    track={localCameraTrack}
                    play={true}
                    className="video-stream"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div className="video-placeholder">
                    <div className="host-avatar">HD</div>
                    {cameraError ? (
                      <div
                        style={{
                          padding: "1.25rem",
                          color: "#f43f5e",
                          maxWidth: "420px",
                          margin: "0 auto",
                          textAlign: "center",
                        }}
                      >
                        <AlertTriangle
                          size={32}
                          style={{ margin: "0 auto 0.5rem", display: "block" }}
                        />
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "1.05rem",
                            marginBottom: "0.4rem",
                            color: "#fda4af",
                          }}
                        >
                          {cameraError.message?.includes(
                            "can not find getUserMedia",
                          ) || !window.isSecureContext
                            ? "Secure Origin Required (HTTPS on Mobile / LAN)"
                            : "Camera Unavailable"}
                        </div>
                        <p
                          style={{
                            fontSize: "0.82rem",
                            color: "#cbd5e1",
                            lineHeight: 1.5,
                            marginBottom: "1rem",
                          }}
                        >
                          {cameraError.message?.includes(
                            "can not find getUserMedia",
                          ) || !window.isSecureContext
                            ? `Mobile browsers (iOS Safari, Android Chrome) block camera access over plain HTTP. To use your camera on your phone, open via HTTPS on port 5174.`
                            : cameraError.message ||
                              "Could not access webcam. Please check browser permissions."}
                        </p>
                        {window.location.protocol === "http:" && (
                          <button
                            type="button"
                            onClick={() => {
                              const targetHost = window.location.hostname;
                              if (
                                targetHost === "localhost" ||
                                targetHost === "127.0.0.1"
                              ) {
                                window.location.href = `http://localhost:${window.location.port || "5173"}`;
                              } else {
                                window.location.href = `https://${targetHost}:5174${window.location.pathname}${window.location.search}`;
                              }
                            }}
                            style={{
                              background: "#6366f1",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "8px",
                              padding: "0.65rem 1.25rem",
                              fontSize: "0.9rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.4)",
                              transition: "all 0.2s ease",
                            }}
                          >
                            {window.location.hostname === "localhost" ||
                            window.location.hostname === "127.0.0.1"
                              ? `Open on http://localhost:${window.location.port || "5173"}`
                              : `Switch to HTTPS (https://${window.location.hostname}:5174)`}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span>
                        {isCameraOn
                          ? "Camera feed initializing..."
                          : "Camera is turned off"}
                      </span>
                    )}
                  </div>
                )
              ) : (
                <>
                  {!isHost && hostAudioTrack && (
                    <RemoteAudioTrack
                      track={hostAudioTrack}
                      play={!isHostMutedLocally}
                    />
                  )}
                  {hostVideoTrack ? (
                    <RemoteVideoTrack
                      track={hostVideoTrack}
                      play={true}
                      videoPlayerConfig={{ fit: hostIsSharing ? "contain" : "cover" }}
                      className={hostIsSharing ? "screen-share-track" : "camera-track"}
                      style={{
                        width: "100%",
                        height: "100%",
                      }}
                    />
                  ) : (
                    <div className={`video-placeholder ${isSessionEnded ? "session-ended" : ""}`}>
                      <div
                        className="host-avatar"
                        style={
                          isSessionEnded
                            ? {
                                borderColor: "#ef4444",
                                background: "rgba(239, 68, 68, 0.15)",
                                color: "#ef4444",
                                boxShadow: "0 0 24px rgba(239, 68, 68, 0.25)",
                              }
                            : undefined
                        }
                      >
                        {isSessionEnded ? "🔴" : "HD"}
                      </div>
                      <span
                        style={
                          isSessionEnded
                            ? {
                                color: "#ef4444",
                                fontWeight: 700,
                                fontSize: "1.2rem",
                                letterSpacing: "-0.01em",
                              }
                            : undefined
                        }
                      >
                        {isSessionEnded
                          ? "🔴 This session has been ended by the host"
                          : "Waiting for the host to start their camera..."}
                      </span>
                      {isSessionEnded && (
                        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                          <p style={{ color: "#94a3b8", fontSize: "0.9rem", margin: 0 }}>
                            The live broadcast has concluded. Thank you for attending!
                          </p>
                          <button
                            type="button"
                            className="primary-btn"
                            onClick={onExit}
                            style={{
                              marginTop: "0.5rem",
                              padding: "0.65rem 1.6rem",
                              borderRadius: "10px",
                              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                              border: "none",
                              color: "#fff",
                              fontWeight: 600,
                              cursor: "pointer",
                              boxShadow: "0 4px 14px rgba(239, 68, 68, 0.35)",
                            }}
                          >
                            Return to Events
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              <div
                className={`live-indicator ${isSessionEnded ? "ended" : ""}`}
                style={isSessionEnded ? { background: "rgba(239, 68, 68, 0.9)", color: "#fff" } : undefined}
              >
                {isSessionEnded
                  ? "SESSION ENDED"
                  : isScreenSharingActive
                    ? "SCREEN SHARING"
                    : isHost
                      ? "LIVE"
                      : "HOST FEED"}
              </div>
              <div className="tile-top-actions">
                <button
                  type="button"
                  className="tile-action-btn"
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  title={
                    isSidebarCollapsed
                      ? "Show Chat & Participants"
                      : "Theater Mode (Expand Screen to full width)"
                  }
                >
                  {isSidebarCollapsed ? (
                    <Minimize2 size={16} />
                  ) : (
                    <Maximize2 size={16} />
                  )}
                  <span>{isSidebarCollapsed ? "Show Chat" : "Theater Mode"}</span>
                </button>
              </div>
              <div
                className="room-info"
                style={{ cursor: "pointer" }}
                onClick={() => setShowDebug((d) => !d)}
              >
                Channel: {config.channel} • {connectionState}
              </div>

              {/* ── Host: Raised Hand Notifications ── */}
              {isHost && raisedHands.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    zIndex: 100,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {raisedHands.map((hand) => (
                    <div
                      key={hand.socketId}
                      style={{
                        background: "rgba(0,0,0,0.8)",
                        padding: "10px 15px",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <span style={{ fontSize: "20px" }}>✋</span>
                      <span>
                        <b>{hand.name || "A participant"}</b> requested to speak
                      </span>
                      <button
                        onClick={() => handleGrantSpeak(hand.socketId)}
                        style={{
                          background: "#34d399",
                          color: "#000",
                          border: "none",
                          padding: "5px 10px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        Allow
                      </button>
                      <button
                        onClick={() =>
                          setRaisedHands((prev) =>
                            prev.filter((h) => h.socketId !== hand.socketId),
                          )
                        }
                        style={{
                          background: "transparent",
                          color: "#a1a1aa",
                          border: "none",
                          cursor: "pointer",
                          padding: "5px",
                        }}
                      >
                        <XCircle size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Visible Debug Status Panel ── */}
              {showDebug && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "2.5rem",
                    left: "0.75rem",
                    right: "0.75rem",
                    background: "rgba(0,0,0,0.85)",
                    color: "#e2e8f0",
                    fontSize: "0.72rem",
                    borderRadius: "10px",
                    padding: "0.75rem 1rem",
                    zIndex: 999,
                    border: "1px solid rgba(99,102,241,0.4)",
                    lineHeight: 1.6,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: "#818cf8",
                      marginBottom: "0.4rem",
                    }}
                  >
                    🔍 Stream Diagnostics
                  </div>
                  <div>
                    Role:{" "}
                    <b style={{ color: isHost ? "#34d399" : "#f472b6" }}>
                      {isHost ? "HOST (publisher)" : "ATTENDEE (subscriber)"}
                    </b>
                  </div>
                  <div>
                    Agora Connection:{" "}
                    <b
                      style={{
                        color:
                          connectionState === "CONNECTED"
                            ? "#34d399"
                            : "#fb923c",
                      }}
                    >
                      {connectionState}
                    </b>
                  </div>
                  <div>
                    My UID: <b>{config.uid}</b> | Host UID:{" "}
                    <b>{config.hostUid ?? "N/A"}</b>
                  </div>
                  <div>
                    Remote users in channel:{" "}
                    <b
                      style={{
                        color: remoteUsers.length > 0 ? "#34d399" : "#fb923c",
                      }}
                    >
                      {remoteUsers.length}
                    </b>
                    {remoteUsers.length > 0 && (
                      <span>
                        {" "}
                        (UIDs: {remoteUsers.map((u) => u.uid).join(", ")})
                      </span>
                    )}
                  </div>
                  <div>
                    Host in remote list:{" "}
                    <b
                      style={{ color: hostRemoteUser ? "#34d399" : "#fb923c" }}
                    >
                      {hostRemoteUser
                        ? `YES (uid ${hostRemoteUser.uid})`
                        : "NOT FOUND"}
                    </b>
                  </div>
                  {isHost && (
                    <>
                      <div>
                        Camera track:{" "}
                        <b
                          style={{
                            color: localCameraTrack ? "#34d399" : "#fb923c",
                          }}
                        >
                          {localCameraTrack ? "INITIALIZED ✓" : "NULL ✗"}
                        </b>
                      </div>
                      <div>
                        Mic track:{" "}
                        <b
                          style={{
                            color: localMicrophoneTrack ? "#34d399" : "#fb923c",
                          }}
                        >
                          {localMicrophoneTrack ? "INITIALIZED ✓" : "NULL ✗"}
                        </b>
                      </div>
                      <div>
                        Camera error:{" "}
                        <b
                          style={{ color: cameraError ? "#f43f5e" : "#34d399" }}
                        >
                          {cameraError ? cameraError.message : "none"}
                        </b>
                      </div>
                      <div>
                        Publish error:{" "}
                        <b
                          style={{
                            color: publishError ? "#f43f5e" : "#34d399",
                          }}
                        >
                          {publishError
                            ? (publishError as any).message
                            : "none"}
                        </b>
                      </div>
                      <div>
                        Tracks published: <b>{tracksToPublish.length}</b>
                      </div>
                      <div>
                        shouldPublish: <b>{String(shouldPublish)}</b> |
                        isCameraOn: <b>{String(isCameraOn)}</b>
                      </div>
                      <div>
                        Secure context:{" "}
                        <b
                          style={{
                            color: window.isSecureContext
                              ? "#34d399"
                              : "#f43f5e",
                          }}
                        >
                          {String(window.isSecureContext)}
                        </b>
                      </div>
                    </>
                  )}
                  {!isHost && (
                    <>
                      <div>
                        Host video track:{" "}
                        <b
                          style={{
                            color: hostVideoTrack ? "#34d399" : "#fb923c",
                          }}
                        >
                          {hostVideoTrack ? "RECEIVED ✓" : "NOT YET"}
                        </b>
                      </div>
                      <div>
                        Host audio track:{" "}
                        <b
                          style={{
                            color: hostAudioTrack ? "#34d399" : "#fb923c",
                          }}
                        >
                          {hostAudioTrack ? "RECEIVED ✓" : "NOT YET"}
                        </b>
                      </div>
                      <div>
                        Secure context:{" "}
                        <b
                          style={{
                            color: window.isSecureContext
                              ? "#34d399"
                              : "#f43f5e",
                          }}
                        >
                          {String(window.isSecureContext)}
                        </b>
                      </div>
                      {!window.isSecureContext && (
                        <div style={{ color: "#fbbf24", marginTop: "0.3rem" }}>
                          ⚠️ Non-HTTPS! Use https://{window.location.hostname}
                          :5174 for reliable WebRTC
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Audience / Participants - Remote Cards */}
            <div className="audience-grid">
              {(Array.isArray(sessionParticipants)
                ? sessionParticipants
                : []
              ).filter((p) => !p.isHost).length > 0 ? (
                (Array.isArray(sessionParticipants) ? sessionParticipants : [])
                  .filter((p) => !p.isHost)
                  .map((participant) => {
                    const agoraUser = audienceUsers.find(
                      (u) => u.uid === participant.agoraUid,
                    );
                    return (
                      <AttendeeProfileCard
                        key={participant.socketId}
                        participant={participant}
                        audioTrack={agoraUser?.audioTrack}
                        videoTrack={agoraUser?.videoTrack}
                        isHost={isHost}
                        onAllowSpeak={handleGrantSpeak}
                        onRevokeSpeak={handleRevokeSpeak}
                      />
                    );
                  })
              ) : isHost ? (
                <div className="waiting-pill">Waiting for participants...</div>
              ) : null}
            </div>
          </div>

          <div className="room-controls glass">
            {isHost ? (
              <>
                <button
                  className={`control-btn ${!isMicOn ? "off" : ""}`}
                  onClick={toggleMic}
                  title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {!isMicOn ? <MicOff /> : <Mic />}
                </button>
                <button
                  className={`control-btn ${!isCameraOn ? "off" : ""}`}
                  onClick={toggleVideo}
                  title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
                >
                  {!isCameraOn ? <VideoOff /> : <VideoIcon />}
                </button>
                <button
                  className={`control-btn ${
                    isSharing ? "active-share-stop" : ""
                  }`}
                  onClick={toggleScreenShare}
                  title={isSharing ? "Stop Screen Share" : "Share Your Screen"}
                >
                  {isSharing ? (
                    <>
                      <MonitorOff size={20} />
                      <span className="share-btn-text">Stop Share</span>
                    </>
                  ) : (
                    <Monitor size={20} />
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  className={`control-btn ${isHostMutedLocally ? "off" : ""}`}
                  onClick={() => setIsHostMutedLocally(!isHostMutedLocally)}
                  title={isHostMutedLocally ? "Unmute Host" : "Mute Host"}
                >
                  {isHostMutedLocally ? <VolumeX /> : <Volume2 />}
                </button>

                {canSpeak ? (
                  <>
                    <button
                      className={`control-btn ${!isMicOn ? "off" : ""}`}
                      onClick={toggleMic}
                      title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                    >
                      {!isMicOn ? <MicOff /> : <Mic />}
                    </button>
                    <button
                      className={`control-btn ${!isCameraOn ? "off" : ""}`}
                      onClick={toggleVideo}
                      title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
                    >
                      {!isCameraOn ? <VideoOff /> : <VideoIcon />}
                    </button>
                  </>
                ) : (
                  <button
                    className={`control-btn ${isHandRaised ? "active-share" : ""}`}
                    onClick={toggleHandRaise}
                    title={isHandRaised ? "Lower Hand" : "Raise Hand"}
                  >
                    <Hand />
                  </button>
                )}
              </>
            )}
            {/* Theater Mode / Full Screen width toggle */}
            <button
              className={`control-btn ${isSidebarCollapsed ? "theater-active" : ""}`}
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              title={
                isSidebarCollapsed
                  ? "Exit Theater Mode (Show Chat)"
                  : "Theater Mode (Expand Screen)"
              }
            >
              {isSidebarCollapsed ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>

            <button
              className="control-btn"
              onClick={() => alert("Audio/Video settings")}
              title="Settings"
            >
              <Settings />
            </button>

            {/* Leave Room for Attendees / Hosts */}
            <button
              className="control-btn leave-call-btn"
              onClick={handleLeaveRoom}
              title="Leave room"
            >
              <PhoneOff />
            </button>

            {/* Explicit End Session button for Hosts */}
            {isHost && (
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
              className={`panel-tab ${!showParticipants ? "active" : ""}`}
              onClick={() => setShowParticipants(false)}
            >
              <MessageSquare size={18} /> Chat
            </button>
            <button
              className={`panel-tab ${showParticipants ? "active" : ""}`}
              onClick={() => setShowParticipants(true)}
            >
              <Users size={18} /> Participants ({displayParticipantCount})
            </button>
          </div>

          {!showParticipants ? (
            <div className="chat-content">
              <div className="message-list">
                {messages.length === 0 && (
                  <div className="message-item system">
                    <span className="msg-user">System</span>
                    <p className="msg-text">
                      Welcome to securely tokenized session!
                    </p>
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message-item ${msg.self ? "self" : ""} ${msg.sender === "System" ? "system" : ""}`}
                  >
                    <span className="msg-user">
                      {msg.sender}
                      {(msg.role === "host" || (!msg.self && msg.sender?.toLowerCase().includes("host"))) && (
                        <span
                          style={{
                            marginLeft: "6px",
                            fontSize: "0.65rem",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            background: "rgba(99, 102, 241, 0.2)",
                            color: "#818cf8",
                            border: "1px solid rgba(99, 102, 241, 0.4)",
                            fontWeight: 700,
                          }}
                        >
                          HOST
                        </span>
                      )}
                    </span>
                    <p className="msg-text">{msg.text}</p>
                    {msg.time && (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          color: "#6b7280",
                          display: "block",
                          marginTop: "0.25rem",
                          textAlign: msg.self ? "right" : "left",
                        }}
                      >
                        {msg.time}
                      </span>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
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
            <div
              className="participant-list"
              style={{
                padding: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {(Array.isArray(sessionParticipants)
                ? sessionParticipants
                : []
              ).map((user) => (
                <div
                  key={user.socketId}
                  className="participant-item"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "rgba(255,255,255,0.05)",
                    padding: "10px",
                    borderRadius: "8px",
                  }}
                >
                  <div
                    className="avatar-small"
                    style={{
                      background: user.isHost ? "#3b82f6" : "#6366f1",
                      color: "white",
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                    }}
                  >
                    {user.name
                      ? user.name[0].toUpperCase()
                      : user.isHost
                        ? "H"
                        : "U"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <span style={{ fontWeight: "500" }}>
                        {user.name || (user.isHost ? "Host" : "Attendee")}
                      </span>
                      {user.socketId === socketRef.current?.id && (
                        <span style={{ fontSize: "11px", color: "#a1a1aa" }}>
                          (You)
                        </span>
                      )}
                    </div>
                    <div
                      className="user-perms"
                      style={{ fontSize: "12px", color: "#9ca3af" }}
                    >
                      {user.isHost ? "Host" : "Attendee"}
                    </div>
                  </div>

                  {isHost && !user.isHost && (
                    <div style={{ display: "flex", gap: "5px" }}>
                      {user.canSpeak ? (
                        <button
                          onClick={() => handleRevokeSpeak(user.socketId)}
                          style={{
                            background: "#f43f5e",
                            color: "white",
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          Mute
                        </button>
                      ) : (
                        <button
                          onClick={() => handleGrantSpeak(user.socketId)}
                          style={{
                            background: "#34d399",
                            color: "#000",
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          {user.handRaised
                            ? "Allow Speak (Hand Raised)"
                            : "Allow Speak"}
                        </button>
                      )}
                    </div>
                  )}
                  {!isHost && user.handRaised && (
                    <span style={{ fontSize: "16px" }} title="Hand Raised">
                      ✋
                    </span>
                  )}
                  {user.canSpeak && <Mic size={16} color="#34d399" />}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
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
          object-fit: cover;
          position: absolute;
          top: 0;
          left: 0;
        }

        /* Ensure agora-rtc-react internal div fills the tile, excluding badge overlays */
        .video-tile > div:not(.live-indicator):not(.room-info):not(.video-placeholder):not(.tile-top-actions) {
          width: 100% !important;
          height: 100% !important;
        }

        .main-host {
          grid-row: 1;
          background: #1e293b;
        }

        /* ── Screen Share: full edge-to-edge layout ── */
        .is-sharing .video-area {
          padding: 0.75rem;
          gap: 0.75rem;
        }

        .is-sharing .video-grid {
          gap: 0.75rem;
        }

        .is-sharing .main-host,
        .video-tile.is-screen-sharing {
          border-radius: 12px;
          background: #000 !important;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* Force contain on ALL screen sharing video elements so left & right edges are never cut off */
        .is-sharing .video-tile video,
        .video-tile.is-screen-sharing video,
        .is-sharing .main-host video,
        .video-tile video.screen-share-track,
        .screen-share-track video {
          object-fit: contain !important;
          background: #000 !important;
          width: 100% !important;
          height: 100% !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          position: absolute !important;
        }

        /* When theater mode / sidebar is collapsed */
        .sidebar-collapsed .side-panel {
          display: none !important;
        }

        .sidebar-collapsed .video-area {
          padding: 0.5rem;
        }

        .sidebar-collapsed .audience-grid {
          height: 85px;
        }

        .sidebar-collapsed .attendee-profile-card {
          flex: 0 0 115px;
          height: 75px;
        }

        /* Floating host screen sharing indicator */
        .host-screen-sharing-banner {
          position: absolute;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(239, 68, 68, 0.5);
          box-shadow: 0 4px 20px rgba(239, 68, 68, 0.35);
          padding: 8px 18px;
          border-radius: 30px;
        }

        .sharing-status-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #fca5a5;
          font-size: 0.88rem;
          font-weight: 600;
        }

        .pulsing-share-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 10px #ef4444;
          animation: pulse 1.5s infinite;
        }

        .stop-share-floating-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #ef4444;
          color: #fff;
          border: none;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .stop-share-floating-btn:hover {
          background: #dc2626;
          transform: scale(1.04);
        }

        .control-btn.active-share-stop {
          background: #ef4444 !important;
          color: #fff !important;
          width: auto !important;
          padding: 0 16px !important;
          border-radius: 30px !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          box-shadow: 0 0 16px rgba(239, 68, 68, 0.5) !important;
        }

        .control-btn.active-share-stop:hover {
          background: #dc2626 !important;
          transform: scale(1.05);
        }

        .control-btn.theater-active {
          background: rgba(99, 102, 241, 0.3) !important;
          color: #818cf8 !important;
          border-color: rgba(99, 102, 241, 0.5) !important;
        }

        .share-btn-text {
          font-size: 0.85rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .tile-top-actions {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .tile-action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #e2e8f0;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tile-action-btn:hover {
          background: rgba(30, 41, 59, 0.9);
          border-color: rgba(99, 102, 241, 0.5);
          color: #fff;
        }

        .audience-grid {
          display: flex;
          gap: 0.75rem;
          overflow-x: auto;
          padding: 0.35rem 0;
          height: 125px;
          align-items: center;
        }

        .attendee-profile-card {
          flex: 0 0 145px;
          height: 110px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          padding: 0.5rem;
          position: relative;
          transition: all 0.2s ease;
          backdrop-filter: blur(12px);
          user-select: none;
        }

        .attendee-profile-card:hover {
          background: rgba(30, 41, 59, 0.9);
          border-color: rgba(99, 102, 241, 0.4);
          transform: translateY(-2px);
        }

        .attendee-profile-card.hand-raised {
          border-color: #f59e0b;
          box-shadow: 0 0 12px rgba(245, 158, 11, 0.35);
          animation: pulseBorder 1.5s infinite;
        }

        .attendee-profile-card.speaking {
          border-color: #10b981;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.35);
        }

        @keyframes pulseBorder {
          0%, 100% { border-color: #f59e0b; }
          50% { border-color: rgba(245, 158, 11, 0.3); }
        }

        .attendee-avatar-wrapper {
          position: relative;
          margin-bottom: 0.25rem;
        }

        .attendee-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
          color: #ffffff;
          font-weight: 700;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .hand-indicator {
          position: absolute;
          top: -4px;
          right: -6px;
          font-size: 1rem;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
          animation: wave 1s infinite alternate;
        }

        @keyframes wave {
          from { transform: rotate(-10deg); }
          to { transform: rotate(15deg); }
        }

        .speaking-indicator {
          position: absolute;
          bottom: -2px;
          right: -4px;
          font-size: 0.75rem;
        }

        .attendee-card-meta {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          gap: 2px;
        }

        .attendee-card-name {
          font-size: 0.75rem;
          font-weight: 600;
          color: #f1f5f9;
          max-width: 130px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
        }

        .attendee-card-badge {
          font-size: 0.62rem;
          padding: 1px 6px;
          border-radius: 999px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        .attendee-card-badge.viewer {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }

        .attendee-card-badge.raised {
          background: rgba(245, 158, 11, 0.25);
          color: #fbbf24;
        }

        .attendee-card-badge.speaker {
          background: rgba(16, 185, 129, 0.25);
          color: #34d399;
        }

        .card-quick-grant-btn {
          margin-top: 3px;
          background: #10b981;
          color: #000;
          font-size: 0.65rem;
          font-weight: 700;
          border: none;
          padding: 2px 7px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .card-quick-grant-btn:hover {
          background: #34d399;
        }

        .card-quick-mute-btn {
          margin-top: 3px;
          background: #ef4444;
          color: #fff;
          font-size: 0.65rem;
          font-weight: 600;
          border: none;
          padding: 2px 7px;
          border-radius: 4px;
          cursor: pointer;
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
          transition: all 0.3s ease;
        }

        .video-placeholder.session-ended {
          animation: fadeIn 0.4s ease;
        }

        .live-indicator.ended {
          background: #ef4444 !important;
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
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
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          max-width: min(100%, 640px);
          margin: 0 auto;
          border-radius: 28px;
          flex-wrap: wrap;
        }

        .control-btn {
          width: 50px;
          height: 50px;
          min-width: 50px;
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
          border: 1px solid transparent;
        }

        .message-item.self {
          background: rgba(99, 102, 241, 0.15);
          border-color: rgba(99, 102, 241, 0.25);
          align-self: flex-end;
          max-width: 85%;
        }

        .message-item.self .msg-user {
          color: #a5b4fc;
          text-align: right;
        }

        .message-item.self .msg-text {
          text-align: right;
        }

        .message-item.system {
          background: rgba(251, 191, 36, 0.08);
          border-color: rgba(251, 191, 36, 0.2);
          text-align: center;
        }

        .message-item.system .msg-user {
          color: #fbbf24;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .message-item.system .msg-text {
          font-size: 0.82rem;
          color: #d1d5db;
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
          margin: 0;
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

        /* ── Session Ended Overlay ── */
        .stream-ended-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.82);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.4s ease;
        }

        .stream-ended-card {
          background: linear-gradient(135deg, rgba(30, 30, 46, 0.97) 0%, rgba(20, 20, 35, 0.97) 100%);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 24px;
          padding: 3rem 2.5rem;
          max-width: 440px;
          width: 90%;
          text-align: center;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.7), 0 0 40px rgba(139, 92, 246, 0.15);
          animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .stream-ended-icon {
          font-size: 3.5rem;
          margin-bottom: 1rem;
          animation: pulse 2s ease-in-out infinite;
        }

        .stream-ended-card h2 {
          font-size: 1.8rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 0.75rem;
          background: linear-gradient(135deg, #c084fc, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .stream-ended-card p {
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.75);
          margin: 0 0 0.5rem;
          line-height: 1.6;
        }

        .stream-ended-redirect {
          font-size: 0.85rem !important;
          color: rgba(255, 255, 255, 0.4) !important;
          margin-bottom: 1.75rem !important;
        }

        .stream-ended-btn {
          display: inline-block;
          padding: 0.75rem 2rem;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
        }

        .stream-ended-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(124, 58, 237, 0.6);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
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

        @media (max-width: 980px) {
          .room-container {
            position: relative;
            min-height: 100vh;
            height: auto;
            overflow-y: auto;
          }

          .main-room-layout {
            flex-direction: column;
            height: auto;
          }

          .video-area {
            padding: 0.75rem;
            gap: 0.75rem;
          }

          .video-grid {
            grid-template-rows: minmax(280px, 1fr) auto;
          }

          .side-panel {
            width: auto;
            margin: 0 0.75rem 0.75rem;
            min-height: 320px;
          }
        }

        @media (max-width: 640px) {
          .video-area {
            padding: 0.5rem;
          }

          .room-controls {
            gap: 0.6rem;
            padding: 0.75rem 0.5rem;
            border-radius: 22px;
          }

          .control-btn {
            width: 44px;
            height: 44px;
            min-width: 44px;
          }

          .end-session-host-btn {
            width: 100% !important;
            min-width: 0;
            padding: 0.75rem 1rem !important;
          }

          .panel-tab {
            padding: 0.75rem 0.5rem;
            font-size: 0.8rem;
          }

          .message-list, .chat-input-area, .participant-list {
            padding-left: 0.75rem;
            padding-right: 0.75rem;
          }

          .message-item {
            padding: 0.65rem;
          }

          .audience-grid {
            height: auto;
            min-height: 110px;
          }

          .audience-tile {
            flex-basis: 120px;
          }

          .in-stream-warning-banner {
            margin: 0.75rem 0.75rem 0;
            padding: 0.75rem 0.9rem;
            display: grid;
            gap: 0.5rem;
          }

          .warning-actions {
            justify-content: space-between;
            width: 100%;
          }

          .warning-content {
            align-items: flex-start;
          }
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
      `,
        }}
      />
    </div>
  );
};

export default Room;
