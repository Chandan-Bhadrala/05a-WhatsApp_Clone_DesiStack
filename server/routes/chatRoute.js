import { Router } from "express";
import {
  deleteMessage,
  getConversations,
  getMessages,
  markAsRead,
  sendMessage,
} from "../controllers/chatController.js";
import { verifyJWT } from "../utils/generateToken.js";
import { upload } from "../utils/multer.js";

const router = Router();

// Protected Route
router.post("/send-message", verifyJWT, upload.single("media"), sendMessage);
router.get("/conversations", verifyJWT, getConversations);
router.get("/conversation/:conversationId/messages", verifyJWT, getMessages);

router.put("/messages/read", verifyJWT, markAsRead);
router.delete("/messages/:messageId", verifyJWT, deleteMessage);

export default router;
