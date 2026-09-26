import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchFriends, fetchReceivedRequests, fetchSentRequests, fetchBlocked,
  acceptFriendRequest, rejectFriendRequest, cancelFriendRequest,
  unfriendUser, blockUser, unblockUser, addBlockedLocally,
} from "../utils/friendSlice";
import { openDirectChat, setDirectChatBlockState } from "../utils/chatSlice";
import { useNavigate } from "react-router";

function PersonRow({ person, right }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e9ddc4]/60">
      {person.avatar ? (
        <img src={person.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <span className="w-10 h-10 rounded-full bg-[#d8c9a3] flex items-center justify-center">👤</span>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[14.5px] text-[#2e2a22] truncate">{person.firstname}</p>
        <p className="text-[13px] text-[#6b6257] truncate">@{person.username}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">{right}</div>
    </div>
  );
}

const btn = "px-3 py-1.5 rounded-full text-[12.5px] font-medium";
const primaryBtn = `${btn} text-[#f3e8d6]`;
const primaryStyle = { background: "linear-gradient(180deg, #b97a45 0%, #8a5527 100%)" };
const ghostBtn = `${btn} bg-[#efe4cd] text-[#4a463e] hover:bg-[#e9ddc4]`;
const dangerBtn = `${btn} bg-[#f8e4e4] text-[#8a2f2f] hover:bg-[#f3d5d5]`;

export default function FriendsPage() {
  const [tab, setTab] = useState("friends");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { friends, received, sent, blocked } = useSelector((state) => state.friend);

  useEffect(() => {
    dispatch(fetchFriends());
    dispatch(fetchReceivedRequests());
    dispatch(fetchSentRequests());
    dispatch(fetchBlocked());
  }, [dispatch]);

  const openChat = async (userId) => {
    const result = await dispatch(openDirectChat(userId));
    if (openDirectChat.fulfilled.match(result)) {
      navigate(`/chat/${result.payload.conversation._id}`);
    }
  };

  const handleAccept = async (userId) => {
    const result = await dispatch(acceptFriendRequest(userId));
    if (acceptFriendRequest.rejected.match(result)) dispatch(fetchReceivedRequests());
  };

  const handleReject = async (userId) => {
    const result = await dispatch(rejectFriendRequest(userId));
    if (rejectFriendRequest.rejected.match(result)) dispatch(fetchReceivedRequests());
  };

  const handleCancel = async (userId) => {
    const result = await dispatch(cancelFriendRequest(userId));
    if (cancelFriendRequest.rejected.match(result)) dispatch(fetchSentRequests());
  };

  const handleBlock = async (person) => {
    if (!window.confirm(`Block ${person.username}? They'll be removed from your friends and won't be able to message you.`)) return;
    const result = await dispatch(blockUser(person._id));
    if (blockUser.fulfilled.match(result)) {
      dispatch(addBlockedLocally(person));
      dispatch(setDirectChatBlockState({ userId: person._id }));
    }
  };

  const handleUnblock = async (userId) => {
    await dispatch(unblockUser(userId));
    // canSend correctly stays false — see the note in ChatWindow's handleUnblockUser
  };

  const tabs = [
    { key: "friends", label: "Friends", count: friends.length },
    { key: "received", label: "Requests", count: received.length },
    { key: "sent", label: "Sent", count: sent.length },
    { key: "blocked", label: "Blocked", count: blocked.length },
  ];

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f3ead8]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="font-display text-[26px] text-[#2e2a22] mb-4">Friends</h1>

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                tab === t.key ? "bg-[#8a5527] text-[#f3e8d6]" : "bg-[#efe4cd] text-[#4a463e]"
              }`}
            >
              {t.label}{t.count > 0 ? ` (${t.count})` : ""}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-[#e9ddc4] bg-[#faf5e9] overflow-hidden">
          {tab === "friends" && (
            friends.length === 0 ? (
              <p className="text-center text-[13px] text-[#6b6257] py-8">No friends yet. Go add some!</p>
            ) : friends.map((f) => (
              <PersonRow
                key={f._id}
                person={f}
                right={
                  <>
                    <button className={primaryBtn} style={primaryStyle} onClick={() => openChat(f._id)}>Chat</button>
                    <button className={ghostBtn} onClick={() => dispatch(unfriendUser(f._id))}>Remove</button>
                    <button className={dangerBtn} onClick={() => handleBlock(f)}>Block</button>
                  </>
                }
              />
            ))
          )}

          {tab === "received" && (
            received.length === 0 ? (
              <p className="text-center text-[13px] text-[#6b6257] py-8">No pending requests</p>
            ) : received.map((r) => (
              <PersonRow
                key={r.user._id}
                person={r.user}
                right={
                  <>
                    <button className={primaryBtn} style={primaryStyle} onClick={() => handleAccept(r.user._id)}>Accept</button>
                    <button className={ghostBtn} onClick={() => handleReject(r.user._id)}>Reject</button>
                  </>
                }
              />
            ))
          )}

          {tab === "sent" && (
            sent.length === 0 ? (
              <p className="text-center text-[13px] text-[#6b6257] py-8">No sent requests</p>
            ) : sent.map((r) => (
              <PersonRow
                key={r.user._id}
                person={r.user}
                right={<button className={ghostBtn} onClick={() => handleCancel(r.user._id)}>Cancel</button>}
              />
            ))
          )}

          {tab === "blocked" && (
            blocked.length === 0 ? (
              <p className="text-center text-[13px] text-[#6b6257] py-8">No blocked users</p>
            ) : blocked.map((b) => (
              <PersonRow
                key={b._id}
                person={b}
                right={<button className={ghostBtn} onClick={() => handleUnblock(b._id)}>Unblock</button>}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}