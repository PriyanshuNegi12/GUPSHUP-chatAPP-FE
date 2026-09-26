import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../utils/authSlice';
import chatReducer from '../utils/chatSlice';
import friendReducer from '../utils/friendSlice';
import adminReducer from '../utils/adminSlice'; // NEW

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    friend: friendReducer,
    admin: adminReducer, // NEW
  },
});