import { io } from 'socket.io-client';

let socket = null;

// creates the connection once; safe to call multiple times, only connects the first time
export function getSocket() {
  if (socket) return socket;

  socket = io(import.meta.env.VITE_API_URL, {
    withCredentials: true,
    autoConnect: false, // we connect manually, only after login is confirmed
  });

  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket && socket.connected) socket.disconnect();
}