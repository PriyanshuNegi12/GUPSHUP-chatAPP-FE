import { useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { NavLink } from "react-router";
import VartalaMark from "./VartalaMark";

const BRAND_FONT = "'Baloo 2', 'Trebuchet MS', system-ui, sans-serif";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

function SearchIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChatRow({ chat, isTyping, isOnline }) {
  const title = chat.type === "group" ? chat.name : chat.user?.username || "Unknown";
  const avatar = chat.type === "group" ? null : chat.user?.avatar;
  const preview = isTyping
    ? "typing..."
    : chat.lastMessage
      ? (chat.lastMessage.deleted ? "This message was deleted" : chat.lastMessage.text)
      : "Say hello 👋";

  return (
    <NavLink
      to={`/chat/${chat._id}`}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-2xl mx-1.5 transition-all duration-150 ${
          isActive ? "bg-white shadow-[0_4px_14px_-6px_rgba(138,85,39,0.35)]" : "hover:bg-[#efe4cd]/70"
        }`
      }
    >
      <div className="relative shrink-0">
        {avatar ? (
          <img src={avatar} alt="" className="w-12 h-12 rounded-full object-cover ring-1 ring-black/5" />
        ) : (
          <span
            className="w-12 h-12 rounded-full flex items-center justify-center text-[18px] text-[#f3e8d6] font-medium"
            style={{ background: chat.type === "group" ? "linear-gradient(160deg, #8a7a5e, #4a463e)" : "linear-gradient(160deg, #b97a45, #8a5527)" }}
          >
            {chat.type === "group" ? "👥" : (title?.[0] || "?").toUpperCase()}
          </span>
        )}
        {chat.type === "direct" && isOnline && (
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#4caf6a] border-[2.5px] border-[#f3ead8]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[14.5px] truncate ${chat.unread > 0 ? "font-semibold text-[#241f16]" : "font-medium text-[#2e2a22]"}`}>
            {title}
          </span>
          <span className={`text-[11px] shrink-0 ${chat.unread > 0 ? "text-[#8a5527] font-semibold" : "text-[#a39a89]"}`}>
            {timeAgo(chat.lastMessage?.createdAt || chat.updatedAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className={`text-[13px] truncate ${isTyping ? "text-[#8a5527] font-medium italic" : chat.unread > 0 ? "text-[#4a463e]" : "text-[#8a8072]"}`}>
            {preview}
          </span>
          {chat.unread > 0 && (
            <span
              className="shrink-0 min-w-5 h-5 px-1.5 rounded-full text-white text-[10.5px] font-semibold flex items-center justify-center"
              style={{ background: "linear-gradient(155deg, #c68a52, #8a5527)", boxShadow: "0 2px 6px -1px rgba(138,85,39,0.5)" }}
            >
              {chat.unread > 99 ? "99+" : chat.unread}
            </span>
          )}
        </div>
      </div>
    </NavLink>
  );
}

export default function ChatListSidebar() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { conversations, conversationsLoading } = useSelector((state) => state.chat);
  const typingByConversation = useSelector((state) => state.chat.typingByConversation || {});
  const onlineUserIds = useSelector((state) => state.friend.onlineUserIds);

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === "unread") list = list.filter((c) => c.unread > 0);
    if (filter === "groups") list = list.filter((c) => c.type === "group");

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => {
        const name = c.type === "group" ? c.name : c.user?.username || "";
        return name.toLowerCase().includes(q);
      });
    }
    return list;
  }, [conversations, filter, search]);

  return (
    <div className="flex flex-col h-full" style={{ background: "linear-gradient(180deg, #f8f1e0 0%, #f3ead8 100%)" }}>
      <div className="hidden md:flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <VartalaMark size={38} />
          <span
            className="font-extrabold tracking-[0.06em] text-[24px] leading-none text-[#4a463e]"
            style={{ fontFamily: BRAND_FONT }}
          >
            GUPSHUP
          </span>
        </div>
        <NavLink
          to="/about"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[17px] transition-all duration-200 hover:bg-white hover:shadow-sm hover:scale-110 text-[#3b2e22]"
        >
          ⓘ
        </NavLink>
      </div>

      <div className="px-4 pt-2 pb-1">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a39a89] pointer-events-none">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="w-full h-10 md:h-11 pl-10 pr-4 rounded-full border-[1.5px] border-transparent bg-white/70 outline-none text-[14px] md:text-[14.5px] text-[#3b2e22] placeholder:text-[#a39a89] transition-all duration-200 focus:border-[#8a5527]/40 focus:bg-white focus:shadow-[0_2px_10px_-3px_rgba(138,85,39,0.25)]"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-4 pt-3 pb-2">
        {["all", "unread", "groups"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 md:px-4 py-1.5 rounded-full text-[12px] md:text-[12.5px] font-medium capitalize transition-all duration-200 hover:scale-105 active:scale-95 ${
              filter === f
                ? "text-white shadow-[0_3px_10px_-2px_rgba(138,85,39,0.5)]"
                : "bg-white/60 text-[#6b6257] hover:bg-white"
            }`}
            style={filter === f ? { background: "linear-gradient(155deg, #c68a52, #8a5527)" } : undefined}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-0.5 pb-16 mt-1">
        {conversationsLoading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-10 gap-2">
            <span className="loading loading-spinner loading-md text-[#8a5527]"></span>
            <p className="text-[13px] text-[#8a8072]">Loading chats...</p>
          </div>
        )}
        {!conversationsLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-14 px-8 text-center">
            <span className="text-[38px] mb-3 opacity-70">💬</span>
            <p className="text-[13.5px] text-[#6b6257] leading-relaxed">
              {conversations.length === 0 ? "No chats yet — start one from Friends or Search" : "No matches found"}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {filtered.map((chat) => (
            <ChatRow
              key={chat._id}
              chat={chat}
              isTyping={Object.keys(typingByConversation[chat._id] || {}).length > 0}
              isOnline={chat.type === "direct" && chat.user?._id ? onlineUserIds.includes(chat.user._id) : false}
            />
          ))}
        </div>
      </div>

      <div className="relative">
        <NavLink
          to="/search?tab=group"
          className="absolute bottom-5 right-5 w-13 h-13 md:w-14 md:h-14 rounded-full flex items-center justify-center text-[#f3e8d6] text-2xl transition-all duration-200 hover:scale-110 active:scale-95"
          style={{
            background: "linear-gradient(155deg, #c68a52 0%, #8a5527 100%)",
            boxShadow: "0 8px 20px -6px rgba(138,85,39,0.6)",
          }}
          aria-label="Create group"
        >
          +
        </NavLink>
      </div>
    </div>
  );
}