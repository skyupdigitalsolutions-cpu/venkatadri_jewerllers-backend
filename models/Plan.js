const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    schemeCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "SchemeCategory", required: true },
    name: { type: String, required: true }, // e.g. "₹5,000 Monthly Plan"
    monthlyAmount: { type: Number, required: true },
    duration: { type: Number, default: 12 }, // months
    planType: { 
      type: String, 
      enum: ["Type1", "Type2"], 
      default: "Type1",
      required: true 
    }, // Type1: Monthly Gold, Type2: Final Conversion
    bonusDetails: { type: String, default: "" }, // Description of 13th month bonus
    eligibility: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plan", planSchema);
