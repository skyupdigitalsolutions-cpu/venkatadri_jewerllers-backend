const mongoose = require("mongoose");

// Per-admin settings (one document per admin)
const adminSettingsSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      unique: true,
    },
    shopCode: { type: String, required: true, uppercase: true },

    // ── Gold Rate Settings ─────────────────────────────────────────────
    // URL of a reference site the admin uses to check gold rates
    goldReferenceUrl: { type: String, default: "" },

    // Whether auto daily-snapshot at midnight is enabled
    // (admins can turn off if they want full manual control)
    snapshotEnabled: { type: Boolean, default: true },

    // The rate the admin manually read from the reference site
    // (stored separately from the live rate so admin can compare)
    referenceRate: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminSettings", adminSettingsSchema);
