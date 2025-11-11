import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";

// import path from "path";

import connectDB from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import usersRouter from "./routes/users.js";
import messagesRouter from "./routes/messages.js";
import setupSocket from "./setupSocket.js";
import upload from "./middleware/upload.js";
import { v2 as cloudinary } from "cloudinary";



connectDB();

const app = express();


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

app.use(cors());
app.use(express.json());
// app.use("/uploads", express.static(path.join(path.resolve(), "uploads")));


const testUrl = cloudinary.url('1762408928201-699628717_v5xumw');
console.log("Test Cloudinary URL:", testUrl);

app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path);
    console.log(result);
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Image upload failed" });
  }
});


app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/messages", messagesRouter);


const httpServer = http.createServer(app);
setupSocket(httpServer);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
