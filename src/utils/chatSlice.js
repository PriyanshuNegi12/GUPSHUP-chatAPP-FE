import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosClient from './axiosClient';

// ---------- Thunks ----------

export const fetchChatList = createAsyncThunk(
  'chat/fetchList',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.get('/chat/list');
      return data.chats;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async ({ conversationId, before }, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.get(`/chat/${conversationId}/messages`, {
        params: before ? { before } : {},
      });
      return { conversationId, ...data, isFirstPage: !before };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const openDirectChat = createAsyncThunk(
  'chat/openDirect',
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.post(`/chat/direct/${userId}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const createGroup = createAsyncThunk(
  'chat/createGroup',
  async ({ name, memberIds }, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.post('/chat/group', { name, memberIds });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const markChatRead = createAsyncThunk(
  'chat/markRead',
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.post(`/chat/${conversationId}/read`);
      return { conversationId, readAt: data.lastReadAt };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const leaveGroup = createAsyncThunk(
  'chat/leaveGroup',
  async (conversationId, { rejectWithValue }) => {
    try {
      await axiosClient.delete(`/chat/group/${conversationId}/leave`);
      return conversationId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const removeGroupMember = createAsyncThunk(
  'chat/removeGroupMember',
  async ({ conversationId, userId }, { rejectWithValue }) => {
    try {
      await axiosClient.delete(`/chat/group/${conversationId}/members/${userId}`);
      return { conversationId, userId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const addGroupMembers = createAsyncThunk(
  'chat/addGroupMembers',
  async ({ conversationId, memberIds }, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.post(`/chat/group/${conversationId}/members`, { memberIds });
      return { conversationId, ...data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchGroupMembers = createAsyncThunk(
  'chat/fetchGroupMembers',
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.get(`/chat/${conversationId}/members`);
      return { conversationId, members: data.members };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ---------- Slice ----------

const initialState = {
  conversations: [],
  conversationsLoaded: false,
  conversationsLoading: false,

  messagesByConversation: {},
  membersByConversation: {},

  activeConversationId: null,
  typingByConversation: {},
};

function bumpConversation(state, conversationId, patch) {
  const idx = state.conversations.findIndex((c) => c._id === conversationId);
  if (idx === -1) return;
  const updated = { ...state.conversations[idx], ...patch };
  state.conversations.splice(idx, 1);
  state.conversations.unshift(updated);
}

function findProgress(progress, userId) {
  return (progress || []).find((p) => String(p.user?._id || p.user) === String(userId));
}

function removeConversationLocally(state, conversationId) {
  state.conversations = state.conversations.filter((c) => c._id !== conversationId);
  delete state.messagesByConversation[conversationId];
  delete state.membersByConversation[conversationId];
  delete state.typingByConversation[conversationId];
  if (state.activeConversationId === conversationId) state.activeConversationId = null;
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveConversation(state, action) {
      state.activeConversationId = action.payload;
    },

    receiveMessage(state, action) {
      const msg = action.payload;
      const convId = msg.conversation;

      const bucket = state.messagesByConversation[convId];
      if (bucket) {
        const exists = bucket.items.some((m) => m._id === msg._id);
        if (!exists) bucket.items.unshift(msg);
      }

      const isMine = msg.sender === state._meId;
      const isActive = state.activeConversationId === convId;

      bumpConversation(state, convId, {
        lastMessage: msg,
        unread: isMine || isActive ? state.conversations.find((c) => c._id === convId)?.unread || 0
          : (state.conversations.find((c) => c._id === convId)?.unread || 0) + 1,
      });
    },

    chatUpdated(state, action) {
      const { conversationId, lastMessage } = action.payload;
      const conv = state.conversations.find((c) => c._id === conversationId);
      if (!conv) return;

      const isMine = lastMessage.sender === state._meId;
      const isActive = state.activeConversationId === conversationId;

      bumpConversation(state, conversationId, {
        lastMessage,
        unread: isMine || isActive ? conv.unread || 0 : (conv.unread || 0) + 1,
      });
    },

    receiveOwnMessage(state, action) {
      const msg = action.payload;
      const bucket = state.messagesByConversation[msg.conversation];
      if (bucket) {
        const exists = bucket.items.some((m) => m._id === msg._id);
        if (!exists) bucket.items.unshift(msg);
      }
      bumpConversation(state, msg.conversation, { lastMessage: msg });
    },

    messageDeleted(state, action) {
      const { _id, conversation } = action.payload;
      const bucket = state.messagesByConversation[conversation];
      if (bucket) {
        const m = bucket.items.find((m) => m._id === _id);
        if (m) { m.deleted = true; m.text = null; }
      }
    },

    setProgress(state, action) {
      const { conversationId, progress } = action.payload;
      const bucket = state.messagesByConversation[conversationId];
      if (bucket) bucket.progress = progress;
    },

    applyDelivered(state, action) {
      const { conversationId, userId, deliveredAt } = action.payload;
      const bucket = state.messagesByConversation[conversationId];
      if (!bucket) return;
      if (!bucket.progress) bucket.progress = [];
      const existing = findProgress(bucket.progress, userId);
      if (existing) {
        existing.lastDeliveredAt = deliveredAt;
      } else {
        bucket.progress.push({ user: userId, lastDeliveredAt: deliveredAt, lastReadAt: null });
      }
    },

    applyRead(state, action) {
      const { conversationId, userId, readAt } = action.payload;
      const bucket = state.messagesByConversation[conversationId];
      if (!bucket) return;
      if (!bucket.progress) bucket.progress = [];
      const existing = findProgress(bucket.progress, userId);
      if (existing) {
        existing.lastReadAt = readAt;
        if (!existing.lastDeliveredAt) existing.lastDeliveredAt = readAt;
      } else {
        bucket.progress.push({ user: userId, lastDeliveredAt: readAt, lastReadAt: readAt });
      }
    },

    applyReadByAll(state, action) {
      const { conversationId, upTo } = action.payload;
      const bucket = state.messagesByConversation[conversationId];
      if (!bucket || !bucket.progress) return;
      bucket.progress = bucket.progress.map((p) => ({
        ...p,
        lastReadAt: p.lastReadAt && new Date(p.lastReadAt) > new Date(upTo) ? p.lastReadAt : upTo,
        lastDeliveredAt: p.lastDeliveredAt && new Date(p.lastDeliveredAt) > new Date(upTo) ? p.lastDeliveredAt : upTo,
      }));
    },

    setTyping(state, action) {
      const { conversationId, userId } = action.payload;
      if (!state.typingByConversation[conversationId]) state.typingByConversation[conversationId] = {};
      state.typingByConversation[conversationId][userId] = true;
    },

    clearTyping(state, action) {
      const { conversationId, userId } = action.payload;
      if (state.typingByConversation[conversationId]) {
        delete state.typingByConversation[conversationId][userId];
      }
    },

    removedFromGroup(state, action) {
      removeConversationLocally(state, action.payload.conversationId);
    },

    setDirectChatBlockState(state, action) {
      const { userId } = action.payload;
      const conv = state.conversations.find((c) => c.type === 'direct' && c.user?._id === userId);
      if (!conv) return;
      conv.canSend = false;
    },

    setMeId(state, action) {
      state._meId = action.payload;
    },

    resetChatState() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChatList.pending, (state) => { state.conversationsLoading = true; })
      .addCase(fetchChatList.fulfilled, (state, action) => {
        state.conversationsLoading = false;
        state.conversationsLoaded = true;
        state.conversations = action.payload;
      })
      .addCase(fetchChatList.rejected, (state) => { state.conversationsLoading = false; })

      .addCase(fetchMessages.pending, (state, action) => {
        const { conversationId } = action.meta.arg;
        if (!state.messagesByConversation[conversationId]) {
          state.messagesByConversation[conversationId] = { items: [], hasMore: true, loading: false, progress: [] };
        }
        state.messagesByConversation[conversationId].loading = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { conversationId, messages, hasMore, progress, isFirstPage } = action.payload;
        const bucket = state.messagesByConversation[conversationId];
        bucket.loading = false;
        bucket.hasMore = hasMore;
        if (isFirstPage) {
          bucket.items = messages;
          if (progress) bucket.progress = progress;
        } else {
          const existingIds = new Set(bucket.items.map((m) => m._id));
          bucket.items.push(...messages.filter((m) => !existingIds.has(m._id)));
        }
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        const { conversationId } = action.meta.arg;
        if (state.messagesByConversation[conversationId]) {
          state.messagesByConversation[conversationId].loading = false;
        }
      })

      .addCase(openDirectChat.fulfilled, (state, action) => {
        const { conversation } = action.payload;
        const exists = state.conversations.some((c) => c._id === conversation._id);
        if (!exists) {
          state.conversations.unshift({
            _id: conversation._id,
            type: 'direct',
            user: action.payload.user,
            lastMessage: null,
            unread: 0,
            canSend: true,
            updatedAt: new Date().toISOString(),
          });
        }
      })

      .addCase(createGroup.fulfilled, (state, action) => {
        const { conversation } = action.payload;
        state.conversations.unshift({
          _id: conversation._id,
          type: 'group',
          name: conversation.name,
          lastMessage: null,
          unread: 0,
          canSend: true,
          updatedAt: new Date().toISOString(),
        });
      })

      .addCase(markChatRead.fulfilled, (state, action) => {
        const { conversationId } = action.payload;
        const conv = state.conversations.find((c) => c._id === conversationId);
        if (conv) conv.unread = 0;
      })

      .addCase(leaveGroup.fulfilled, (state, action) => {
        removeConversationLocally(state, action.payload);
      })

      .addCase(fetchGroupMembers.fulfilled, (state, action) => {
        const { conversationId, members } = action.payload;
        state.membersByConversation[conversationId] = members;
      })

      .addCase(removeGroupMember.fulfilled, (state, action) => {
        const { conversationId, userId } = action.payload;
        const list = state.membersByConversation[conversationId];
        if (list) {
          state.membersByConversation[conversationId] = list.filter((m) => m.user._id !== userId);
        }
      });
  },
});

export const {
  setActiveConversation,
  receiveMessage,
  chatUpdated,
  receiveOwnMessage,
  messageDeleted,
  setProgress,
  applyDelivered,
  applyRead,
  applyReadByAll,
  setTyping,
  clearTyping,
  removedFromGroup,
  setDirectChatBlockState, // NEW
  setMeId,
  resetChatState,
} = chatSlice.actions;

export default chatSlice.reducer;