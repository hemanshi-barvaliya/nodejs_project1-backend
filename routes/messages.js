import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { getIO } from "../socketInstance.js";

const router = express.Router();

// Ensure upload directory exists
const uploadDir = "uploads/messages";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

// Allowed file types
function fileFilter(req, file, cb) {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/x-zip-compressed",
    "application/zip",
    "application/octet-stream",
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
}

const upload = multer({ storage, fileFilter });

router.post("/", upload.single("attachment"), async (req, res) => {
  try {
    const { from, to, content } = req.body;
    const io = getIO();

    if (!from || !to) {
      return res.status(400).json({ message: "Missing sender or receiver ID" });
    }

    const filePath = req.file ? `/uploads/messages/${req.file.filename}` : "";
    if (!content && !filePath) {
      return res.status(400).json({ message: "Message content or attachment required" });
    }

    const isImage = req.file && req.file.mimetype.startsWith("image/");

    const message = await Message.create({
      from,
      to,
      content: content || "",
      image: isImage ? filePath : "",
      file: !isImage ? filePath : "",
      createdAt: new Date(),
    });

    await message.populate([
      { path: "from", select: "name username" },
      { path: "to", select: "name username" },
    ]);

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const formattedMsg = {
      ...message.toObject(),
      image: message.image ? `${baseURL}${message.image}` : "",
      file: message.file ? `${baseURL}${message.file}` : "",
    };

    if (io) {
      io.to(to.toString()).emit("private_message", formattedMsg);
      io.to(from.toString()).emit("private_message", formattedMsg);
    }

    res.status(201).json(formattedMsg);
  } catch (error) {
    console.error("❌ Error saving message:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

router.post("/multiple", upload.array("attachments", 10), async (req, res) => {
  try {
    const { from, to, content } = req.body;
    const files = req.files || [];
    const io = getIO();

    if (!from || !to) {
      return res.status(400).json({ message: "Missing sender or receiver ID" });
    }

    if (!files.length && !content) {
      return res.status(400).json({ message: "No attachments or content provided" });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const messages = [];

    // ✅ If text message included
    if (content && content.trim() !== "") {
      const textMsg = await Message.create({
        from,
        to,
        content,
        createdAt: new Date(),
      });
      await textMsg.populate([
        { path: "from", select: "name username" },
        { path: "to", select: "name username" },
      ]);

      const formatted = {
        ...textMsg.toObject(),
        image: "",
        file: "",
      };
      messages.push(formatted);
    }

    // ✅ Handle each attachment
    for (const file of files) {
      const isImage = file.mimetype.startsWith("image/");
      const msg = await Message.create({
        from,
        to,
        content: "",
        image: isImage ? `/uploads/messages/${file.filename}` : "",
        file: !isImage ? `/uploads/messages/${file.filename}` : "",
        createdAt: new Date(),
      });

      await msg.populate([
        { path: "from", select: "name username" },
        { path: "to", select: "name username" },
      ]);

      const formatted = {
        ...msg.toObject(),
        image: msg.image ? `${baseURL}${msg.image}` : "",
        file: msg.file ? `${baseURL}${msg.file}` : "",
      };
      messages.push(formatted);
    }

    // ✅ Emit all messages
    if (io) {
      messages.forEach((m) => {
        io.to(to.toString()).emit("private_message", m);
        // io.to(from.toString()).emit("private_message", m);
      });

      // ✅ Handle delivery status for attachments
      const receiver = await User.findById(to);
      if (receiver?.online && receiver?.socketId) {
        // Mark messages as delivered
        await Message.updateMany(
          { _id: { $in: messages.map(m => m._id) }, to },
          { $set: { delivered: true } }
        );

        // Emit delivered events
        messages.forEach((m) => {
          io.to(from.toString()).emit("message_delivered", m._id);
          io.to(to.toString()).emit("message_delivered", m._id);
        });
      }
    }

    res.status(201).json(messages);
  } catch (error) {
    console.error("❌ Error saving multiple attachments:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

/* -------------------- FETCH MESSAGES -------------------- */
router.get("/:userId/:contactId", async (req, res) => {
  try {
    const { userId, contactId } = req.params;
    const baseURL = `${req.protocol}://${req.get("host")}`;

    const messages = await Message.find({
      $or: [
        { from: userId, to: contactId },
        { from: contactId, to: userId },
      ],
    })
      .populate("from", "name username")
      .populate("to", "name username")
      .sort({ createdAt: 1 })
      .lean();

    // ✅ Include full URL for each image/file
    const formatted = messages.map((m) => ({
      ...m,
      image: m.image ? `${baseURL}${m.image}` : "",
      file: m.file ? `${baseURL}${m.file}` : "",
    }));

    res.json(formatted);
  } catch (error) {
    console.error("❌ Error fetching messages:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

/* -------------------- DELETE MESSAGE -------------------- */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const msg = await Message.findById(id);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    const filePath = msg.image || msg.file;
    if (filePath && fs.existsSync(`.${filePath}`)) {
      fs.unlinkSync(`.${filePath}`);
    }

    await msg.deleteOne();
    res.json({ success: true, message: "Message deleted" });
  } catch (error) {
    console.error("❌ Delete message failed:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


export default router;
