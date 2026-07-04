const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, unique: true },
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, lowercase: true, default: "" },
    password: { type: String, required: true },

    // ── Which shop/admin this user belongs to ──
    shopCode: { type: String, required: true, uppercase: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },

    // ── Which branch of the shop ──
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },

    // KYC
    aadharNumber: { type: String, default: "PENDING" },
    aadharCardPhoto: { type: String, default: null },
    userPhoto: { type: String, default: null },

    // Extra info
    dateOfBirth: { type: Date, default: null },
    occupation: { type: String, default: "" },
    address: { type: String, default: "" },

    status: {
      type: String,
      enum: ["active", "inactive", "pending", "rejected"],
      default: "pending",
    },

    // Rejection reason from admin
    rejectReason: { type: String, default: "" },

    // ── Scheme Terms agreement (Shop ↔ User) ──
    agreedToTerms: { type: Boolean, default: false },
    agreedTermsVersion: { type: Number, default: null },
    agreedAt: { type: Date, default: null },

    // ── Platform Terms agreement (SkyUp ↔ User) ──
    agreedToPlatformTerms: { type: Boolean, default: false },
    agreedPlatformTermsAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    schemes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Scheme" }],

    // OTP Auth fields
    verificationOtp: { type: String, default: null },
    verificationOtpExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

// Auto-generate userId
userSchema.pre("save", async function (next) {
  if (!this.userId) {
    // Find the latest user by userId descending
    const lastUser = await mongoose.model("User").findOne({}, { userId: 1 }).sort({ userId: -1 });

    let nextNum = 1;
    if (lastUser && lastUser.userId) {
      // Extract number from "USR001"
      const lastIdNum = parseInt(lastUser.userId.replace("USR", ""), 10);
      if (!isNaN(lastIdNum)) {
        nextNum = lastIdNum + 1;
      }
    }

    this.userId = `USR${String(nextNum).padStart(3, "0")}`;
  }
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("User", userSchema);