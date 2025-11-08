import express from "express";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import usersRouter from "./routes/users.js";
import messagesRouter from "./routes/messages.js";
import setupSocket from "./setupSocket.js";

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const httpServer = http.createServer(app);

setupSocket(httpServer);

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/messages", messagesRouter);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
