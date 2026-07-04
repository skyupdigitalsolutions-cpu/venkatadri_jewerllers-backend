const mongoose = require("mongoose");

const termsSchema = new mongoose.Schema(
    {
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
        shopCode: { type: String, required: true, uppercase: true },

        version: { type: Number, default: 1 },
        title: { type: String, default: "Terms and Conditions" },
        content: { type: String, required: true }, // plain text or markdown
        language: { type: String, default: "en" },

        effectiveFrom: { type: Date, default: Date.now },
        isActive: { type: Boolean, default: true }, // only one active per shop

        // null = General shop terms
        // "Type1" = Scheme 1 terms
        // "Type2" = Scheme 2 terms
        planType: { type: String, enum: ["Type1", "Type2", null], default: null },

        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    },
    { timestamps: true }
);

// Helpful compound indexes
termsSchema.index({ adminId: 1, isActive: 1 });
termsSchema.index({ adminId: 1, version: -1 });

module.exports = mongoose.model("TermsAndConditions", termsSchema);