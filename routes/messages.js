import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { getIO } from "../socketInstance.js";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

const uploadToCloudinary = async (filePath, folder = "chat_uploads") => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: "auto", // ✅ ensures images, PDFs, ZIPs all work
    });

    // Remove local file after successful upload
    await fs.promises.unlink(filePath);
    return result.secure_url;
  } catch (err) {
    console.error("❌ Cloudinary upload failed:", err.message);
    throw new Error("Cloudinary upload failed");
  }
};


router.post("/", upload.single("attachment"), async (req, res) => {
  try {
    const { from, to, content } = req.body;
    const io = getIO();

    if (!from || !to) {
      return res.status(400).json({ message: "Missing sender or receiver ID" });
    }

    let imageUrl = "";
    let fileUrl = "";
    let isImage = false;

    // ✅ Upload attachment if present
    if (req.file) {
      isImage = req.file.mimetype.startsWith("image/");
      const uploadedUrl = await uploadToCloudinary(req.file.path);
      if (isImage) imageUrl = uploadedUrl;
      else fileUrl = uploadedUrl;
    }

    // ✅ Validate: must have text or file
    if (!content && !req.file) {
      return res.status(400).json({ message: "Message content or attachment required" });
    }

    // ✅ Create and populate message
    const message = await Message.create({
      from,
      to,
      content: content || "",
      image: isImage ? imageUrl : "",
      file: !isImage ? fileUrl : "",
      createdAt: new Date(),
    });

    await message.populate([
      { path: "from", select: "name username" },
      { path: "to", select: "name username" },
    ]);

    // ✅ No need to prefix baseURL for Cloudinary URLs
    const formattedMsg = {
      ...message.toObject(),
    };

    // ✅ Emit real-time event
    if (io) {
      io.to(to.toString()).emit("private_message", formattedMsg);
      // io.to(from.toString()).emit("private_message", formattedMsg);
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

    const messages = [];

    // ✅ Handle text message (if any)
    if (content?.trim()) {
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

      messages.push(textMsg);
    }

    // ✅ Upload files one by one to Cloudinary
    for (const file of files) {
      const isImage = file.mimetype.startsWith("image/");
      const uploadedUrl = await uploadToCloudinary(file.path, "chat_uploads");

      const msg = await Message.create({
        from,
        to,
        content: "",
        image: isImage ? uploadedUrl : "",
        file: !isImage ? uploadedUrl : "",
        createdAt: new Date(),
      });

      await msg.populate([
        { path: "from", select: "name username" },
        { path: "to", select: "name username" },
      ]);

      messages.push(msg);
    }

    // ✅ Emit messages in real-time (socket.io)
    if (io) {
      messages.forEach((m) => {
        io.to(to.toString()).emit("private_message", m);
        // io.to(from.toString()).emit("private_message", m);
      });
    }

    res.status(201).json(messages);
  } catch (error) {
    console.error("❌ Error saving multiple attachments:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});


// ------------------- FETCH MESSAGES -------------------
router.get("/:userId/:contactId", async (req, res) => {
  try {
    const { userId, contactId } = req.params;

    const messages = await Message.find({
      $or: [{ from: userId, to: contactId }, { from: contactId, to: userId }],
    })
      .populate("from", "name username")
      .populate("to", "name username")
      .sort({ createdAt: 1 })
      .lean();

    res.json(messages);
  } catch (error) {
    console.error("❌ Error fetching messages:", error);
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
