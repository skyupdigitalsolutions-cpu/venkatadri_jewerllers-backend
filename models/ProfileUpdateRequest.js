const mongoose = require("mongoose");

const profileUpdateRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    
    requestedChanges: {
      name: { type: String },
      phone: { type: String },
      userPhoto: { type: String },
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProfileUpdateRequest", profileUpdateRequestSchema);
