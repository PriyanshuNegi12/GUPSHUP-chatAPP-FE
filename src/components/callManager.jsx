import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "../utils/socket";
import * as callManager from "../utils/callManager";

function formatDuration(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export default function CallManager() {
  const [status, setStatus] = useState("idle"); // idle | ringing-incoming | calling | connected
  const [callType, setCallType] = useState("video");
  const [peerInfo, setPeerInfo] = useState(null);
  const [peerUserId, setPeerUserId] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [swapped, setSwapped] = useState(false); // false: remote big / local PiP

  // FIX: DOM nodes are tracked in state via callback refs instead of
  // useRef. A plain useRef doesn't trigger a re-render when the node
  // mounts, so an attach-effect keyed off a ref object can only run when
  // something ELSE happens to re-render the component — there's no
  // guarantee that coincides with the stream arriving. Callback refs make
  // "the node exists" a real, observable value, so the effect below has
  // real dependencies and fires the instant either the node or the stream
  // shows up, whichever comes first.
  const [localVideoNode, setLocalVideoNode] = useState(null);
  const [remoteVideoNode, setRemoteVideoNode] = useState(null);
  const localVideoRef = useCallback((node) => setLocalVideoNode(node), []);
  const remoteVideoRef = useCallback((node) => setRemoteVideoNode(node), []);

  const timerRef = useRef(null);

  const resetLocal = () => {
    setStatus("idle");
    setIncoming(null);
    setPeerInfo(null);
    setPeerUserId(null);
    setMuted(false);
    setCameraOff(false);
    setLocalStream(null);
    setRemoteStream(null);
    setSwapped(false);
  };

  // ---- signaling + call-manager event wiring ----
  useEffect(() => {
    const socket = getSocket();

    const onIncoming = (payload) => {
      setIncoming(payload);
      setStatus("ringing-incoming");
      setCallType(payload.callType);
      setPeerInfo(payload.fromUser);
      setPeerUserId(payload.fromUserId);
    };
    const onAnswer = (payload) => callManager.handleRemoteAnswer(payload.answer);
    const onIce = (payload) => callManager.handleRemoteIceCandidate(payload.candidate);
    const onRejected = () => { callManager.handleRemoteEnded(); resetLocal(); };
    const onEnded = () => { callManager.handleRemoteEnded(); resetLocal(); };
    const onBusy = () => { callManager.handleRemoteEnded(); resetLocal(); setError("They're on another call right now."); };

    socket.on("call:incoming", onIncoming);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice-candidate", onIce);
    socket.on("call:rejected", onRejected);
    socket.on("call:ended", onEnded);
    socket.on("call:busy", onBusy);

    const unsubscribe = callManager.subscribe((event) => {
      if (event.type === "state") {
        if (event.status) setStatus(event.status);
        if (event.peerInfo) setPeerInfo(event.peerInfo);
        if (event.peerUserId) setPeerUserId(event.peerUserId);
        if (event.callType) setCallType(event.callType);
      } else if (event.type === "local-stream") {
        setLocalStream(event.stream);
      } else if (event.type === "remote-stream") {
        setRemoteStream(event.stream);
      } else if (event.type === "call-failed") {
        resetLocal();
        setError(
          event.reason === "offline" ? "They're offline right now." :
          event.reason === "not-friends" ? "You can only call friends." :
          event.reason === "permission" ? "Camera/microphone access was denied." :
          "Couldn't start the call."
        );
      } else if (event.type === "connection-lost") {
        resetLocal();
      }
    });

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice-candidate", onIce);
      socket.off("call:rejected", onRejected);
      socket.off("call:ended", onEnded);
      socket.off("call:busy", onBusy);
      unsubscribe();
    };
  }, []);

  // ---- stream <-> DOM reconciliation (the actual fix) ----
  // Real dependency arrays now: this fires whenever the node mounts/unmounts
  // OR whenever the stream changes — deterministically, regardless of order.
  useEffect(() => {
    if (!localVideoNode) return;
    if (localStream) {
      if (localVideoNode.srcObject !== localStream) localVideoNode.srcObject = localStream;
      localVideoNode.muted = true;
      localVideoNode.play().catch((err) => console.warn("local video play() blocked:", err.message));
    } else if (localVideoNode.srcObject) {
      localVideoNode.srcObject = null;
    }
  }, [localVideoNode, localStream]);

  useEffect(() => {
    if (!remoteVideoNode) return;
    if (remoteStream) {
      if (remoteVideoNode.srcObject !== remoteStream) {
        remoteVideoNode.srcObject = remoteStream;
        remoteVideoNode.muted = true; // start muted so autoplay is never blocked...
        remoteVideoNode.play()
          .then(() => setTimeout(() => { remoteVideoNode.muted = false; }, 150))
          .catch((err) => console.warn("remote video play() blocked:", err.message));
      }
    } else if (remoteVideoNode.srcObject) {
      remoteVideoNode.srcObject = null;
    }
  }, [remoteVideoNode, remoteStream]);

  useEffect(() => {
    if (status === "connected") {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setDuration(0);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const handleAccept = async () => {
    const payload = incoming;
    setIncoming(null);
    await callManager.acceptIncomingCall(payload);
  };
  const handleReject = () => {
    if (incoming) callManager.rejectIncomingCall(incoming);
    resetLocal();
  };
  const handleEnd = () => {
    callManager.endCall(peerUserId);
    resetLocal();
  };
  const handleToggleMute = () => setMuted(callManager.toggleMute());
  const handleToggleCamera = () => setCameraOff(callManager.toggleCamera());

  const inCallUI = status === "calling" || status === "connected";
  const showOverlay = status !== "idle";
  const showingVideo = inCallUI && callType === "video";
  const displayName = peerInfo?.firstname || peerInfo?.username || "Unknown";

  return (
    <>
      {!showOverlay && error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-100 bg-[#8a2f2f] text-white text-[13.5px] px-4 py-2.5 rounded-full shadow-lg">
          {error}
        </div>
      )}

      {showOverlay && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          {status === "ringing-incoming" && (
            <div className="bg-[#faf5e9] rounded-[28px] p-8 w-80 text-center shadow-2xl">
              {peerInfo?.avatar ? (
                <img src={peerInfo.avatar} alt="" className="w-24 h-24 rounded-full object-cover mx-auto mb-4" />
              ) : (
                <span
                  className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl text-white font-medium"
                  style={{ background: "linear-gradient(160deg,#b97a45,#8a5527)" }}
                >
                  {displayName[0]?.toUpperCase()}
                </span>
              )}
              <p className="font-display text-[20px] text-[#2e2a22] mb-1">{displayName}</p>
              <p className="text-[13px] text-[#6b6257] mb-7">Incoming {callType} call...</p>
              <div className="flex items-center justify-center gap-8">
                <button
                  onClick={handleReject}
                  aria-label="Decline"
                  className="w-14 h-14 rounded-full bg-[#c94f4f] text-white flex items-center justify-center text-xl transition-transform duration-150 hover:scale-110 active:scale-95"
                >
                  ✕
                </button>
                <button
                  onClick={handleAccept}
                  aria-label="Accept"
                  className="w-14 h-14 rounded-full bg-[#4caf6a] text-white flex items-center justify-center text-xl transition-transform duration-150 hover:scale-110 active:scale-95"
                >
                  ✓
                </button>
              </div>
            </div>
          )}

          {inCallUI && (
            <div className="relative w-full h-full">
              {showingVideo ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  onClick={swapped ? () => setSwapped(false) : undefined}
                  className={
                    swapped
                      ? "absolute top-4 right-4 w-24 h-32 sm:w-28 sm:h-36 rounded-xl object-cover border-2 border-white/40 shadow-lg bg-black z-10 cursor-pointer transition-transform duration-150 hover:scale-105"
                      : "absolute inset-0 w-full h-full object-cover bg-black"
                  }
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                  {peerInfo?.avatar ? (
                    <img src={peerInfo.avatar} alt="" className="w-28 h-28 rounded-full object-cover mb-4" />
                  ) : (
                    <span
                      className="w-28 h-28 rounded-full mb-4 flex items-center justify-center text-4xl text-white font-medium"
                      style={{ background: "linear-gradient(160deg,#b97a45,#8a5527)" }}
                    >
                      {displayName[0]?.toUpperCase()}
                    </span>
                  )}
                  <p className="font-display text-[22px] text-white mb-1">{displayName}</p>
                  <p className="text-[13px] text-white/70">
                    {status === "calling" ? "Calling..." : formatDuration(duration)}
                  </p>
                </div>
              )}

              {!showingVideo && inCallUI && (
                <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
              )}

              {showingVideo && (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  onClick={swapped ? undefined : () => setSwapped(true)}
                  className={
                    swapped
                      ? "absolute inset-0 w-full h-full object-cover bg-black"
                      : "absolute top-4 right-4 w-24 h-32 sm:w-28 sm:h-36 rounded-xl object-cover border-2 border-white/40 shadow-lg bg-black z-10 cursor-pointer transition-transform duration-150 hover:scale-105"
                  }
                />
              )}
              {!showingVideo && inCallUI && (
                <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
              )}

              {showingVideo && (
                <div className="absolute top-4 left-4 bg-black/55 rounded-full px-3.5 py-1.5 text-white text-[13px] z-10">
                  {displayName} · {status === "calling" ? "Calling..." : formatDuration(duration)}
                </div>
              )}

              <div className="absolute bottom-8 inset-x-0 flex items-center justify-center gap-4 z-10">
                <button
                  onClick={handleToggleMute}
                  aria-label={muted ? "Unmute" : "Mute"}
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-lg shadow-lg transition-colors duration-150 ${
                    muted ? "bg-white text-black" : "bg-white/25 text-white hover:bg-white/35"
                  }`}
                >
                  {muted ? "🔇" : "🎤"}
                </button>
                {callType === "video" && (
                  <button
                    onClick={handleToggleCamera}
                    aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-lg shadow-lg transition-colors duration-150 ${
                      cameraOff ? "bg-white text-black" : "bg-white/25 text-white hover:bg-white/35"
                    }`}
                  >
                    {cameraOff ? "📷" : "🎥"}
                  </button>
                )}
                <button
                  onClick={handleEnd}
                  aria-label="End call"
                  className="w-14 h-14 rounded-full bg-[#c94f4f] text-white flex items-center justify-center text-xl shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}