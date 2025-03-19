const mongoose = require("mongoose"); // Erase if already required
require("./user"); // Ensure User model is loaded before MessageSchema

// Message schema with ObjectId references
const MessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: { type: String },
    fileUrl: { type: String, default: null },
    isRead: { type: Boolean, default: false },
    isReadAt: { type: Date, default: null }, // Store when the message was read
  },
  { timestamps: true },
);
module.exports = mongoose.model("Message", MessageSchema);
