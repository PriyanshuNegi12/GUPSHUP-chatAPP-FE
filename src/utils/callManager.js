import { getSocket } from './socket';

// Public STUN only — deliberately no TURN server (per project scope). This
// means peers behind strict/symmetric NATs may fail to connect cleanly, and
// marginal networks can show real lag/desync — a TURN relay is the actual
// fix for that, not something fixable purely in this file.
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const RING_TIMEOUT_MS = 30000;

let pc = null;
let localStream = null;
let pendingCandidates = [];
let callId = null;       // guards against events from a stale/previous call
let ringTimer = null;
let callStartedAt = null;
let activePeerId = null; // who we're in a call with (set on start/accept) so logout can hang up

// Set by createPeerConnection() so handleRemoteAnswer() can force-fire the
// "connected" transition as a fallback (some desktop browsers don't reliably
// fire ontrack / connection-state changes on the outgoing caller).
let markConnectedFn = null;

const listeners = new Set();
function emit(event) {
  listeners.forEach((fn) => fn(event));
}
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function clearRingTimer() {
  if (ringTimer) clearTimeout(ringTimer);
  ringTimer = null;
}

function newCallId() {
  callId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return callId;
}

function resetPeer() {
  clearRingTimer();
  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.oniceconnectionstatechange = null;
    pc.close();
  }
  pc = null;
  if (localStream) localStream.getTracks().forEach((t) => t.stop());
  localStream = null;
  pendingCandidates = [];
  callId = null;
  callStartedAt = null;
  activePeerId = null;
  markConnectedFn = null;
}

function createPeerConnection(peerUserId, thisCallId) {
  const socket = getSocket();
  const conn = new RTCPeerConnection(ICE_SERVERS);

  // Only fire "connected" once per call. Desktop Chrome can leave
  // `connectionState` at "connecting" indefinitely on audio-only calls, so we
  // also listen to iceConnectionState and ontrack — whichever fires first wins.
  let connectedEmitted = false;
  const markConnected = () => {
    if (connectedEmitted || callId !== thisCallId) return;
    connectedEmitted = true;
    callStartedAt = callStartedAt || Date.now();
    emit({ type: 'state', status: 'connected' });
  };

  // Expose to handleRemoteAnswer so it can force-connect as a fallback.
  markConnectedFn = markConnected;

  conn.onicecandidate = (e) => {
    if (e.candidate && callId === thisCallId) {
      socket.emit('call:ice-candidate', { toUserId: peerUserId, candidate: e.candidate });
    }
  };

  conn.ontrack = (e) => {
    if (callId !== thisCallId) return;
    emit({ type: 'remote-stream', stream: e.streams[0] });
    // Remote media arrived — the call is definitely up.
    markConnected();
  };

  conn.onconnectionstatechange = () => {
    if (callId !== thisCallId) return;
    if (conn.connectionState === 'connected') {
      markConnected();
    } else if (['failed', 'closed'].includes(conn.connectionState)) {
      emit({ type: 'connection-lost' });
    } else if (conn.connectionState === 'disconnected') {
      emit({ type: 'state', status: 'reconnecting' });
    }
  };

  // Chrome/Safari fire this more reliably than connectionState for audio-only.
  conn.oniceconnectionstatechange = () => {
    if (callId !== thisCallId) return;
    const s = conn.iceConnectionState;
    if (s === 'connected' || s === 'completed') {
      markConnected();
    } else if (s === 'failed') {
      emit({ type: 'connection-lost' });
    }
  };

  return conn;
}

