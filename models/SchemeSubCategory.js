const mongoose = require("mongoose");

const schemeSubCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    schemeCategoryId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "SchemeCategory", 
      required: true 
    },
    planType: { 
      type: String, 
      enum: ["Type1", "Type2"], 
      default: "Type1",
      required: true 
    }, // Type1: Monthly Gold, Type2: Final Conversion
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SchemeSubCategory", schemeSubCategorySchema);
