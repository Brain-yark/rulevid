import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

export const generateAgoraToken = (channelName: string, userId: string, role: 'publisher' | 'subscriber' = 'publisher') => {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    throw new Error('Agora App ID and Certificate are required');
  }

  // Agora expects uid to be numeric implicitly or represented up. 
  // Let's use numeric parsing if possible or keep as string since UUIDs can't be numeric. 
  // Wait, agora-access-token requires integer if uid is number type, or string. We pass 0 to dynamically assign.
  // The SDK allows uid=0 to let the server assign an ID.
  const uid = 0; 
  const roleNum = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const expireTime = 3600; // 1 hour token
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expireTime;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    roleNum,
    privilegeExpiredTs
  );

  return {
    token,
    expiresAt: privilegeExpiredTs,
    channelName,
    uid
  };
};
