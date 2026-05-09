import { uploadToCloudinary } from "../config/cloudinaryConfig.js";
import { User } from "../models/User.js";
import { Conversation } from "../models/Conversation.js";
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
    const token = await createJWT(user._id);
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 60,
    });

    return response(res, 200, "user logged in successfully.", user);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Error while logging in the user.");
  }
};

// Update user-Profile
export const updateProfileController = async (req, res) => {
  const { username, agreed, about } = req.body;
  const userId = req.userId;
  const file = req.file; // Pictures are not sent via body but rather via file object inside the req object.

  try {
    const user = await User.findById(userId);
    if (file) {
      const uploadResult = await uploadToCloudinary(file); // Saving file to the cloudinary.
      console.log(uploadResult);
      user.profilePicture = uploadResult?.secure_url; // update the link string in the MongoDB.
    } else if (req.body.profilePicture) {
      user.profilePicture = req.body.profilePicture;
    }
    if (username) user.username = username;
    if (agreed) user.agreed = agreed;
    if (about) user.about = about;
    await user.save();

    return response(res, 200, "user profile updated successfully", user);
  } catch (error) {
    console.error(error);
    response(res, 500, "Failed to update the user profile.");
  }
};

export const checkAuthenticated = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return response(res, 404, "Bad Authorization. Please login again");
    }
    const user = await User.findById(userId);
    if (!user) {
      return response(res, 404, "User not found.");
    }

    return response(
      res,
      200,
      "User retrieved and is allowed to use whatsapp.",
      user,
    );
  } catch (error) {
    console.error(error);
    return response(res, 500, "Failed to authenticate the user.");
  }
};

// Logout user
export const logoutUserController = async (req, res) => {
  try {
    res.cookie("token", " ", { expires: Date.now() });
    return response(res, 200, "user logged out successfully.");
  } catch (error) {
    console.error(error);
    return response(res, 500, "Failed to logout user.");
  }
};

const getAllUsers = async (req, res) => {
  const loggedInUserId = req.userId;
  try {
    const users = await User.find({ _id: { $ne: loggedInUserId } }).select(
      "username profilePicture lastSeen isOnline phoneSuffix phoneNumber about",
    );

    const userWithConversation = await Promise.all(
      users.map(async (user) => {
        const conversation = await Conversation.findOne({
          participants: { $all: [loggedInUserId, user?._id] },
        });
      }),
    );
  } catch (error) {}
};
