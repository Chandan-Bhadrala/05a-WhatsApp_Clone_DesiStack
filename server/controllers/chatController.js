import { uploadToCloudinary } from "../config/cloudinaryConfig";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { response } from "../utils/responseHandler";

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

      return response(res,201, "Message send successfully", populatedMessage)
  } catch (error) {}
};