async function getMedia(callType) {
  const constraints = callType === 'audio'
    ? { audio: true, video: false }
    : { audio: true, video: { facingMode: 'user' } };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    if (callType === 'video') {
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        emit({ type: 'downgraded-to-audio' });
        return audioOnly;
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

export function isInCall() {
  return pc !== null;
}

export async function startCall({ peerUserId, conversationId, callType, peerInfo }) {
  if (pc) return;

  const socket = getSocket();
  const thisCallId = newCallId();
  activePeerId = peerUserId;

  emit({ type: 'state', status: 'initiating', peerUserId, peerInfo, callType, conversationId });

  const online = await new Promise((resolve) => {
    socket.emit('checkOnline', peerUserId, (res) => resolve(res?.online ?? true));
  });
  if (callId !== thisCallId) return;
  if (!online) {
    emit({ type: 'call-failed', reason: 'offline' });
    resetPeer();
    return;
  }

  try {
    localStream = await getMedia(callType);
  } catch (err) {
    if (callId !== thisCallId) return;
    emit({ type: 'call-failed', reason: 'permission' });
    resetPeer();
    return;
  }
  if (callId !== thisCallId) {
    localStream.getTracks().forEach((t) => t.stop());
    return;
  }
  emit({ type: 'local-stream', stream: localStream });

  pc = createPeerConnection(peerUserId, thisCallId);
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  if (callId !== thisCallId) return;

  emit({ type: 'state', status: 'ringing-outgoing', peerUserId, peerInfo, callType, conversationId });

  ringTimer = setTimeout(() => {
    if (callId !== thisCallId) return;
    socket.emit('call:end', { toUserId: peerUserId });
    emit({ type: 'call-failed', reason: 'no-answer' });
    resetPeer();
  }, RING_TIMEOUT_MS);

  socket.emit('call:offer', { toUserId: peerUserId, conversationId, offer, callType, callId: thisCallId }, (res) => {
    if (callId !== thisCallId) return;
    if (!res?.ok) {
      clearRingTimer();
      emit({ type: 'call-failed', reason: res?.reason || 'unknown' });
      resetPeer();
    }
  });
}

export async function acceptIncomingCall(incoming) {
  const socket = getSocket();
  const thisCallId = incoming.callId || newCallId();
  callId = thisCallId;
  activePeerId = incoming.fromUserId;

  const queuedCandidates = pendingCandidates;
  pendingCandidates = [];

  emit({
    type: 'state', status: 'connecting',
    peerUserId: incoming.fromUserId, peerInfo: incoming.fromUser,
    callType: incoming.callType, conversationId: incoming.conversationId,
  });

  try {
    localStream = await getMedia(incoming.callType);
  } catch (err) {
    if (callId !== thisCallId) return;
    emit({ type: 'call-failed', reason: 'permission' });
    socket.emit('call:reject', { toUserId: incoming.fromUserId });
    resetPeer();
    return;
  }
  if (callId !== thisCallId) {
    localStream.getTracks().forEach((t) => t.stop());
    return;
  }
  emit({ type: 'local-stream', stream: localStream });

  pc = createPeerConnection(incoming.fromUserId, thisCallId);
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  await pc.setRemoteDescription(new RTCSessionDescription(incoming.offer));
  for (const c of queuedCandidates) {
    await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
  }

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  if (callId !== thisCallId) return;
  socket.emit('call:answer', { toUserId: incoming.fromUserId, answer, callId: thisCallId });
}

export function rejectIncomingCall(incoming) {
  getSocket().emit('call:reject', { toUserId: incoming.fromUserId });
}

export async function handleRemoteAnswer(answer) {
  if (!pc) return;
  clearRingTimer();

  // Emit "connecting" BEFORE setRemoteDescription — applying the answer
  // triggers `ontrack`, which fires `markConnected()`. If we emit "connecting"
  // after, it overwrites the "connected" status and the timer never starts.
  emit({ type: 'state', status: 'connecting' });

  await pc.setRemoteDescription(new RTCSessionDescription(answer));
  for (const c of pendingCandidates) {
    await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
  }
  pendingCandidates = [];

  // Fallback: on some desktop browsers (Windows Chrome) the caller's peer
  // connection doesn't reliably fire `ontrack` or a connection-state change
  // even though media is flowing. The answer is applied and candidates are
  // queued, so force the "connected" transition here. The one-shot guard
  // inside markConnected() makes this safe — if a real event already fired
  // it, this call does nothing.
  if (markConnectedFn) markConnectedFn();
}

export async function handleRemoteIceCandidate(candidate) {
  if (!pc || !pc.remoteDescription) {
    pendingCandidates.push(candidate);
    return;
  }
  await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
}

export function endCall(peerUserId) {
  const wasConnected = !!callStartedAt;
  const duration = wasConnected ? Math.round((Date.now() - callStartedAt) / 1000) : 0;
  if (peerUserId) getSocket().emit('call:end', { toUserId: peerUserId });
  resetPeer();
  emit(wasConnected ? { type: 'state', status: 'ended', duration } : { type: 'state', status: 'idle' });
}

export function hangUpOnLogout() {
  const peer = activePeerId;
  const hadCall = pc !== null || localStream !== null || callId !== null;
  if (peer) {
    try {
      getSocket().emit('call:end', { toUserId: peer });
    } catch {
      /* socket already gone — server should end the call on disconnect */
    }
  }
  resetPeer();
  if (hadCall) emit({ type: 'state', status: 'idle' });
}

export function handleRemoteEnded() {
  const wasConnected = !!callStartedAt;
  const duration = wasConnected ? Math.round((Date.now() - callStartedAt) / 1000) : 0;
  resetPeer();
  if (wasConnected) {
    emit({ type: 'state', status: 'ended', duration });
  } else {
    emit({ type: 'call-failed', reason: 'cancelled' });
  }
}

export function toggleMute() {
  const track = localStream?.getAudioTracks()[0];
  if (!track) return false;
  track.enabled = !track.enabled;
  return !track.enabled;
}

export function toggleCamera() {
  const track = localStream?.getVideoTracks()[0];
  if (!track) return false;
  track.enabled = !track.enabled;
  return !track.enabled;
}

export function speakerToggleSupported() {
  return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
}

export async function setAudioOutput(videoEl, wantSpeaker) {
  if (!videoEl || !speakerToggleSupported()) return false;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter((d) => d.kind === 'audiooutput');
    const match = outputs.find((d) =>
      wantSpeaker ? /speaker/i.test(d.label) : /earpiece|receiver/i.test(d.label)
    );
    await videoEl.setSinkId(match ? match.deviceId : (wantSpeaker ? 'default' : ''));
    return true;
  } catch (err) {
    console.warn('setSinkId failed:', err.message);
    return false;
  }
}