import jwt from "jsonwebtoken";
import { response } from "./responseHandler.js";

export const createJWT = (id) => {
  const token = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_TIMEOUT,
  });
  return `Bearer ${token}`;
};

export const verifyJWT = (req, res, next) => {
  const { token } = req.cookies;

  if (!token) {
    return response(res, 401, "No token provided, please login again");
  }

  const jwtToken = token.split(" ")[1] || null;
  if (!jwtToken) {
    return response(res, 401, "Wrong token format");
  }

  try {
    jwt.verify(jwtToken, process.env.JWT_SECRET, (err, decodedId) => {
      if (err) {
        return response(
          res,
          403,
          "Bad authorization, Invalid or expired token",
        );
      }
      req.userId = decodedId.id;
      next();
    });
  } catch (error) {
    console.error(error);
    return response(res, 500, "Error while verifying user. Please try again.");
  }
};
