import { Router } from "express";
import {
  checkAuthenticated,
  getAllUsers,
  logoutUserController,
  sendOTP,
  updateProfileController,
  verifyUserOTP,
} from "../controllers/authController.js";
import { verifyJWT } from "../utils/generateToken.js";
import { upload } from "../utils/multer.js";

const router = Router();

// Sign-up routes
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyUserOTP);
router.get("/logout", logoutUserController);

// Protected Route
router.put(
  "/update-profile",
  verifyJWT,
  upload.single("media"),
  updateProfileController,
);
router.get("/check-auth", verifyJWT, checkAuthenticated);
router.get("/users", verifyJWT, getAllUsers);

export default router;
