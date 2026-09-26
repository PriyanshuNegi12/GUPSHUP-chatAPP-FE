import { Routes, Route, Navigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { checkAuth, fetchProfile } from "./utils/authSlice";
import {
  fetchChatList, receiveMessage, chatUpdated, messageDeleted,
  setTyping, clearTyping, removedFromGroup, setMeId, resetChatState,
} from "./utils/chatSlice";
import {
  fetchFriends, fetchReceivedRequests, fetchSentRequests,
  setOnlineList, setUserOnline, setUserOffline,
} from "./utils/friendSlice";
import { connectSocket, disconnectSocket, getSocket } from "./utils/socket";
import CallManager from "./components/CallManager";

import LoginPage from "./Pages/LoginPage";
import SignupPage from "./Pages/SignupPage";
import Layout from "./Pages/Layout";
import ChatShell from "./Pages/ChatShell";
import EmptyChatPanel from "./Pages/EmptyChatPanel";
import ChatWindow from "./Pages/ChatWindow";
import FriendsPage from "./Pages/FriendsPage";
import SearchPage from "./Pages/SearchPage";
import ProfilePage from "./Pages/ProfilePage";
import AdminPage from "./Pages/AdminPage";
import AboutPage from "./Pages/AboutPage";

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, user, loading } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated || !user?._id) {
      disconnectSocket();
      return;
    }

    dispatch(setMeId(user._id));
    dispatch(fetchChatList());
    dispatch(fetchProfile()); // fills in avatar/bio/age/etc. app-wide, not just on the profile page

    const socket = connectSocket();

    socket.on("connect", () => {
      console.log("[socket] connected as:", user._id, "| socket id:", socket.id);
    });
    socket.on("connect_error", (err) => {
      console.log("[socket] connect_error:", err.message);
    });

    const onNewMessage = (msg) => dispatch(receiveMessage(msg));

    const onChatUpdated = (payload) => {
      dispatch((innerDispatch, getState) => {
        const isKnown = getState().chat.conversations.some((c) => c._id === payload.conversationId);
        if (isKnown) {
          innerDispatch(chatUpdated(payload));
        } else {
          innerDispatch(fetchChatList());
        }
      });
    };

    const onMessageDeleted = (payload) => dispatch(messageDeleted(payload));

    const onFriendEvent = (payload) => {
      console.log("[socket] friend event received:", payload); // TEMP DEBUG — remove later
      dispatch(fetchReceivedRequests());
      dispatch(fetchSentRequests());
      dispatch(fetchFriends());
      // NEW: friend status changes (accept/block/unblock/remove) all affect
      // whether a direct chat's canSend is true — without this, a stale
      // canSend:false from an earlier block sticks around forever, even
      // after you're friends again, until a full page refresh
      dispatch(fetchChatList());
    };

    const onPresenceInitial = (payload) => dispatch(setOnlineList(payload.onlineUserIds));
    const onPresenceOnline = (payload) => dispatch(setUserOnline(payload));
    const onPresenceOffline = (payload) => dispatch(setUserOffline(payload));

    const onTyping = (payload) => dispatch(setTyping(payload));
    const onStopTyping = (payload) => dispatch(clearTyping(payload));

    const onRemovedFrom = (payload) => dispatch(removedFromGroup(payload));

    socket.on("newMessage", onNewMessage);
    socket.on("chat:updated", onChatUpdated);
    socket.on("messageDeleted", onMessageDeleted);
    socket.on("friend:requestReceived", onFriendEvent);
    socket.on("friend:accepted", onFriendEvent);
    socket.on("friend:rejected", onFriendEvent);
    socket.on("friend:cancelled", onFriendEvent);
    socket.on("friend:removed", onFriendEvent);
    socket.on("presence:initial", onPresenceInitial);
    socket.on("presence:online", onPresenceOnline);
    socket.on("presence:offline", onPresenceOffline);
    socket.on("typing", onTyping);
    socket.on("stopTyping", onStopTyping);
    socket.on("group:removedFrom", onRemovedFrom);

    return () => {
      socket.off("newMessage", onNewMessage);
      socket.off("chat:updated", onChatUpdated);
      socket.off("messageDeleted", onMessageDeleted);
      socket.off("friend:requestReceived", onFriendEvent);
      socket.off("friend:accepted", onFriendEvent);
      socket.off("friend:rejected", onFriendEvent);
      socket.off("friend:cancelled", onFriendEvent);
      socket.off("friend:removed", onFriendEvent);
      socket.off("presence:initial", onPresenceInitial);
      socket.off("presence:online", onPresenceOnline);
      socket.off("presence:offline", onPresenceOffline);
      socket.off("typing", onTyping);
      socket.off("stopTyping", onStopTyping);
      socket.off("group:removedFrom", onRemovedFrom);
    };
  }, [isAuthenticated, user?._id, dispatch]);

  useEffect(() => {
    if (!isAuthenticated) dispatch(resetChatState());
  }, [isAuthenticated, dispatch]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3ead8]">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <>
      <CallManager />
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/signup" element={isAuthenticated ? <Navigate to="/" /> : <SignupPage />} />

        <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route element={<ChatShell />}>
            <Route index element={<EmptyChatPanel />} />
            <Route path="chat/:conversationId" element={<ChatWindow />} />
          </Route>
          <Route path="friends/*" element={<FriendsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route
            path="admin"
            element={user?.role === 'admin' ? <AdminPage /> : <Navigate to="/" />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}

export default App;