import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    phoneNumber: { type: String, unique: true, sparse: true },
    phoneSuffix: { type: String },
    username: { type: String },
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please fill a valid email address",
      ],
    },
    emailOTP: { type: String },
    emailOTPExpiry: { type: Date },
    profilePicture: { type: String },
    about: { type: String },
    lastSeen: { type: Date },
    isOnline: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    agreed: { type: Boolean, default: false },
  },
  { timestamps: true },
);


export const User = mongoose.model("User", userSchema);
