import express from "express";
import User from "../models/User.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const users = await User.find({}, "_id name email online socketId image");
    res.status(200).json(users);
  } catch (error) {
    console.error(" Error fetching users:", error);
    res.status(500).json({ message: "Failed to load users" });
  }
});

export default router;
