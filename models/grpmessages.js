const mongoose = require("mongoose"); // Erase if already required
require("./user"); // Ensure User model is loaded before MessageSchema

// Message schema with ObjectId references
const GroupMessagesSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    message: { type: String },
    fileUrl: { type: String, default: null },
    isRead: { type: Boolean, default: false },
    read_byuser: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
  },
  { timestamps: true },
);
module.exports = mongoose.model("GroupMessages", GroupMessagesSchema);
