const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true },
    user:    { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
    scheme:  { type: mongoose.Schema.Types.ObjectId, ref: "Scheme",  required: true },

    phone:      { type: String, required: true },
    message:    { type: String },
    sentAt:     { type: Date },

    status: {
      type: String,
      enum: ["sent", "failed", "pending"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reminder", reminderSchema);