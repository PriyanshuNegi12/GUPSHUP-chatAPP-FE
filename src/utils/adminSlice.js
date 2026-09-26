import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosClient from './axiosClient';

export const fetchAllUsers = createAsyncThunk(
  'admin/fetchAllUsers',
  async ({ page = 1, q = '' } = {}, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.get('/user/admin/users', { params: { page, q } });
      return data; // { users, total, page, limit }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const deleteUserByAdmin = createAsyncThunk(
  'admin/deleteUser',
  async (userId, { rejectWithValue }) => {
    try {
      await axiosClient.delete(`/user/admin/users/${userId}`);
      return userId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

const initialState = {
  users: [],
  total: 0,
  page: 1,
  limit: 50,
  loading: false,
  error: null,
  deletingIds: [], // userIds currently mid-delete, so their row can show a spinner/disable
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.users;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.limit = action.payload.limit;
      })
      .addCase(fetchAllUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Something went wrong';
      })

      .addCase(deleteUserByAdmin.pending, (state, action) => {
        state.deletingIds.push(action.meta.arg);
      })
      .addCase(deleteUserByAdmin.fulfilled, (state, action) => {
        state.deletingIds = state.deletingIds.filter((id) => id !== action.payload);
        const u = state.users.find((u) => u._id === action.payload);
        if (u) u.isActive = false;
      })
      .addCase(deleteUserByAdmin.rejected, (state, action) => {
        state.deletingIds = state.deletingIds.filter((id) => id !== action.meta.arg);
      });
  },
});

export default adminSlice.reducer;