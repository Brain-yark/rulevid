import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour

export const generateStableAgoraUid = (userId: string) => {
  const normalized = userId || 'anonymous-user';
  let hash = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }

  return (hash % 2147483646) + 1;
};

export const generateAgoraToken = (
  channelName: string,
  userId: string,
  role: 'publisher' | 'subscriber' = 'publisher',
  expireSeconds = TOKEN_EXPIRY_SECONDS,
  uid?: number
) => {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    throw new Error('Agora App ID and Certificate are required');
  }

  const agoraUid = typeof uid === 'number' ? uid : generateStableAgoraUid(userId);
  const roleNum = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expireSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    agoraUid,
    roleNum,
    privilegeExpiredTs
  );

  return {
    token,
    expiresAt: privilegeExpiredTs,
    channelName,
    uid: agoraUid,
  };
};

/**
 * Refresh an Agora token for an existing channel session.
 * Called ~5 minutes before expiry to prevent mid-session disconnections.
 */
export const refreshAgoraToken = (channelName: string, userId: string, uid?: number) => {
  return generateAgoraToken(channelName, userId, 'publisher', TOKEN_EXPIRY_SECONDS, uid ?? generateStableAgoraUid(userId));
};

