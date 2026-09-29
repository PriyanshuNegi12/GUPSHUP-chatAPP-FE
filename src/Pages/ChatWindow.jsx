import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchMessages, setActiveConversation, receiveOwnMessage, markChatRead,
  applyDelivered, applyRead, applyReadByAll, leaveGroup, setDirectChatBlockState,
} from "../utils/chatSlice";
import { blockUser, unblockUser, addBlockedLocally } from "../utils/friendSlice";
import { getSocket } from "../utils/socket";
import axiosClient from "../utils/axiosClient";
import * as callManager from "../utils/callManager";

const EMPTY_TYPING_MAP = {};

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

function getTickStatus(message, progress, meId) {
  const others = (progress || []).filter(
    (p) => String(p.user?._id || p.user) !== String(meId)
  );
  if (others.length === 0) return "sent";

  const createdAt = new Date(message.createdAt).getTime();
  const readByAll = others.every(
    (p) => p.lastReadAt && new Date(p.lastReadAt).getTime() >= createdAt
  );
  if (readByAll) return "read";

  const deliveredToAll = others.every(
    (p) => p.lastDeliveredAt && new Date(p.lastDeliveredAt).getTime() >= createdAt
  );
  if (deliveredToAll) return "delivered";

  return "sent";
}

function TickIcon({ status }) {
  const svgProps = { width: 15, height: 10, viewBox: "0 0 16 11", fill: "none" };
  if (status === "sent") {
    return (
      <svg {...svgProps} className="ml-1 opacity-55">
        <path d="M1 5.5 4.5 9 11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const color = status === "read" ? "#4fa8e8" : "currentColor";
  const opacity = status === "read" ? 1 : 0.55;
  return (
    <svg {...svgProps} className="ml-1" style={{ opacity }}>
      <path d="M1 5.5 4.5 9 11 1.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 5.5 9 9 15.5 1.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TypingDots({ color = "#8a8072" }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label="typing">
      {[0, 0.22, 0.44].map((delay, i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ background: color, animation: "typingBounce 1.8s infinite ease-in-out", animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}

function ChevronDownIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function BackArrowIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default function ChatWindow() {
  const { conversationId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const meId = useSelector((state) => state.chat._meId);
  const bucket = useSelector((state) => state.chat.messagesByConversation[conversationId]);
  const conversation = useSelector((state) =>
    state.chat.conversations.find((c) => c._id === conversationId)
  );

  const onlineUserIds = useSelector((state) => state.friend.onlineUserIds);
  const blockedList = useSelector((state) => state.friend.blocked);
  const typingMap = useSelector((state) => state.chat.typingByConversation?.[conversationId] || EMPTY_TYPING_MAP);

  const [text, setText] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const scrollRef = useRef(null);
  const stopTypingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const longPressTimerRef = useRef(null);
  const headerMenuRef = useRef(null);
  const inputRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const prevScrollHeightRef = useRef(null); // used to keep position when older messages are prepended

  const messages = bucket?.items || [];
  const hasMore = bucket?.hasMore ?? true;
  const loading = bucket?.loading || false;
  const progress = bucket?.progress || [];

  const otherOnline = conversation?.type === "direct" && conversation.user?._id
    ? onlineUserIds.includes(conversation.user._id)
    : false;
  const otherTyping = Object.keys(typingMap).length > 0;

  const blockedByMe = conversation?.type === "direct" && conversation.user?._id
    ? blockedList.some((b) => b._id === conversation.user._id)
    : false;
  const cannotSend = conversation?.canSend === false;

  useEffect(() => {
    if (!conversationId) return;

    isNearBottomRef.current = true;
    prevScrollHeightRef.current = null;
    setShowScrollDown(false);

    dispatch(setActiveConversation(conversationId));
    dispatch(fetchMessages({ conversationId }));
    dispatch(markChatRead(conversationId));

    const socket = getSocket();
    socket.emit("joinChat", conversationId);
    socket.emit("markRead", conversationId);

    const onReconnect = () => {
      socket.emit("joinChat", conversationId);
      socket.emit("markRead", conversationId);
      dispatch(fetchMessages({ conversationId }));
    };

    const onDelivered = (payload) => {
      if (payload.conversationId === conversationId) dispatch(applyDelivered(payload));
    };
    const onMessagesRead = (payload) => {
      if (payload.conversationId === conversationId) dispatch(applyRead(payload));
    };
    const onReadByAll = (payload) => {
      if (payload.conversationId === conversationId) dispatch(applyReadByAll(payload));
    };

    socket.on("connect", onReconnect);
    socket.on("delivered", onDelivered);
    socket.on("messagesRead", onMessagesRead);
    socket.on("readByAll", onReadByAll);

    return () => {
      socket.emit("leaveChat", conversationId);
      socket.off("connect", onReconnect);
      socket.off("delivered", onDelivered);
      socket.off("messagesRead", onMessagesRead);
      socket.off("readByAll", onReadByAll);
      dispatch(setActiveConversation(null));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // After older messages are prepended, restore the scroll position so the view doesn't jump.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && prevScrollHeightRef.current != null && !loading) {
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = null;
    }
  }, [messages.length, loading]);

  // Auto-scroll to bottom for new messages / typing indicator.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const newest = messages[0];
    const isOwnMessage = newest && newest.sender === meId;
    if (isNearBottomRef.current || isOwnMessage) {
      el.scrollTop = el.scrollHeight;
      isNearBottomRef.current = true;
    }
  }, [messages.length, otherTyping]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const t = setTimeout(() => {
      window.addEventListener("pointerdown", close);
      window.addEventListener("scroll", close, true);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) setHeaderMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const openContextMenu = (e, messageId, mine, deleted) => {
    if (!mine || deleted) return;
    e.preventDefault();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    const x = Math.max(8, Math.min(clientX, window.innerWidth - 170));
    const y = Math.max(8, Math.min(clientY, window.innerHeight - 60));
    setContextMenu({ x, y, messageId });
  };

  const startLongPress = (e, messageId, mine, deleted) => {
    if (!mine || deleted) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      const x = Math.max(8, Math.min(touch.clientX, window.innerWidth - 170));
      const y = Math.max(8, Math.min(touch.clientY, window.innerHeight - 60));
      setContextMenu({ x, y, messageId });
    }, 500);
  };

  const cancelLongPress = () => {
    clearTimeout(longPressTimerRef.current);
  };

  const loadOlder = () => {
    if (loading || !hasMore || messages.length === 0) return;
    prevScrollHeightRef.current = scrollRef.current?.scrollHeight ?? null;
    const oldest = messages[messages.length - 1];
    dispatch(fetchMessages({ conversationId, before: oldest.createdAt }));
  };

  const handleScroll = (e) => {
    const el = e.target;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
    setShowScrollDown(distanceFromBottom > 400);
    if (el.scrollTop < 60) loadOlder();
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    const socket = getSocket();

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("typing", conversationId);
    }

    clearTimeout(stopTypingTimerRef.current);
    stopTypingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("stopTyping", conversationId);
    }, 2000);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setText("");
    clearTimeout(stopTypingTimerRef.current);
    isTypingRef.current = false;
    const socket = getSocket();
    socket.emit("stopTyping", conversationId);

    socket.emit("sendMessage", { conversationId, text: trimmed }, (res) => {
      if (res?.ok) {
        dispatch(receiveOwnMessage(res.message));
      } else {
        axiosClient.post(`/chat/${conversationId}/messages`, { text: trimmed })
          .then(({ data }) => dispatch(receiveOwnMessage(data.message)))
          .catch(() => setText(trimmed));
      }
    });

    inputRef.current?.focus();
  };

  const handleDelete = (messageId) => {
    const socket = getSocket();
    socket.emit("deleteMessage", messageId);
  };

  const handleLeaveGroup = async () => {
    setHeaderMenuOpen(false);
    if (!window.confirm("Leave this group?")) return;
    const result = await dispatch(leaveGroup(conversationId));
    if (leaveGroup.fulfilled.match(result)) navigate("/");
  };

  const handleBlockUser = async () => {
    setHeaderMenuOpen(false);
    if (!conversation?.user?._id) return;
    if (!window.confirm(`Block ${conversation.user.username}? They won't be able to message you.`)) return;

    const result = await dispatch(blockUser(conversation.user._id));
    if (blockUser.fulfilled.match(result)) {
      dispatch(setDirectChatBlockState({ userId: conversation.user._id }));
      dispatch(addBlockedLocally(conversation.user));
    }
  };

  const handleUnblockUser = async () => {
    setHeaderMenuOpen(false);
    if (!conversation?.user?._id) return;

    await dispatch(unblockUser(conversation.user._id));
  };

  const handleVoiceCall = () => {
    if (!conversation?.user?._id) return;
    callManager.startCall({
      peerUserId: conversation.user._id,
      conversationId,
      callType: "audio",
      peerInfo: conversation.user,
    });
  };

  const handleVideoCall = () => {
    if (!conversation?.user?._id) return;
    callManager.startCall({
      peerUserId: conversation.user._id,
      conversationId,
      callType: "video",
      peerInfo: conversation.user,
    });
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#6b6257] text-[14px] bg-[#f3ead8]">
        <span className="loading loading-spinner loading-md text-[#8a5527]"></span>
        Loading chat...
      </div>
    );
  }

  const title = conversation.type === "group" ? conversation.name : conversation.user?.username;
  const headerAvatar = conversation.type === "direct" ? conversation.user?.avatar : null;

  const orderedMessages = [...messages].reverse();
  const groupedByDay = [];
  let lastDay = null;
  orderedMessages.forEach((m) => {
    const day = new Date(m.createdAt).toDateString();
    if (day !== lastDay) {
      groupedByDay.push({ type: "separator", key: `sep-${day}`, label: formatDateLabel(m.createdAt) });
      lastDay = day;
    }
    groupedByDay.push({ type: "message", key: m._id, message: m });
  });

  return (
    <div className="flex flex-col h-full min-h-0 w-full relative">
      <style>{`
        @keyframes typingBounce {
          0%, 70%, 100% { transform: translateY(0)    scale(0.9);  opacity: 0.35; }
          35%           { transform: translateY(-5px) scale(1.08); opacity: 1;    }
        }
        @keyframes messagePop {
          0%   { opacity: 0; transform: translateY(28px) scale(0.96); }
          60%  { opacity: 1; transform: translateY(-2px)  scale(1.01); }
          100% { opacity: 1; transform: translateY(0)     scale(1);    }
        }
        @keyframes scrollPillIn {
          0%   { opacity: 0; transform: translate(-50%, 10px) scale(0.9); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        @keyframes presencePulse {
          0%   { box-shadow: 0 0 0 0 rgba(76,175,106,0.5); }
          70%  { box-shadow: 0 0 0 6px rgba(76,175,106,0); }
          100% { box-shadow: 0 0 0 0 rgba(76,175,106,0); }
        }
        @keyframes floatBlobOne {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(14%, 18%) scale(1.15); }
          66%      { transform: translate(-10%, 10%) scale(0.9); }
        }
        @keyframes floatBlobTwo {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-16%, -14%) scale(1.2); }
        }
        @keyframes floatBlobThree {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40%      { transform: translate(12%, -16%) scale(1.1); }
          75%      { transform: translate(-14%, 8%) scale(0.92); }
        }
      `}</style>

      {/* ---------- header ---------- */}
      <div
        className="flex items-center gap-3 px-3 sm:px-4 h-17 border-b border-[#e9ddc4] shrink-0 backdrop-blur-sm relative z-10"
        style={{
          background: "linear-gradient(180deg, rgba(251,247,236,0.97) 0%, rgba(250,245,233,0.97) 100%)",
          boxShadow: "0 1px 0 rgba(138,85,39,0.06)",
        }}
      >
        <button
          onClick={() => navigate("/")}
          aria-label="Back"
          className="md:hidden -ml-1 w-9 h-9 rounded-full flex items-center justify-center text-[#3b2e22] hover:bg-[#efe4cd] transition-colors duration-150 shrink-0"
        >
          <BackArrowIcon />
        </button>

        <div className="relative shrink-0">
          {headerAvatar ? (
            <img
              src={headerAvatar}
              alt=""
              className="w-11 h-11 rounded-full object-cover ring-2 ring-white/60"
            />
          ) : (
            <span
              className="w-11 h-11 rounded-full flex items-center justify-center text-[17px] text-[#f3e8d6] font-medium"
              style={{ background: conversation.type === "group" ? "linear-gradient(160deg, #8a7a5e, #4a463e)" : "linear-gradient(160deg, #b97a45, #8a5527)" }}
            >
              {conversation.type === "group" ? "👥" : (title?.[0] || "?").toUpperCase()}
            </span>
          )}
          {conversation.type === "direct" && otherOnline && (
            <span
              className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#4caf6a] border-[2.5px] border-[#faf5e9]"
              style={{ animation: "presencePulse 2s infinite" }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[15.5px] text-[#2e2a22] truncate leading-tight">{title}</p>
          <p className="text-[12px] h-4 flex items-center">
            {otherTyping ? (
              <span className="text-[#8a5527] font-medium italic">typing...</span>
            ) : conversation.type === "direct" ? (
              <span className={otherOnline ? "text-[#4caf6a] font-medium" : "text-[#8a8072]"}>
                {otherOnline ? "Online" : "Offline"}
              </span>
            ) : (
              <span className="text-[#8a8072]">Group</span>
            )}
          </p>
        </div>

        {conversation.type === "direct" && !cannotSend && (
          <>
            <button
              onClick={handleVoiceCall}
              aria-label="Voice call"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#efe4cd] text-[#3b2e22] transition-colors duration-150 text-[16px]"
            >
              📞
            </button>
            <button
              onClick={handleVideoCall}
              aria-label="Video call"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#efe4cd] text-[#3b2e22] transition-colors duration-150 text-[16px]"
            >
              🎥
            </button>
          </>
        )}

        <div className="relative" ref={headerMenuRef}>
          <button
            onClick={() => setHeaderMenuOpen((o) => !o)}
            aria-label="Chat options"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#efe4cd] text-[#3b2e22] transition-colors duration-150 text-[18px]"
          >
            ⋮
          </button>

          {headerMenuOpen && (
            <div
              className="absolute right-0 top-11 w-52 rounded-2xl border border-[#e9ddc4] bg-[#faf5e9] shadow-[0_16px_32px_-12px_rgba(120,85,35,0.4)] overflow-hidden z-30"
              style={{ animation: "messagePop 0.15s ease-out" }}
            >
              {conversation.type === "group" ? (
                <button
                  onClick={handleLeaveGroup}
                  className="block w-full text-left px-4 py-2.5 text-[14px] text-[#8a2f2f] hover:bg-[#f3ead8] transition-colors duration-150"
                >
                  Leave group
                </button>
              ) : blockedByMe ? (
                <button
                  onClick={handleUnblockUser}
                  className="block w-full text-left px-4 py-2.5 text-[14px] text-[#2f6b45] hover:bg-[#f3ead8] transition-colors duration-150"
                >
                  Unblock user
                </button>
              ) : (
                <button
                  onClick={handleBlockUser}
                  className="block w-full text-left px-4 py-2.5 text-[14px] text-[#8a2f2f] hover:bg-[#f3ead8] transition-colors duration-150"
                >
                  Block user
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------- messages ---------- */}
      {/* Outer wrapper: bounded height + background + fixed blobs. The scroller sits on top. */}
      <div
        className="relative flex-1 min-h-0"
        style={{
          background:
            "radial-gradient(circle at 1px 1px, rgba(138,85,39,0.05) 1px, transparent 0) 0 0/22px 22px, linear-gradient(180deg, #f6efdd 0%, #f3ead8 100%)",
        }}
      >
        {/* Blobs: sibling of the scroller, so they stay fixed while messages scroll */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden="true">
          <div
            className="absolute w-96 h-96 rounded-full opacity-[0.32] blur-3xl"
            style={{
              top: "-10%", left: "-12%",
              background: "radial-gradient(circle, #d4a86a 0%, transparent 70%)",
              animation: "floatBlobOne 14s ease-in-out infinite",
            }}
          />
          <div
            className="absolute w-104 h-104 rounded-full opacity-[0.28] blur-3xl"
            style={{
              bottom: "-14%", right: "-10%",
              background: "radial-gradient(circle, #b97a45 0%, transparent 70%)",
              animation: "floatBlobTwo 17s ease-in-out infinite",
            }}
          />
          <div
            className="absolute w-72 h-72 rounded-full opacity-[0.24] blur-3xl"
            style={{
              top: "38%", left: "42%",
              background: "radial-gradient(circle, #e2c290 0%, transparent 70%)",
              animation: "floatBlobThree 19s ease-in-out infinite",
            }}
          />
        </div>

        {/* Scroller: NO justify-end (that clips older messages). Inner wrapper uses mt-auto instead. */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto px-3 sm:px-6 py-5 flex flex-col z-10"
        >
          <div className="flex flex-col gap-0.5 max-w-[94%] mx-auto w-full mt-auto">
            {loading && messages.length > 0 && (
              <div className="flex justify-center py-2">
                <span className="loading loading-spinner loading-xs text-[#8a5527]"></span>
              </div>
            )}

            {loading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 mt-6">
                <span className="loading loading-spinner loading-sm text-[#8a5527]"></span>
                <p className="text-center text-[13px] text-[#6b6257]">Loading messages...</p>
              </div>
            )}

            {groupedByDay.map((item) => {
              if (item.type === "separator") {
                return (
                  <div key={item.key} className="flex items-center justify-center my-4">
                    <span className="px-3.5 py-1 rounded-full bg-white/70 backdrop-blur-sm text-[12px] font-medium text-[#6b6257] shadow-sm border border-[#e9ddc4]/50">
                      {item.label}
                    </span>
                  </div>
                );
              }

              const m = item.message;
              const mine = m.sender === meId;
              const tickStatus = mine && !m.deleted ? getTickStatus(m, progress, meId) : null;

              return (
                <div key={item.key} className={`flex ${mine ? "justify-end" : "justify-start"} mb-1`}>
                  <div
                    onContextMenu={(e) => openContextMenu(e, m._id, mine, m.deleted)}
                    onTouchStart={(e) => startLongPress(e, m._id, mine, m.deleted)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                    style={{
                      animation: "messagePop 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.1)",
                      background: m.deleted
                        ? "#f1ece0"
                        : mine
                          ? "linear-gradient(135deg, #fff9ee 0%, #ffffff 65%)"
                          : "#ffffff",
                      boxShadow: mine
                        ? "0 3px 10px -2px rgba(138,85,39,0.2)"
                        : "0 3px 10px -2px rgba(120,100,70,0.14)",
                      borderLeft: mine ? "3px solid #c68a52" : "3px solid transparent",
                    }}
                    className={`max-w-[85%] px-4 py-2.5 text-[15.5px] text-[#2e2a22] transition-transform duration-150 hover:-translate-y-px ${
                      mine ? "rounded-[20px] rounded-br-md" : "rounded-[20px] rounded-bl-md"
                    } ${m.deleted ? "italic opacity-60" : ""}`}
                  >
                    <p className="whitespace-pre-wrap wrap-break-word leading-relaxed">
                      {m.deleted ? "This message was deleted" : m.text}
                    </p>
                    <div className="flex items-center justify-end gap-0.5 mt-0.5">
                      <span className="text-[11px] text-[#a39a89]">
                        {formatTime(m.createdAt)}
                      </span>
                      {tickStatus && (
                        <span className="text-[#a39a89]">
                          <TickIcon status={tickStatus} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {otherTyping && (
              <div className="flex justify-start mb-1">
                <div className="bg-white rounded-[20px] rounded-bl-md px-4 py-3 shadow-[0_3px_10px_-2px_rgba(120,100,70,0.14)]">
                  <TypingDots />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showScrollDown && (
        <button
          onClick={scrollToBottom}
          style={{ animation: "scrollPillIn 0.18s ease-out" }}
          className="absolute left-1/2 -translate-x-1/2 bottom-21.5 w-10 h-10 rounded-full bg-white border border-[#e9ddc4] shadow-[0_8px_20px_-6px_rgba(120,85,35,0.35)] flex items-center justify-center text-[#3b2e22] hover:bg-[#f3ead8] hover:scale-105 transition-all duration-150 z-20"
          aria-label="Scroll to latest"
        >
          <ChevronDownIcon />
        </button>
      )}

      {/* ---------- input ---------- */}
      {cannotSend ? (
        <div className="flex items-center justify-center gap-2 px-4 py-4 border-t border-[#e9ddc4] bg-[#faf5e9] text-[13.5px] text-[#8a2f2f] shrink-0">
          <span>🚫</span>
          {blockedByMe ? "You have blocked this user" : "You can't send messages in this chat"}
        </div>
      ) : (
        <form
          onSubmit={handleSend}
          className="flex items-end gap-2 px-3 sm:px-4 py-3 border-t border-[#e9ddc4] bg-[#faf5e9] shrink-0 relative z-10"
        >
          <div
            className="flex-1 rounded-[26px] transition-all duration-200"
            style={{
              boxShadow: inputFocused
                ? "0 0 0 3px rgba(138,85,39,0.14), 0 2px 6px -2px rgba(138,85,39,0.15)"
                : "0 1px 3px -1px rgba(120,100,70,0.15)",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={handleTextChange}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Type a message"
              className="w-full h-13 px-5 rounded-[26px] border-[1.5px] outline-none text-[15.5px] text-[#3b2e22] placeholder:text-[#4a3d2e]/50 bg-white transition-colors duration-200"
              style={{ borderColor: inputFocused ? "#8a5527" : "rgba(59,46,34,0.18)" }}
            />
          </div>
          <button
            type="submit"
            disabled={!text.trim()}
            onMouseDown={(e) => e.preventDefault()}
            onTouchStart={(e) => e.preventDefault()}
            className="w-13 h-13 rounded-full flex items-center justify-center text-[#f3e8d6] disabled:opacity-45 transition-all duration-150 hover:scale-105 active:scale-90 disabled:hover:scale-100 shrink-0"
            style={{
              background: "linear-gradient(155deg, #c68a52 0%, #8a5527 100%)",
              boxShadow: text.trim() ? "0 4px 12px -3px rgba(138,85,39,0.5)" : "none",
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22 11 13 2 9Z" />
            </svg>
          </button>
        </form>
      )}

      {contextMenu && (
        <div
          className="fixed z-50 bg-white rounded-xl shadow-[0_16px_32px_-12px_rgba(120,85,35,0.4)] border border-[#e9ddc4] py-1.5 min-w-37.5"
          style={{ top: contextMenu.y, left: contextMenu.x, animation: "messagePop 0.12s ease-out" }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            onClick={() => {
              handleDelete(contextMenu.messageId);
              setContextMenu(null);
            }}
            className="w-full text-left px-3.5 py-2 text-[13px] text-red-600 hover:bg-red-50 rounded-lg mx-1 transition-colors duration-150"
          >
            🗑 Delete message
          </button>
        </div>
      )}
    </div>
  );
}