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
      expiresAt,
    });

    await status.save();

    const populatedStatus = await Status.findOne(status?._id)
      .populate("user", "username profilePicture")
      .populate("viewers", "username profilePicture");

    // Emit socket event
    if (req.io && req.socketUserMap) {
      // Broadcast to all connecting users except the status creator.
      for (const [connectedUserId, socketId] of req.socketUserMap) {
        if (connectedUserId !== userId) {
          req.io.to(socketId).emit("new_status", populatedStatus);
        }
      }
    }

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

// Data of users who viewed status
export const viewStatus = async (req, res) => {
  const { statusId } = req.params;
  const userId = req.userId;
  try {
    const status = await Status.findById(statusId);
    if (!status) {
      return response(res, 404, "Status not found");
    }

    if (!status.viewers.includes(userId)) {
      status.viewers.push(userId);
      await status.save();

      const updatedStatus = await Status.findById(statusId)
        .populate("user", "username profilePicture")
        .populate("viewers", "username profilePicture");

      // Emit socket event
      if (req.io && req.socketUserMap) {
        // Broadcast to all connecting users except the status creator.
        const statusOwnerSocketId = req.socketUserMap.get(
          status.user._id.toString(),
        );

        if (statusOwnerSocketId) {
          const viewData = {
            statusId,
            viewerId: userId,
            totalViewers: updatedStatus.viewers.length,
            viewers: updatedStatus.viewers, // Viewers details
          };
          req.io.to(statusOwnerSocketId).emit("status_viewed", viewData);
        } else {
          console.log("Status owner are not connected.");
        }
      }
    } else {
      console.log("user already viewed the status");
    }

    return response(res, 200, "Status viewed successfully");
  } catch (error) {
    console.error(error);
    return response(res, 500, "Failed to update user status data.");
  }
};

export const deleteStatus = async (req, res) => {
  const { statusId } = req.params;
  const userId = req.userId;

  try {
    const status = await Status.findById(statusId);
    if (!status) {
      return response(res, 404, "Status not found");
    }

    if (status.user.toString() !== userId) {
      return response(res, 403, "Not authorized to delete this status.");
    }

    await status.deleteOne();

    // Emit delete response using socket.
    if (req.io && req.socketUserMap) {
      for (const [connectedUserId, socketId] of req.socketUserMap) {
        if (connectedUserId !== userId) {
          req.io.to(socketId).emit("status_deleted", statusId);
        }
      }
    }

    return response(res, 200, "Status deleted successfully");
  } catch (error) {
    console.error(error);
    return response(res, 500, "Failed to delete the status.");
  }
};
