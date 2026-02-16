import { Server } from "socket.io";
import pool from "./db.js";
import jwt from "jsonwebtoken";

let io;
const userSockets = new Map();

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    let currentUserId = null;

    socket.on("authenticate", async (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SCRETE || "");
        currentUserId = decoded.user_id;

        userSockets.set(currentUserId, socket.id);
        console.log(`User ${currentUserId} authenticated`); // ---------dev log for socket id---

        // update online status in user table
        await pool.execute(
          "UPDATE users SET is_ofline = 'online', last_seen = NOW() WHERE user_id = ?",
          [currentUserId],
        );

        // Notify others
        io.emit("user_status", { user_id: currentUserId, is_online: "online" });
      } catch (err) {
        console.error("Socket Auth Error:", err.message);
        socket.disconnect();
      }
    });

    // ---- message socket connection ----
    socket.on("send_message", async (data) => {
      const { receiver_id, message, message_type } = data;
      if (!currentUserId) return;

      try {
        // Save to database
        const [result] = await pool.execute(
          "INSERT INTO messages (sender_id, receiver_id, message, message_type) VALUES (?, ?, ?, ?)",
          [currentUserId, receiver_id, message || null, message_type || "text"],
        );

        const newMessage = {
          message_id: result.insertId,
          sender_id: currentUserId,
          receiver_id,
          message,
          message_type: message_type || "text",
          status: "sent",
          sent_at: new Date(),
        };

        // Send to receiver if Online
        const receiverSocketId = userSockets.get(receiver_id);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive_message", newMessage);
        }

        // Send backe to sender to confirm message sent
        socket.emit("message_sent", newMessage);
      } catch (err) {
        console.error("Message Send Error:", err.message);
        socket.emit("message_error", { message: "Failed to send message." });
      }
    });

    socket.on("typing", (data) => {
      const { receiver_id, is_typing } = data;
      const receiverSocketId = userSockets.get(receiver_id);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("user_typing", {
          sender_id: currentUserId,
          is_typing,
        });
      }
    });

    socket.on("disconnect", async () => {
      if (currentUserId) {
        userSockets.delete(currentUserId);
        console.log(`User ${currentUserId} disconnected`);
        try {
          await pool.execute(
            "UPDATE users SET is_online = 'offline', last_seen = NOW() WHERE user_id = ?",
            [currentUserId],
          );
          io.emit("user_status", {
            user_id: currentUserId,
            is_online: "offline",
            last_seen: new Date(),
          });
        } catch (err) {
          console.error("Socket Disconnect Error:", err);
        }
      }
    });
  });
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

export const getUserSocket = (userId) => {
  return userSockets.get(Number(userId));
};
