// socketInstance.js
import { Server } from "socket.io";

let io = null;

export const initIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5000",
      // origin: "http://localhost:5000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  console.log("✅ Socket.IO server initialized");
  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};
