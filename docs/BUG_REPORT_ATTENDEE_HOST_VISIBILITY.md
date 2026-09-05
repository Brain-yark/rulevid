# Bug Report: Attendee Cannot See Host in Live Event Room

## Problem Description
When an attendee joins a live event broadcast that has been started by the host:
1. The main video tile continually displays `"Waiting for the host to join..."`, even though the host is broadcasting with camera and microphone active.
2. The audience grid displays `"Waiting for participants..."`.
3. The participants sidebar tab only shows `"ME - You (Attendee)"`, or displays the host as a generic attendee (`"User <uid> - Attendee"`).
4. No audio from the host is heard by the attendee.

---

## Root Cause Analysis

### 1. Absence of Remote Track Subscriptions in `Room.tsx`
* In Agora Web SDK (`agora-rtc-sdk-ng`) and `agora-rtc-react`, calling `useRemoteUsers()` returns remote user records (`IAgoraRTCRemoteUser`), but **media tracks are not automatically subscribed to or downloaded**.
* On each remote user object, `user.videoTrack` and `user.audioTrack` remain `undefined` until an explicit subscription is initiated (via `useRemoteUserTrack(user, "video")`, `<RemoteUser />`, `useRemoteVideoTracks()`, or `client.subscribe(user, mediaType)`).
* In `Room.tsx`, the code inspected:
  ```tsx
  primaryRemoteUser?.videoTrack ? (
    <RemoteVideoTrack track={primaryRemoteUser.videoTrack} ... />
  ) : (
    <div className="video-placeholder">Waiting for the host to join...</div>
  )
  ```
  Because subscription was never initiated, `primaryRemoteUser.videoTrack` evaluated to `undefined` on every render cycle, permanently falling through to the `"Waiting for the host to join..."` placeholder.
* Furthermore, `RemoteAudioTrack` was never imported or rendered, resulting in complete audio silence for attendees.

### 2. Missing `hostUid` in Backend Responses
* The backend (`eventController.ts` and `sessionController.ts`) generates stable numeric Agora UIDs using `generateStableAgoraUid(userId)`, but omitted `hostUid` from the join and token-refresh responses.
* Without `hostUid`, the frontend was unable to distinguish between the host and fellow attendees:
  - `primaryRemoteUser` arbitrarily picked `remoteUsers[0]`.
  - The audience grid iterated over all `remoteUsers`, placing the host into the audience grid as a small tile labeled `"User <uid> (Audio Only)"`.
  - The participants tab hardcoded `<div className="user-perms">Attendee</div>` for all remote users.

### 3. Agora RTC Event Suppression for Non-Publishing Subscribers
* Attendees join with `RtcRole.SUBSCRIBER` and do not publish any tracks (`tracksToPublish = []`).
* Agora RTC edge servers do not broadcast `user-joined` or `user-published` events for passive subscribers to prevent $O(N^2)$ network overhead in large broadcasts.
* Consequently, for the host (and for attendees when no other publishers are present), `remoteUsers` remains an empty array (`[]`).
* When `remoteUsers.length === 0`:
  - The audience grid rendered `<div className="waiting-pill">Waiting for participants...</div>`.
  - The participants tab only rendered the local user (`"ME"`).

### 4. Dual-Tab Testing Gotcha (Local Storage & UID Collisions)
* In development, testing the host in Tab 1 and the attendee in Tab 2 within the same browser causes Tab 2's login to overwrite `auth_token` and `user` in `localStorage`.
* Both tabs then join using the attendee's user ID, calculating the exact same numeric Agora UID (`generateStableAgoraUid(attendeeUserId)`).
* Agora RTC strictly forbids duplicate UIDs in a channel and immediately disconnects the first client, leaving the remaining client alone in an empty channel.

---

## Resolution

1. **Backend (`backend/src/controllers/eventController.ts` & `sessionController.ts`)**:
   - Export and use `generateStableAgoraUid` to calculate `hostUid = generateStableAgoraUid(event.facilitatorId)`.
   - Include `hostUid` in `startEvent`, `joinEvent`, `refreshEventToken`, `createSession`, `joinSession`, and `refreshSessionToken`.

2. **Frontend (`frontend/src/pages/Room.tsx`)**:
   - Update `AgoraConfig` interface to store `hostUid`.
   - Identify the host user via `remoteUsers.find(u => Number(u.uid) === Number(config.hostUid))`.
   - Subscribe to the host's video and audio tracks using `useRemoteUserTrack(hostRemoteUser, "video")` and `useRemoteUserTrack(hostRemoteUser, "audio")`.
   - Render `RemoteAudioTrack` so the host's broadcast is heard.
   - Filter `hostUid` out of `audienceUsers` so the host is not duplicated in the audience grid.
   - Show `"Waiting for participants..."` pill only to the host.
   - Correctly render the host in `participant-list` with avatar `"H"` and role `"Host (Broadcaster)"`.
