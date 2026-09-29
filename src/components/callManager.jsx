import { useEffect, useRef, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { getSocket } from "../utils/socket";
import * as callManager from "../utils/callManager";

const RINGTONE_SRC = "/whatsapp_ringtone.mp3"; // lives in /public

function formatDuration(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

const FAIL_MESSAGES = {
  offline: "They're offline right now.",
  busy: "They're on another call right now.",
  "already-in-call": "They're on another call right now.",
  "not-friends": "You can only call friends.",
  permission: "Camera/microphone access was denied.",
  "no-answer": "No answer.",
};

export default function CallManager() {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  // idle | initiating | ringing-outgoing | ringing-incoming | connecting |
  // connected | reconnecting | ended | failed
  const [status, setStatus] = useState("idle");
  const [callType, setCallType] = useState("video");
  const [peerInfo, setPeerInfo] = useState(null);
  const [peerUserId, setPeerUserId] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [duration, setDuration] = useState(0);
  const [endedDuration, setEndedDuration] = useState(0);
  const [failReason, setFailReason] = useState("");
  const [note, setNote] = useState("");

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [swapped, setSwapped] = useState(false); // false: remote big / local PiP

  const [localVideoNode, setLocalVideoNode] = useState(null);
  const [remoteVideoNode, setRemoteVideoNode] = useState(null);
  const localVideoRef = useCallback((node) => setLocalVideoNode(node), []);
  const remoteVideoRef = useCallback((node) => setRemoteVideoNode(node), []);

  const timerRef = useRef(null);
  // Plain refs mirror the latest state so socket callbacks registered in the
  // mount-only effect below never read stale values.
  const statusRef = useRef("idle");
  const peerUserIdRef = useRef(null);
  const incomingRef = useRef(null);
  const ringtoneRef = useRef(null);
  const notificationRef = useRef(null);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { peerUserIdRef.current = peerUserId; }, [peerUserId]);
  useEffect(() => { incomingRef.current = incoming; }, [incoming]);

  const resetLocal = () => {
    setStatus("idle");
    setIncoming(null);
    setPeerInfo(null);
    setPeerUserId(null);
    setMuted(false);
    setCameraOff(false);
    setSpeakerOn(false);
    setLocalStream(null);
    setRemoteStream(null);
    setSwapped(false);
    setFailReason("");
    setNote("");
  };

  // ---------- ringtone helpers ----------
  const getRingtone = () => {
    if (!ringtoneRef.current) {
      const a = new Audio(RINGTONE_SRC);
      a.loop = true;
      a.preload = "auto";
      ringtoneRef.current = a;
    }
    return ringtoneRef.current;
  };

  const startRingtone = () => {
    const a = getRingtone();
    a.muted = false;
    a.currentTime = 0;
    a.play().catch((err) => console.warn("ringtone blocked (no user interaction yet):", err.message));
  };

  const stopRingtone = () => {
    const a = ringtoneRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
  };

  // Browsers block audio until the user has interacted with the page. On the
  // first click/tap/key we "unlock" the audio element (play muted, then pause)
  // and ask for notification permission (needs a user gesture on some browsers).
  useEffect(() => {
    if (!isAuthenticated) return;

    const unlock = () => {
      const a = getRingtone();
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
        })
        .catch(() => { a.muted = false; });

      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }

      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [isAuthenticated]);

  // Ring + tab title + system notification while an incoming call is pending.
  // Cleanup runs on ANY status change (accepted, rejected, cancelled, timed
  // out), so the ringtone always stops.
  useEffect(() => {
    if (status !== "ringing-incoming") return;

    startRingtone();

    const name = peerInfo?.firstname || peerInfo?.username || "Someone";
    const originalTitle = document.title;
    let titleTimer = null;

    if (document.hidden) {
      let on = true;
      titleTimer = setInterval(() => {
        document.title = on ? `📞 ${name} is calling…` : originalTitle;
        on = !on;
      }, 1000);

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          const n = new Notification(`${name} is calling…`, {
            body: `Incoming ${callType} call`,
            icon: peerInfo?.avatar || "/logo.png",
            tag: "incoming-call",
            requireInteraction: true, // stays until dismissed (desktop Chrome/Edge)
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
          notificationRef.current = n;
        } catch (err) {
          // Android Chrome doesn't allow `new Notification()` — needs a service worker
          console.warn("Notification failed:", err.message);
        }
      }
    }

    return () => {
      stopRingtone();
      if (titleTimer) clearInterval(titleTimer);
      document.title = originalTitle;
      notificationRef.current?.close();
      notificationRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Stop the ringtone if the component ever unmounts
  useEffect(() => () => stopRingtone(), []);

  // ---------- end / decline any call on logout ----------
  // This effect lives in a child of <App>, so it runs BEFORE App's own effect
  // that calls disconnectSocket() — meaning the "call:end" still reaches the peer.
  useEffect(() => {
    if (isAuthenticated) return;
    if (incomingRef.current) callManager.rejectIncomingCall(incomingRef.current);
    callManager.hangUpOnLogout();
    resetLocal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ---- signaling + call-manager event wiring ----
  useEffect(() => {
    const socket = getSocket();

    const onIncoming = (payload) => {
      // don't let a second incoming call barge into one already in progress
      if (statusRef.current !== "idle") {
        socket.emit("call:reject", { toUserId: payload.fromUserId });
        return;
      }
      setIncoming(payload);
      setStatus("ringing-incoming");
      setCallType(payload.callType);
      setPeerInfo(payload.fromUser);
      setPeerUserId(payload.fromUserId);
    };
    const onAnswer = (payload) => callManager.handleRemoteAnswer(payload.answer);
    const onIce = (payload) => callManager.handleRemoteIceCandidate(payload.candidate);

    // These check the event is actually about the CURRENT call —
    // a stale call:ended from a previous call could otherwise wipe out a
    // call you've since started with someone else.
    const onRejected = (payload) => {
      if (payload?.fromUserId && payload.fromUserId !== peerUserIdRef.current) return;
      callManager.handleRemoteEnded();
    };
    const onEnded = (payload) => {
      if (payload?.fromUserId && payload.fromUserId !== peerUserIdRef.current) return;
      callManager.handleRemoteEnded();
    };
    const onBusy = () => {
      callManager.handleRemoteEnded();
      setFailReason(FAIL_MESSAGES.busy);
      setStatus("failed");
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice-candidate", onIce);
    socket.on("call:rejected", onRejected);
    socket.on("call:ended", onEnded);
    socket.on("call:busy", onBusy);

    const unsubscribe = callManager.subscribe((event) => {
      if (event.type === "state") {
        if (event.status === "idle") {
          resetLocal();
          return;
        }
        setStatus(event.status);
        if (event.peerInfo) setPeerInfo(event.peerInfo);
        if (event.peerUserId) setPeerUserId(event.peerUserId);
        if (event.callType) setCallType(event.callType);
        if (event.status === "ended") setEndedDuration(event.duration || 0);
      } else if (event.type === "local-stream") {
        setLocalStream(event.stream);
      } else if (event.type === "remote-stream") {
        setRemoteStream(event.stream);
      } else if (event.type === "downgraded-to-audio") {
        setNote("Camera unavailable — continuing with audio only.");
      } else if (event.type === "call-failed") {
        if (event.reason === "cancelled") {
          // peer backed out before we ever connected — just close quietly
          resetLocal();
          return;
        }
        setFailReason(FAIL_MESSAGES[event.reason] || "Couldn't start the call.");
        setStatus("failed");
      } else if (event.type === "connection-lost") {
        // endCall() properly tears everything down and notifies the peer.
        callManager.endCall(peerUserIdRef.current);
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

  // ---- stream <-> DOM reconciliation ----
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
    if (status !== "failed") return;
    const t = setTimeout(() => resetLocal(), 3500);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (status !== "ended") return;
    const t = setTimeout(() => resetLocal(), 6000);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(""), 4000);
    return () => clearTimeout(t);
  }, [note]);

  const handleAccept = async () => {
    const payload = incoming;
    stopRingtone();
    setIncoming(null);
    await callManager.acceptIncomingCall(payload);
  };
  const handleReject = () => {
    stopRingtone();
    if (incoming) callManager.rejectIncomingCall(incoming);
    resetLocal();
  };
  const handleEnd = () => {
    callManager.endCall(peerUserId);
  };
  const handleToggleMute = () => setMuted(callManager.toggleMute());
  const handleToggleCamera = () => setCameraOff(callManager.toggleCamera());
  const handleToggleSpeaker = async () => {
    const next = !speakerOn;
    const ok = await callManager.setAudioOutput(remoteVideoNode, next);
    if (ok) setSpeakerOn(next);
  };

  const inCallUI = ["initiating", "ringing-outgoing", "connecting", "connected", "reconnecting"].includes(status);
  const showOverlay = status !== "idle";
  const showingVideo = inCallUI && callType === "video";
  const displayName = peerInfo?.firstname || peerInfo?.username || "Unknown";

  const statusLabel =
    status === "initiating" ? "Starting call…" :
    status === "ringing-outgoing" ? "Calling…" :
    status === "connecting" ? "Connecting…" :
    status === "reconnecting" ? "Reconnecting…" :
    formatDuration(duration);

  return (
    <>
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

          {status === "failed" && (
            <div className="bg-[#faf5e9] rounded-[28px] p-8 w-80 text-center shadow-2xl">
              {peerInfo?.avatar ? (
                <img src={peerInfo.avatar} alt="" className="w-20 h-20 rounded-full object-cover mx-auto mb-4" />
              ) : displayName !== "Unknown" ? (
                <span
                  className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl text-white font-medium"
                  style={{ background: "linear-gradient(160deg,#b97a45,#8a5527)" }}
                >
                  {displayName[0]?.toUpperCase()}
                </span>
              ) : null}
              <p className="text-[15px] text-[#2e2a22] mb-6">{failReason}</p>
              <button
                onClick={resetLocal}
                className="px-6 py-2 rounded-full bg-[#8a5527] text-white text-[13.5px] font-medium hover:opacity-90"
              >
                Close
              </button>
            </div>
          )}

          {status === "ended" && (
            <div className="bg-[#faf5e9] rounded-[28px] p-8 w-80 text-center shadow-2xl">
              {peerInfo?.avatar ? (
                <img src={peerInfo.avatar} alt="" className="w-20 h-20 rounded-full object-cover mx-auto mb-4" />
              ) : (
                <span
                  className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl text-white font-medium"
                  style={{ background: "linear-gradient(160deg,#b97a45,#8a5527)" }}
                >
                  {displayName[0]?.toUpperCase()}
                </span>
              )}
              <p className="font-display text-[18px] text-[#2e2a22] mb-1">{displayName}</p>
              <p className="text-[13px] text-[#6b6257] mb-6">Call ended · {formatDuration(endedDuration)}</p>
              <button
                onClick={resetLocal}
                className="px-6 py-2 rounded-full bg-[#8a5527] text-white text-[13.5px] font-medium hover:opacity-90"
              >
                Back
              </button>
            </div>
          )}

          {inCallUI && (
            <div className="relative w-full h-full">
              {note && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/60 text-white text-[12.5px] px-3.5 py-1.5 rounded-full">
                  {note}
                </div>
              )}

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
                  <p className="text-[13px] text-white/70">{statusLabel}</p>
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
                  {displayName} · {statusLabel}
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
                {callManager.speakerToggleSupported() && (
                  <button
                    onClick={handleToggleSpeaker}
                    aria-label={speakerOn ? "Switch to earpiece" : "Switch to speaker"}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-lg shadow-lg transition-colors duration-150 ${
                      speakerOn ? "bg-white text-black" : "bg-white/25 text-white hover:bg-white/35"
                    }`}
                  >
                    {speakerOn ? "🔊" : "📱"}
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