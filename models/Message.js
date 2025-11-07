import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: {
    type: String,
    default: "",
  },
  image: {
    type: String,
    default: "",
  },
  file: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  delivered: {
    type: Boolean,
    default: false,
  },
  read: {
    type: Boolean,
    default: false,
  },
});

const Message = mongoose.model("Message", MessageSchema);

export default Message;
