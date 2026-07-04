const mongoose = require("mongoose");

const goldRateSchema = new mongoose.Schema(
  {
    adminId:     { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    shopCode:    { type: String, required: true, uppercase: true },

    date:        { type: String, required: true },   // "2025-04-06" (IST date)
    ratePerGram: { type: Number, required: true },
    updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },

    // Is this an end-of-day snapshot (locked at midnight)?
    isSnapshot:  { type: Boolean, default: false },

    // Source of this rate update
    source: {
      type: String,
      enum: ["manual", "reference_site", "snapshot"],
      default: "manual",
    },
  },
  { timestamps: true }
);

// Compound index: one live rate per admin per day (non-snapshot)
goldRateSchema.index({ adminId: 1, date: 1, isSnapshot: 1 });

module.exports = mongoose.model("GoldRate", goldRateSchema);