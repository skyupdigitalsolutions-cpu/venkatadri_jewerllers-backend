const mongoose = require("mongoose");

const schemeCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    planType: { 
      type: String, 
      enum: ["Type1", "Type2"], 
      default: "Type1",
      required: true 
    }, // Type1: Monthly Gold, Type2: Final Conversion
    image: { type: String, default: "" }, // URL or path to banner
    isVisible: { type: Boolean, default: true },
    termsAndConditions: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SchemeCategory", schemeCategorySchema);
