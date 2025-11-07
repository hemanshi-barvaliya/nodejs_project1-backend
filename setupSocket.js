import jwt from "jsonwebtoken";
import User from "./models/User.js";
import Message from "./models/Message.js";
import { initIO } from "./socketInstance.js";

// 🟢 Track currently connected users (id → socket)
const usersOnline = {};

export default function setupSocket(httpServer) {
  const io = initIO(httpServer);

  // 🔒 Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication error (no token)"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error("User not found"));

      socket.user = user;
      user.online = true;
      user.socketId = socket.id;
      await user.save();

      // Add to online users map
      usersOnline[user._id.toString()] = socket;

      socket.broadcast.emit("user_online", user._id);
      next();
    } catch (err) {
      console.error("❌ Socket auth error:", err.message);
      next(new Error("Authentication error"));
    }
  });

  // 🔌 On new connection
  io.on("connection", (socket) => {
    const user = socket.user;
    socket.join(user._id.toString());
    console.log(`🟢 ${user.username || user.name} connected (${socket.id})`);

    // 💬 Private message
    socket.on("private_message", async ({ to, content }) => {
      try {
        const msg = await Message.create({
          from: user._id,
          to,
          content,
          delivered: false,
          read: false,
          createdAt: new Date(),
        });

        io.to(to.toString()).emit("private_message", msg);

        const receiver = await User.findById(to);
        if (receiver?.online && receiver?.socketId) {
          msg.delivered = true;
          await msg.save();

          io.to(user._id.toString()).emit("message_delivered", msg._id);
          io.to(to.toString()).emit("message_delivered", msg._id);
        }

        socket.emit("message_sent", msg);
      } catch (err) {
        console.error("Error sending private message:", err);
      }
    });

    // ✅ Mark as read
    socket.on("mark_as_read", async ({ from }) => {
      try {
        const result = await Message.updateMany(
          { from, to: socket.user._id, read: false },
          { $set: { read: true } }
        );

        if (result.modifiedCount > 0) {
          io.to(from.toString()).emit("messages_read", {
            from,
            to: socket.user._id,
          });
        }
      } catch (err) {
        console.error("Error marking messages as read:", err);
      }
    });

    // 📞 CALL EVENTS
    socket.on("call_user", ({ to, from, name, signal }) => {
      const receiverSocket = usersOnline[to];
      if (receiverSocket) {
        console.log(`📞 ${name} is calling user ${to}`);
        receiverSocket.emit("incoming_call", { from, signal, name });
      } else {
        console.log(`❌ User ${to} is offline`);
      }
    });

    socket.on("answer_call", ({ to, from, signal }) => {
      const callerSocket = usersOnline[to];
      if (callerSocket) {
        callerSocket.emit("call_answered", { signal });
      }
    });

    socket.on("reject_call", ({ to, from }) => {
      const callerSocket = usersOnline[to];
      if (callerSocket) {
        callerSocket.emit("call_rejected");
      }
    });

    socket.on("end_call", ({ to }) => {
      const otherSocket = usersOnline[to];
      if (otherSocket) {
        otherSocket.emit("call_ended");
      }
    });

    // 🔴 On disconnect
    socket.on("disconnect", async (reason) => {
      console.log(`🔴 ${user.username || user.name} disconnected (${reason})`);
      delete usersOnline[user._id.toString()];

      await User.findByIdAndUpdate(user._id, {
        online: false,
        socketId: null,
      });

      socket.broadcast.emit("user_offline", user._id);
    });
  });
}
