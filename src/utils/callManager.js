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
    pc.close();
  }
  pc = null;
  if (localStream) localStream.getTracks().forEach((t) => t.stop());
  localStream = null;
  pendingCandidates = [];
  callId = null;
  callStartedAt = null;
}

function createPeerConnection(peerUserId, thisCallId) {
  const socket = getSocket();
  const conn = new RTCPeerConnection(ICE_SERVERS);

  conn.onicecandidate = (e) => {
    if (e.candidate && callId === thisCallId) {
      socket.emit('call:ice-candidate', { toUserId: peerUserId, candidate: e.candidate });
    }
  };
  conn.ontrack = (e) => {
    if (callId !== thisCallId) return;
    emit({ type: 'remote-stream', stream: e.streams[0] });
  };
  conn.onconnectionstatechange = () => {
    if (callId !== thisCallId) return;
    if (conn.connectionState === 'connected') {
      callStartedAt = callStartedAt || Date.now();
      emit({ type: 'state', status: 'connected' });
    } else if (['failed', 'closed'].includes(conn.connectionState)) {
      // FIX: this used to only tell the UI to reset — the peer connection,
      // camera/mic and the server's callpeer record were never actually
      // torn down, so both users could get stuck "already-in-call" for up
      // to 4 hours. The component now calls endCall() in response to this.
      emit({ type: 'connection-lost' });
    } else if (conn.connectionState === 'disconnected') {
      // brief blips are normal — don't treat as lost yet, just surface it
      emit({ type: 'state', status: 'reconnecting' });
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
      // camera denied/unavailable — fall back to audio-only rather than
      // failing the call outright
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
  if (pc) return; // already in/starting a call — ignore double taps

  const socket = getSocket();
  const thisCallId = newCallId();

  // Show the call screen immediately, before touching the camera/mic, so
  // the tap feels instant instead of waiting on a permission prompt.
  emit({ type: 'state', status: 'initiating', peerUserId, peerInfo, callType, conversationId });

  const online = await new Promise((resolve) => {
    socket.emit('checkOnline', peerUserId, (res) => resolve(res?.online ?? true));
  });
  if (callId !== thisCallId) return; // cancelled while we were checking
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

  // Candidates from the caller can arrive while we're still on the ringing
  // screen (pc is null, so they land in pendingCandidates). Grab that
  // array now and flush THIS copy after setRemoteDescription — otherwise
  // early candidates are silently dropped and ICE never connects.
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
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
  for (const c of pendingCandidates) {
    await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
  }
  pendingCandidates = [];
  emit({ type: 'state', status: 'connecting' });
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

// -------- in-call controls --------

export function toggleMute() {
  const track = localStream?.getAudioTracks()[0];
  if (!track) return false;
  track.enabled = !track.enabled;
  return !track.enabled; // returns isMuted
}

export function toggleCamera() {
  const track = localStream?.getVideoTracks()[0];
  if (!track) return false;
  track.enabled = !track.enabled;
  return !track.enabled; // returns isCameraOff
}

// Speaker/earpiece output switching. Only Chrome/Android (and desktop
// Chrome/Edge) support HTMLMediaElement.setSinkId — iOS Safari does not,
// so the UI should hide the toggle when this returns false.
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