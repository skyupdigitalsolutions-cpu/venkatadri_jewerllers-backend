const mongoose = require("mongoose");

const schemeTemplateSchema = new mongoose.Schema(
  {
    templateId: { type: String, unique: true }, // e.g. PLAN001
    name:        { type: String, required: true }, // e.g. "Gold Savings - ₹6,000/month"
    description: { type: String, default: "" },
    monthlyAmount: { type: Number, required: true, min: 6000 },
    durationMonths: { type: Number, default: 11 }, // user pays 11 months; 12th is owner bonus
    isActive:    { type: Boolean, default: true },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

// Auto-generate templateId
schemeTemplateSchema.pre("save", async function (next) {
  if (!this.templateId) {
    const count = await mongoose.model("SchemeTemplate").countDocuments();
    this.templateId = `PLAN${String(count + 1).padStart(3, "0")}`;
  }
  next();
});

module.exports = mongoose.model("SchemeTemplate", schemeTemplateSchema);
