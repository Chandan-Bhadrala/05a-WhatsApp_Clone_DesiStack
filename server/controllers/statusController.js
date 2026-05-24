import { uploadToCloudinary } from "../config/cloudinaryConfig.js";
import { Status } from "../models/Status.js";
import { Message } from "../models/Message.js";
import { response } from "../utils/responseHandler.js";

export const createStatus = async (req, res) => {
  const { content, contentType } = req.body;
  const userId = req.userId;
  const file = req.file;
  try {
    let mediaUrl = null;
    let finalContentType = contentType || "text";
    // Handle file upload
    if (file) {
      const uploadResult = await uploadToCloudinary(file);
      if (!uploadResult?.secure_url) {
        return response(res, 400, "Failed to upload the file");
      }

      mediaUrl = uploadResult?.secure_url;

      if (file.mimetype.startsWith("image")) {
        finalContentType = "image";
      } else if (file.mimetype.startsWith("video")) {
        finalContentType = "video";
      } else {
        return response(res, 400, "Unsupported file type.");
      }
    } else if (content?.trim()) {
      finalContentType = "text";
    } else {
      return response(res, 400, "Message content is required.");
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const status = new Status({
      user: userId,
      content: mediaUrl || content,
      contentType: finalContentType,
    });

    await status.save();

    const populatedStatus = await Status.findOne(status?._id)
      .populate("user", "username profilePicture")
      .populate("viewers", "username profilePicture");

    return response(res, 201, "Status created successfully", populatedStatus);
  } catch (error) {
    console.error(error);
    return response(
      res,
      500,
      "Failed to upload status, please try again later.",
    );
  }
};

// Get all users status
export const getStatus = async (req, res) => {
  try {
    const statuses = await Status.find({
      expiresAt: { $gt: new Date() },
    })
      .populate("user", "username profilePicture")
      .populate("viewers", "username, profilePicture")
      .sort({ createdAt: -1 });

    return response(res, 200, "Status retrieved successfully", statuses);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Failed to retrieve statuses");
  }
};
