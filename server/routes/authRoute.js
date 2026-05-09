import { Router } from "express";
import { sendOTP, verifyUserOTP } from "../controllers/authController.js";

const router = Router();

router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyUserOTP);

export default router;
