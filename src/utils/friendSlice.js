import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosClient from './axiosClient';

export const fetchFriends = createAsyncThunk(
  'friend/fetchFriends',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.get('/friend/list');
      return data.friends;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchReceivedRequests = createAsyncThunk(
  'friend/fetchReceived',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.get('/friend/requests/received');
      return data.requests;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchSentRequests = createAsyncThunk(
  'friend/fetchSent',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.get('/friend/requests/sent');
      return data.requests;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchBlocked = createAsyncThunk(
  'friend/fetchBlocked',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.get('/friend/blocked');
      return data.blocked;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const sendFriendRequest = createAsyncThunk(
  'friend/send',
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.post(`/friend/request/${userId}`);
      return { userId, ...data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const acceptFriendRequest = createAsyncThunk(
  'friend/accept',
  async (userId, { rejectWithValue }) => {
    try {
      await axiosClient.post(`/friend/accept/${userId}`);
      return userId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const rejectFriendRequest = createAsyncThunk(
  'friend/reject',
  async (userId, { rejectWithValue }) => {
    try {
      await axiosClient.delete(`/friend/reject/${userId}`);
      return userId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const cancelFriendRequest = createAsyncThunk(
  'friend/cancel',
  async (userId, { rejectWithValue }) => {
    try {
      await axiosClient.delete(`/friend/cancel/${userId}`);
      return userId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const unfriendUser = createAsyncThunk(
  'friend/unfriend',
  async (userId, { rejectWithValue }) => {
    try {
      await axiosClient.delete(`/friend/remove/${userId}`);
      return userId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const blockUser = createAsyncThunk(
  'friend/block',
  async (userId, { rejectWithValue }) => {
    try {
      await axiosClient.post(`/friend/block/${userId}`);
      return userId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const unblockUser = createAsyncThunk(
  'friend/unblock',
  async (userId, { rejectWithValue }) => {
    try {
      await axiosClient.delete(`/friend/block/${userId}`);
      return userId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const searchUsers = createAsyncThunk(
  'friend/search',
  async (q, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.get('/user/search', { params: { q } });
      return data.users;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

const initialState = {
  friends: [],
  received: [],
  sent: [],
  blocked: [],
  searchResults: [],
  loading: false,
  error: null,

  onlineUserIds: [],
  lastSeenById: {},
};

const friendSlice = createSlice({
  name: 'friend',
  initialState,
  reducers: {
    clearSearchResults(state) {
      state.searchResults = [];
    },

    setOnlineList(state, action) {
      state.onlineUserIds = action.payload;
    },

    setUserOnline(state, action) {
      const { userId } = action.payload;
      if (!state.onlineUserIds.includes(userId)) state.onlineUserIds.push(userId);
    },

    setUserOffline(state, action) {
      const { userId, lastSeenAt } = action.payload;
      state.onlineUserIds = state.onlineUserIds.filter((id) => id !== userId);
      if (lastSeenAt) state.lastSeenById[userId] = lastSeenAt;
    },

    // NEW: optimistically add a user to the blocked list right after a
    // successful block, instead of waiting on a fetchBlocked() round trip.
    // Needs the full person object (we already have it locally — either from
    // the friends list or from conversation.user).
    addBlockedLocally(state, action) {
      const person = action.payload;
      if (!person?._id) return;
      if (!state.blocked.some((b) => b._id === person._id)) state.blocked.unshift(person);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFriends.fulfilled, (state, action) => {
        state.friends = action.payload;
      })
      .addCase(fetchReceivedRequests.fulfilled, (state, action) => {
        state.received = action.payload;
      })
      .addCase(fetchSentRequests.fulfilled, (state, action) => {
        state.sent = action.payload;
      })
      .addCase(fetchBlocked.fulfilled, (state, action) => {
        state.blocked = action.payload;
      })

      .addCase(acceptFriendRequest.fulfilled, (state, action) => {
        const userId = action.payload;
        const accepted = state.received.find((r) => r.user._id === userId);
        state.received = state.received.filter((r) => r.user._id !== userId);
        if (accepted) state.friends.unshift(accepted.user);
      })
      .addCase(rejectFriendRequest.fulfilled, (state, action) => {
        state.received = state.received.filter((r) => r.user._id !== action.payload);
      })
      .addCase(cancelFriendRequest.fulfilled, (state, action) => {
        state.sent = state.sent.filter((r) => r.user._id !== action.payload);
      })
      .addCase(unfriendUser.fulfilled, (state, action) => {
        state.friends = state.friends.filter((f) => f._id !== action.payload);
      })
      .addCase(blockUser.fulfilled, (state, action) => {
        const userId = action.payload;
        state.friends = state.friends.filter((f) => f._id !== userId);
        state.received = state.received.filter((r) => r.user._id !== userId);
        state.sent = state.sent.filter((r) => r.user._id !== userId);
      })
      .addCase(unblockUser.fulfilled, (state, action) => {
        state.blocked = state.blocked.filter((b) => b._id !== action.payload);
      })

      .addCase(searchUsers.pending, (state) => { state.loading = true; })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResults = action.payload;
      })
      .addCase(searchUsers.rejected, (state) => { state.loading = false; });
  },
});

export const {
  clearSearchResults,
  setOnlineList,
  setUserOnline,
  setUserOffline,
  addBlockedLocally, // NEW
} = friendSlice.actions;
export default friendSlice.reducer;