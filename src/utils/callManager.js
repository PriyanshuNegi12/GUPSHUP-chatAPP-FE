import { getSocket } from './socket';

// Public STUN only — see the note about TURN in the write-up above this code.
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

let pc = null;
let localStream = null;
let pendingCandidates = [];

const listeners = new Set();
function emit(event) {
  listeners.forEach((fn) => fn(event));
}
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function resetPeer() {
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
}

function createPeerConnection(peerUserId) {
  const socket = getSocket();
  const conn = new RTCPeerConnection(ICE_SERVERS);

  conn.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('call:ice-candidate', { toUserId: peerUserId, candidate: e.candidate });
    }
  };
  conn.ontrack = (e) => emit({ type: 'remote-stream', stream: e.streams[0] });
  conn.onconnectionstatechange = () => {
    if (['failed', 'closed'].includes(conn.connectionState)) emit({ type: 'connection-lost' });
  };

  return conn;
}

async function getMedia(callType) {
  const constraints = callType === 'audio'
    ? { audio: true, video: false }
    : { audio: true, video: { facingMode: 'user' } };
  return navigator.mediaDevices.getUserMedia(constraints);
}

export async function startCall({ peerUserId, conversationId, callType, peerInfo }) {
  const socket = getSocket();
  resetPeer();

  try {
    localStream = await getMedia(callType);
  } catch (err) {
    emit({ type: 'call-failed', reason: 'permission' });
    return;
  }
  emit({ type: 'local-stream', stream: localStream });

  pc = createPeerConnection(peerUserId);
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  emit({ type: 'state', status: 'calling', peerUserId, peerInfo, callType, conversationId });

  socket.emit('call:offer', { toUserId: peerUserId, conversationId, offer, callType }, (res) => {
    if (!res?.ok) {
      emit({ type: 'call-failed', reason: res?.reason || 'unknown' });
      resetPeer();
    }
  });
}

export async function acceptIncomingCall(incoming) {
  const socket = getSocket();
  resetPeer();

  try {
    localStream = await getMedia(incoming.callType);
  } catch (err) {
    emit({ type: 'call-failed', reason: 'permission' });
    socket.emit('call:reject', { toUserId: incoming.fromUserId });
    return;
  }
  emit({ type: 'local-stream', stream: localStream });

  pc = createPeerConnection(incoming.fromUserId);
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  await pc.setRemoteDescription(new RTCSessionDescription(incoming.offer));
  for (const c of pendingCandidates) {
    await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
  }
  pendingCandidates = [];

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('call:answer', { toUserId: incoming.fromUserId, answer });

  emit({
    type: 'state', status: 'connected',
    peerUserId: incoming.fromUserId, peerInfo: incoming.fromUser,
    callType: incoming.callType, conversationId: incoming.conversationId,
  });
}

export function rejectIncomingCall(incoming) {
  getSocket().emit('call:reject', { toUserId: incoming.fromUserId });
}

export async function handleRemoteAnswer(answer) {
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
  for (const c of pendingCandidates) {
    await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
  }
  pendingCandidates = [];
  emit({ type: 'state', status: 'connected' });
}

export async function handleRemoteIceCandidate(candidate) {
  if (!pc || !pc.remoteDescription) {
    pendingCandidates.push(candidate);
    return;
  }
  await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
}

export function endCall(peerUserId) {
  if (peerUserId) getSocket().emit('call:end', { toUserId: peerUserId });
  resetPeer();
}

export function handleRemoteEnded() {
  resetPeer();
}

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