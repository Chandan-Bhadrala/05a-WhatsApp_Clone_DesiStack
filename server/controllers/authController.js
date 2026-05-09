import { User } from "../models/User.js";
import { sendOTPToEmail } from "../services/emailService.js";
import { sendOTPToPhoneNumber, verifyOTP } from "../services/twilioService.js";
import { createJWT } from "../utils/generateToken.js";
import { otpGenerator } from "../utils/otpGenerator.js";
import { response } from "../utils/responseHandler.js";

// Step-1 Send OTP
export const sendOTP = async (req, res) => {
  const { phoneNumber, phoneSuffix, email } = req.body;
  const OTP = otpGenerator();
  const expiry = new Date(Date.now() + 5 * 60 * 1000);
  let user;
  try {
    // Let user log in using email.
    if (email) {
      user = await User.findOne({ email });
      if (!user) {
        user = new User({ email });
      }
      user.emailOTP = OTP;
      user.emailOTPExpiry = expiry;
      await user.save();

      // Use Email OTP service.
      await sendOTPToEmail(email, OTP);
      return response(res, 200, "OTP sent to your mail", { email });
    }

    // Let user log in using phone number.
    if (!phoneNumber || !phoneSuffix) {
      return response(res, 400, "Phone number and phone suffix are required.");
    }

    const fullPhoneNumber = `${phoneSuffix}${phoneNumber}`;
    user = await User.findOne({ phoneNumber });
    if (!user) {
      user = await new User({ phoneNumber, phoneSuffix });
    }

    // Use Twilio OTP service.
    await sendOTPToPhoneNumber(fullPhoneNumber);
    await user.save();
    return response(res, 200, "OTP sent successfully.", user);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Error while creating or logging in the user.");
  }
};

// Step-2 Verify OTP
export const verifyUserOTP = async (req, res) => {
  const { phoneNumber, phoneSuffix, email, OTP } = req.body;

  try {
    let user;
    if (email) {
      user = await User.findOne({ email });
      if (!user) {
        return response(res, 404, "User not found");
      }

      const now = new Date();

      if (
        !user.emailOTP ||
        String(user.emailOTP) != String(OTP) ||
        now > new Date(user.emailOTPExpiry)
      ) {
        return response(res, 400, "Invalid or expired OTP");
      }
      user.isVerified = true;
      user.emailOTP = null;
      user.emailOTPExpiry = null;
      await user.save();
    } else {
      if (!phoneNumber || !phoneSuffix) {
        return response(
          res,
          400,
          "Phone number and phone suffix are required.",
        );
      }
      const fullPhoneNumber = `${phoneSuffix}${phoneNumber}`;
      user = await User.findOne({ phoneNumber });
      if (!user) {
        return response(res, 404, "User not found");
      }
      const result = await verifyOTP(fullPhoneNumber, OTP);
      if (result.status != "approved") {
        return response(res, 400, "Invalid OTP");
      }
      user.isVerified = true;
      user.emailOTP = null;
      user.emailOTPExpiry = null;
      await user.save();
    }
    const token = createJWT(user._id);
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    });

    return response(res, 200, "user logged in successfully.", user);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Error while logging in the user.");
  }
};
