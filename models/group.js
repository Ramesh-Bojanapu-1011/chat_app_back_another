const mongoose = require("mongoose"); // Erase if already required
require("./user"); // Ensure User model is loaded before MessageSchema

// Message schema with ObjectId references
const GroupSchema = new mongoose.Schema(
  {
    grp_name: {
      type: String,
      required: true,
    },
    grp_created: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    users_in_grp: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    grp_img_url: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);
module.exports = mongoose.model("Group", GroupSchema);
