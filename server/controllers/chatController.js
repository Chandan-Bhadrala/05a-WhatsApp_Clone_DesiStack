import { uploadToCloudinary } from "../config/cloudinaryConfig.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { response } from "../utils/responseHandler.js";

export const sendMessage = async (req, res) => {
  const { senderId, receiverId, content, messageStatus } = req.body;
  const file = req.file;
  try {
    const participants = [senderId, receiverId].sort();
    let conversation = await Conversation.findOne({
      participants: participants,
    });

    if (!conversation) {
      conversation = new Conversation({
        participants,
      });
      await conversation.save();
    }

    let imageOrVideoUrl = null;
    let contentType = null;

    // Handle file upload
    if (file) {
      const uploadResult = await uploadToCloudinary(file);
      if (!uploadResult?.secure_url) {
        return response(res, 400, "Failed to upload the file");
      }

      imageOrVideoUrl = uploadResult?.secure_url;

      if (file.mimetype.startsWith("image")) {
        contentType = "image";
      } else if (file.mimetype.startsWith("video")) {
        contentType = "video";
      } else {
        return response(res, 400, "Unsupported file type.");
      }
    } else if (content?.trim()) {
      contentType = "text";
    } else {
      return response(res, 400, "Message content is required.");
    }

    const message = new Message({
      conversation: conversation?._id,
      sender: senderId,
      receiver: receiverId,
      content,
      contentType,
      imageOrVideoUrl,
      messageStatus,
    });

    await message.save();

    if (message?.content) {
      conversation.lastMessage = message?.id;
    }

    conversation.unreadCount += 1;
    await conversation.save();

    const populatedMessage = await Message.findOne(message?._id)
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture");

    // Emit socket event for the realtime chat.
    if (req.io && req.socketUserMap) {
      const receiverSocketId = req.socketUserMap.get(receiverId);
      if (receiverSocketId) {
        req.io.to(receiverSocketId).emit("receive_message", populatedMessage);
        message.messageStatus = "delivered";
        await message.save();
      }
    }

    return response(res, 201, "Message send successfully", populatedMessage);
  } catch (error) {
    console.error(error);
    return response(
      res,
      500,
      "Failed to send message, please try again later.",
    );
  }
};

// Get all Conversations.
export const getConversations = async (req, res) => {
  const userId = req.userId;
  try {
    let conversation = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "username profilePicture isOnline lastSeen")
      .populate({ path: "lastMessage", select: "username profilePicture" })
      .sort({ updatedAt: -1 });

    return response(
      res,
      201,
      "Conversation retrieved successfully",
      conversation,
    );
  } catch (error) {
    console.error(error);
    return response(res, 500, "Failed to retrieved conversation");
  }
};

// Get Messages of a Specific Conversation.
export const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.userId;
  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversationId) {
      return response(res, 404, "Conversation not found");
    }
    if (!conversation.participants.includes(userId)) {
      return response(res, 403, "Not authorized to view this conversation.");
    }

    const messages = await Message.find({
      conversation: conversationId,
    })
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture")
      .sort("createdAt");

    await Message.updateMany(
      {
        conversation: conversationId,
        receiver: userId,
        messageStatus: { $in: ["send", "delivered"] },
      },
      { $set: { messageStatus: "read" } },
    );

    conversation.unreadCount = 0;
    await conversation.save();

    return response(res, 200, "Message retrieved", messages);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Failed to retrieved messages");
  }
};

// If the user is within the conversation, mark the message as read instantaneously.
export const markAsRead = async (req, res) => {
  const { messageId } = req.body;
  const userId = req.userId;

  try {
    // Get relevant message to determine senders.
    let messages = await Message.find({
      _id: { $in: messageId },
      receiver: userId,
    });

    await Message.updateMany(
      { _id: { $in: messageId }, receiver: userId },
      { $set: { messageStatus: "read" } },
    );

    // Notify to the original sender
    // Emit socket event for the realtime chat.
    if (req.io && req.socketUserMap) {
      for (const message of messages) {
        const senderSocketId = req.socketUserMap.get(message.sender.toString());
        if (senderSocketId) {
          const updatedMessage = {
            _id: message._id,
            messageStatus: "read",
          };
          req.io.to(senderSocketId).emit("message_read", updatedMessage);
          await message.save();
        }
      }
    }
    return response(res, 200, "Messages marked as read", messages);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Failed to mark message as read.");
  }
};

// Delete Message
export const deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  const userId = req.userId;
  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return response(res, 404, "Message not found");
    }

    console.log("message sender:", message.sender);
    console.log("message sender string:", message.sender.toString());
    console.log("req.userId:", userId);
    console.log("typeof req.userId:", typeof userId);
    if (message.sender.toString() != userId) {
      return response(res, 404, "Not authorized to delete the message");
    }
    await message.deleteOne();

    // Emit delete response using socket.
    if (req.io && req.socketUserMap) {
     const receiverSocketId = req.socketUserMap.get(message.receiver.toString())
     if(receiverSocketId){
      req.io.to(receiverSocketId).emit("message_deleted", messageId)
     }
    }
    return response(res, 200, "Message deleted successfully");
  } catch (error) {
    console.error(error);
    return response(res, 500, "Failed to delete the message");
  }
};
