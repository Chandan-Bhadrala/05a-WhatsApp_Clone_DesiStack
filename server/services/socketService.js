import { Server, Socket } from "socket.io";
import { User } from "../models/User.js";
import { Message } from "../models/Message.js";

// Map to store online users. Store -> userId, socketId.
const onlineUsers = new Map();

// Map to track typing status -> userId -> [conversation]: boolean
const typingUsers = new Map();

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FE_URL,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    },
    pingTimeout: 60000, // Disconnect inactive users or sockets after 60 secs.
  });

  // When a new socket connection is established.
  io.on("connection", (socket) => {
    console.log(`User connected with this socket Id: ${socket.id}`);
    let userId = null;

    // Handle user connection and mark them online in DB.
    socket.on("user_connected", async (connectingUserId) => {
      try {
        userId = connectingUserId;
        onlineUsers.set(userId, socket.id);
        socket.join(userId); // Join a personal room for direct emit.

        // Update user status in the DB.
        await User.findByIdAndUpdate(userId, {
          isOnline: true,
          lastSeen: new Date(),
        });

        // Notify all users that this user is now online.
        io.emit("user_status", { userId, isOnline: true });
      } catch (error) {
        console.error("Error handling user connection: ", error);
      }
    });

    // Return online status of the requested user.
    socket.on("get_user_status", (requestedUserId, callback) => {
      const isOnline = onlineUsers.has(requestedUserId);
      callback({
        userId: requestedUserId,
        isOnline,
        lastSeen: isOnline ? new Date() : null,
      });
    });

    // Forward message to the receiver, if online.
    socket.on("send_message", async (message) => {
      try {
        const receiverSocketId = onlineUsers.get(message.receiverSocketId?._id);

        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive_message", message);
        }
      } catch (error) {
        console.error("Error while sending the message", error);
        socket.emit("message_error", { error: "Failed to send the message." });
      }
    });

    // Update message as read and notify sender.
    socket.on("message_read", async ({ messageIds, senderId }) => {
      try {
        await Message.updateMany(
          { _id: { $in: messageIds } },
          { $set: { messageStatus: "read" } },
        );

        const senderSocketId = onlineUsers.get(senderId);
        if (senderSocketId) {
          messageIds.forEach((messageId) => {
            io.to(senderSocketId).emit("message_status_update", {
              messageId,
              messageStatus: "read",
            });
          });
        }
      } catch (error) {
        console.error("Error updating message read status: ", error);
      }
    });

    // Handle typing start event and auto-stop after 3s
    socket.on("typing_start", ({ conversationId, receiverId }) => {
      if (!userId || !conversationId || !receiverId) return;

      if (!typingUsers.has(userId)) typingUsers.set(userId, {});

      const userTyping = typingUsers.get(userId);

      userTyping[conversationId] = true;

      // Clear any existing timeout
      if (userTyping[`${conversationId}_timeout`]) {
        clearTimeout(userTyping[`${conversationId}_timeout`]);
      }

      // Auto-stop after 3s
      userTyping[`${conversationId}_timeout`] = setTimeout(() => {
        userTyping[conversationId] = false;
        socket.to(receiverId).emit("user_typing", {
          userId,
          conversationId,
          isTyping: false,
        });
      }, 3000);

      // Notify receiver while typing.
      socket.to(receiverId).emit("user_typing", {
        userId,
        conversationId,
        isTyping: true,
      });
    });

    socket.on("typing_stop", ({ conversationId, receiverId }) => {
      if (!userId || !conversationId || !receiverId) return;

      if (typingUsers.has(userId)) {
        const userTyping = typingUsers.get(userId);
        userTyping[conversationId] = false;

        if (userTyping[`${conversationId}_timeout`]) {
          clearTimeout(userTyping[`${conversationId}_timeout`]);
          delete userTyping[`${conversationId}_timeout`];
        }
      }

      socket.to(receiverId).emit("user_typing", {
        userId,
        conversationId,
        isTyping: false,
      });
    });

    // Add or update reaction on message.
    socket.on(
      "add_reaction",
      async ({ messageId, emoji, userId, reactionUserId }) => {
        try {
          const message = await Message.findById(messageId);
          if (!message) return;

          const existingIndex = message.reactions.findIndex(
            (reaction) => reaction.user.toString() === reactionUserId,
          );

          if (existingIndex > -1) {
            const existing = message.reactions(existingIndex);
            if (existing.emoji == emoji) {
              // Remove already existing same emoji.
              message.reactions.splice(existingIndex, 1);
            } else {
              // Change old reaction emoji
              message.reactions[existingIndex].emoji = emoji;
            }
          } else {
            // Add new reaction emoji
            message.reactions.push({ user: reactionUserId, emoji });
          }

          await message.save();

          const populatedMessage = await Message.findOne(message?._id)
            .populate("sender", "username profilePicture")
            .populate("receiver", "username profilePicture")
            .populate("reactions.user", "username");

          const reactionUpdated = {
            messageId,
            reactions: populatedMessage.reactions,
          };

          const senderSocket = onlineUsers.get(
            populatedMessage.sender._id.toString(),
          );
          const receiverSocket = onlineUsers.get(
            populatedMessage.receiver?._id.toString(),
          );

          if (senderSocket)
            io.to(senderSocket).emit("reaction_update", reactionUpdated);

          if (receiverSocket)
            io.to(receiverSocket).emit("reaction_update", reactionUpdated);
        } catch (error) {
          console.error("Error handling reactions: ", error);
        }
      },
    );

    // Handle Disconnection and mark user offline.
    const handleDisconnected = async () => {
      if (!userId) return;
      try {
        onlineUsers.delete(userId);
        // Clear all typing timeouts.
        if (typingUsers.has(userId)) {
          const userTyping = typingUsers.get(userId);
          Object.keys(userTyping).forEach((key) => {
            if (key.endsWith("_timeout")) clearTimeout(userTyping[key]);
          });
          typingUsers.delete(userId);
        }

        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date(),
        });

        io.emit("user_status", {
          userId,
          isOnline: false,
          lastSeen: new Date(),
        });

        socket.leave(userId);
        console.log(`user ${userId} disconnected.`);
      } catch (error) {
        console.error("Error handling disconnection: ", error);
      }
    };

    // Disconnect Event.
    socket.on("disconnect", handleDisconnected)

  });

  // Attach the online user-map to the socket server for the external use, in other controllers, outside this file.
  io.socketUserMap = onlineUsers;

  return io;
};
