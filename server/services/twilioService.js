import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

// Twilio Credentials from env
const accountSID = process.env.Twilio_Account_SID;
const authToken = process.env.Twilio_Auth_TOKEN;
const serviceSID = process.env.Twilio_Service_SID;

const client = twilio(accountSID, authToken);

// Send OTP to phone number.
export const sendOTPToPhoneNumber = async (phoneNumber) => {
  try {
    if (!phoneNumber) {
      throw new Error("Phone number is required");
    }
    const response = await client.verify.v2
      .services(serviceSID)
      .verifications.create({ to: phoneNumber, channel: "sms" });

    console.log({
      message: `OTP sent to: ${phoneNumber}`,
      TwilioResponse: response,
    });
  } catch (error) {
    console.error(error);
    throw new Error("Failed to send OTP");
  }
};

// Verify OTP sent to the phone number, upon user submission.
export const verifyOTP = async (phoneNumber, otp) => {
  try {
    if (!phoneNumber || !otp) {
      throw new Error("Phone number and OTP are required");
    }
    const response = await client.verify.v2
      .services(serviceSID)
      .verificationChecks.create({ to: phoneNumber, code: otp });

    if (response.status != "approved") {
      throw new Error("Invalid OTP");
    }
    console.log({
      message: `OTP verified for: ${phoneNumber}`,
      TwilioResponse: response,
    });
    return response;
  } catch (error) {
    console.error(error);
    throw new Error("Failed to verify OTP");
  }
};
