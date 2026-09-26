import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router";
import { searchUsers, sendFriendRequest, clearSearchResults, fetchFriends, fetchSentRequests } from "../utils/friendSlice";
import { openDirectChat, createGroup } from "../utils/chatSlice";

const DEBOUNCE_MS = 500;

export default function SearchPage() {
  const [params] = useSearchParams();
  const initialMode = params.get("tab") === "group" ? "group" : "people";

  const [mode, setMode] = useState(initialMode);
  const [query, setQuery] = useState("");
  const [sentTo, setSentTo] = useState({});
  const [groupName, setGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [creating, setCreating] = useState(false);
  const timerRef = useRef(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { searchResults, loading, friends } = useSelector((state) => state.friend);

  useEffect(() => {
    if (mode === "group") dispatch(fetchFriends());
  }, [mode, dispatch]);

  useEffect(() => {
    return () => { clearTimeout(timerRef.current); dispatch(clearSearchResults()); };
  }, [dispatch]);

  const handleQueryChange = (val) => {
    setQuery(val);
    clearTimeout(timerRef.current);

    const trimmed = val.trim();
    if (trimmed.length < 3) {
      dispatch(clearSearchResults());
      return;
    }
    timerRef.current = setTimeout(() => {
      dispatch(searchUsers(trimmed));
    }, DEBOUNCE_MS);
  };

  const handleAdd = async (userId) => {
    const result = await dispatch(sendFriendRequest(userId));
    if (sendFriendRequest.fulfilled.match(result)) {
      setSentTo((prev) => ({ ...prev, [userId]: result.payload.friendship?.status || "sent" }));
      dispatch(fetchSentRequests()); // keep A's own Sent tab in sync immediately
    }
  };

  const handleMessage = async (userId) => {
    const result = await dispatch(openDirectChat(userId));
    if (openDirectChat.fulfilled.match(result)) {
      navigate(`/chat/${result.payload.conversation._id}`);
    }
  };

  const toggleFriendSelect = (id) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedFriends.length === 0) return;
    setCreating(true);
    const result = await dispatch(createGroup({ name: groupName.trim(), memberIds: selectedFriends }));
    setCreating(false);
    if (createGroup.fulfilled.match(result)) {
      navigate(`/chat/${result.payload.conversation._id}`);
    }
  };

  const btnStyle = { background: "linear-gradient(180deg, #b97a45 0%, #8a5527 100%)" };

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f3ead8]">
      <div className="max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
        <h1 className="font-display text-[26px] md:text-[34px] text-[#2e2a22] mb-4 md:mb-6">
          {mode === "group" ? "Create Group" : "Find People"}
        </h1>

        <div className="flex items-center gap-2 md:gap-3 mb-5 md:mb-7">
          <button
            onClick={() => setMode("people")}
            className={`px-4 md:px-5 py-1.5 md:py-2.5 rounded-full text-[13px] md:text-[14.5px] font-medium transition-all duration-200 hover:scale-105 active:scale-95 ${mode === "people" ? "bg-[#8a5527] text-[#f3e8d6] shadow-sm" : "bg-[#efe4cd] text-[#4a463e] hover:bg-[#e9ddc4]"}`}
          >
            Add Friend
          </button>
          <button
            onClick={() => setMode("group")}
            className={`px-4 md:px-5 py-1.5 md:py-2.5 rounded-full text-[13px] md:text-[14.5px] font-medium transition-all duration-200 hover:scale-105 active:scale-95 ${mode === "group" ? "bg-[#8a5527] text-[#f3e8d6] shadow-sm" : "bg-[#efe4cd] text-[#4a463e] hover:bg-[#e9ddc4]"}`}
          >
            Create Group
          </button>
        </div>

        {mode === "people" && (
          <>
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search by username (min 3 characters)"
              className="w-full h-11 md:h-13 px-4 md:px-5 rounded-full border-[1.5px] border-[#3b2e22]/30 bg-white/70 outline-none text-[14px] md:text-[15.5px] text-[#3b2e22] placeholder:text-[#4a3d2e]/60 mb-4 md:mb-6 transition-all duration-200 focus:border-[#8a5527] focus:bg-white focus:shadow-[0_0_0_3px_rgba(138,85,39,0.15)]"
            />

            <div className="rounded-2xl md:rounded-3xl border border-[#e9ddc4] bg-[#faf5e9] overflow-hidden shadow-sm">
              {loading && <p className="text-center text-[13px] md:text-[15px] text-[#6b6257] py-6 md:py-10">Searching...</p>}
              {!loading && query.trim().length >= 3 && searchResults.length === 0 && (
                <p className="text-center text-[13px] md:text-[15px] text-[#6b6257] py-6 md:py-10">No users found</p>
              )}
              {!loading && searchResults.map((u) => (
                <div key={u._id} className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 md:py-4 border-b border-[#e9ddc4]/60 transition-colors duration-200 hover:bg-[#f3ead8]/50">
                  {u.avatar ? (
                    <img src={u.avatar} alt="" className="w-10 h-10 md:w-13 md:h-13 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-10 h-10 md:w-13 md:h-13 rounded-full bg-[#d8c9a3] flex items-center justify-center text-[18px] md:text-[22px] shrink-0">👤</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[14.5px] md:text-[16.5px] text-[#2e2a22] truncate">{u.firstname}</p>
                    <p className="text-[13px] md:text-[14.5px] text-[#6b6257] truncate">@{u.username}</p>
                  </div>
                  <button
                    onClick={() => handleAdd(u._id)}
                    disabled={Boolean(sentTo[u._id])}
                    className="px-3.5 md:px-4.5 py-1.5 md:py-2 rounded-full text-[12.5px] md:text-[13.5px] font-medium text-[#f3e8d6] disabled:opacity-60 shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95"
                    style={btnStyle}
                  >
                    {sentTo[u._id] === "accepted" ? "Friends" : sentTo[u._id] ? "Requested" : "Add"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {mode === "group" && (
          <>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full h-11 md:h-13 px-4 md:px-5 rounded-full border-[1.5px] border-[#3b2e22]/30 bg-white/70 outline-none text-[14px] md:text-[15.5px] text-[#3b2e22] placeholder:text-[#4a3d2e]/60 mb-4 md:mb-6 transition-all duration-200 focus:border-[#8a5527] focus:bg-white focus:shadow-[0_0_0_3px_rgba(138,85,39,0.15)]"
            />

            <p className="text-[13px] md:text-[14.5px] text-[#6b6257] mb-2 md:mb-3">Select friends to add ({selectedFriends.length} selected)</p>

            <div className="rounded-2xl md:rounded-3xl border border-[#e9ddc4] bg-[#faf5e9] overflow-hidden mb-4 md:mb-6 shadow-sm">
              {friends.length === 0 ? (
                <p className="text-center text-[13px] md:text-[15px] text-[#6b6257] py-6 md:py-10">Add some friends first</p>
              ) : friends.map((f) => {
                const selected = selectedFriends.includes(f._id);
                return (
                  <button
                    key={f._id}
                    onClick={() => toggleFriendSelect(f._id)}
                    className={`w-full flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 md:py-4 border-b border-[#e9ddc4]/60 text-left transition-colors duration-200 ${selected ? "bg-[#e9ddc4]" : "hover:bg-[#efe4cd]"}`}
                  >
                    {f.avatar ? (
                      <img src={f.avatar} alt="" className="w-10 h-10 md:w-13 md:h-13 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="w-10 h-10 md:w-13 md:h-13 rounded-full bg-[#d8c9a3] flex items-center justify-center text-[18px] md:text-[22px] shrink-0">👤</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[14.5px] md:text-[16.5px] text-[#2e2a22] truncate">{f.firstname}</p>
                      <p className="text-[13px] md:text-[14.5px] text-[#6b6257] truncate">@{f.username}</p>
                    </div>
                    {selected && <span className="text-[#8a5527] text-[18px] md:text-[22px] transition-transform duration-200">✓</span>}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleCreateGroup}
              disabled={creating || !groupName.trim() || selectedFriends.length === 0}
              className="w-full h-12 md:h-14 rounded-full text-[15px] md:text-[16.5px] font-medium text-[#f3e8d6] disabled:opacity-60 shadow-md transition-all duration-200 hover:scale-[1.01] hover:shadow-lg active:scale-[0.99]"
              style={btnStyle}
            >
              {creating ? "Creating..." : "Create Group"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}