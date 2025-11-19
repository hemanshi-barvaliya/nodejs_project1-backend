import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, {
  apiVersion: "v1",
});

router.post("/chat", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent([prompt]);
    const reply = result.response.text();

    res.json({ reply });
  } catch (error) {
    res.status(500).json({ error: "Gemini failed", message: error.message });
  }
});

export default router; // 👈 STOP HERE — NOTHING AFTER THIS
