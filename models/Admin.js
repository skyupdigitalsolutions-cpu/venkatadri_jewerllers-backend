const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    shopName: { type: String, default: "SkyUp Digital Solution" },
    role: { type: String, default: "admin" },

    // ── Unique Shop Code ── e.g. SKY-4821
    shopCode: { type: String, unique: true, uppercase: true },

    adminPhoto: { type: String, default: null },

    // ── Payment details shown to users ──────────────────────────────
    bankName: { type: String, default: "" },
    branch: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifscCode: { type: String, default: "" },
    accountName: { type: String, default: "" },

    // ── Verification OTP for sensitive actions ──
    verificationOtp: { type: String, default: null },
    verificationOtpExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

// Auto-generate shopCode before saving
adminSchema.pre("save", async function (next) {
  if (!this.shopCode) {
    const prefix = (this.shopName || "SKY")
      .replace(/[^a-zA-Z]/g, "")
      .substring(0, 3)
      .toUpperCase();
    const digits = Math.floor(1000 + Math.random() * 9000);
    const code = `${prefix}-${digits}`;
    const existing = await mongoose.model("Admin").findOne({ shopCode: code });
    this.shopCode = existing ? `${prefix}-${Math.floor(1000 + Math.random() * 9000)}` : code;
  }
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

adminSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("Admin", adminSchema);