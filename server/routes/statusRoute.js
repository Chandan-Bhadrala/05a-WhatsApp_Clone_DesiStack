import { Router } from "express";

import { verifyJWT } from "../utils/generateToken.js";
import { upload } from "../utils/multer.js";
import {
  createStatus,
  deleteStatus,
  getStatus,
  viewStatus,
} from "../controllers/statusController.js";

const router = Router();

// Protected Route
router.post("/", verifyJWT, upload.single("media"), createStatus);
router.get("/", verifyJWT, getStatus);

router.put("/:statusId/view", verifyJWT, viewStatus);
router.delete("/:statusId", verifyJWT, deleteStatus);

export default router;
