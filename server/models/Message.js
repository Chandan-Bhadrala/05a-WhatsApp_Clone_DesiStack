// Messages in the Conversations.

import mongoose, { mongo } from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      // Reference to the Metadata.
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: { type: String }, // Content of the Conversation -> Message text.
    imageOrVideoUrl: { type: String }, // Content of the Conversation -> Image/Video storage url.
    contentType: { type: String, enum: ["image", "video", "text"] }, // Restricting the kinds of the contentType for the Message.
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        emoji: String,
      },
    ],
    messageStatus: { type: String, default: "send" },
  },
  { timestamps: true },
);

export const Message = mongoose.model("Message", messageSchema);
