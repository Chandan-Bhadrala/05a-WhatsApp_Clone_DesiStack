import express from "express";
import cors from "cors";
import http from "http";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoute from "./routes/authRoute.js";
import chatRoute from "./routes/chatRoute.js";
import statusRoute from "./routes/statusRoute.js";
import { initializeSocket } from "./services/socketService.js";

dotenv.config();

const app = express();

// Middlewares
const corsOptions = { origin: process.env.FE_URL, Credential: true };
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true })); // Helps in decoding/accessing nested data inside the json body.

// Create Server because socket.io can only latch to the http server and not to the express server.
const server = http.createServer(app);
const io = initializeSocket(server); // Latching socket.io w/ the server.

// Apply Socket middleware before routes.
app.use((req, res, next) => {
  req.io = io; // Attaching server.io to the req object.
  req.socketUserMap = io.socketUserMap;
  next();
});

// Routes
app.use("/api/auth", authRoute);
app.use("/api/chat", chatRoute);
app.use("/api/status", statusRoute)


const PORT = process.env.PORT || 8000;

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    server.listen(PORT, () => console.log(`Server Port: ${PORT}`));
  })
  .catch((error) => {
    console.log("Server not running", error);
    process.exit(1);
  });
