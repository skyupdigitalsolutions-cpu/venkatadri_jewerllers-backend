const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, unique: true }, // PAY001
    scheme: { type: mongoose.Schema.Types.ObjectId, ref: "Scheme" }, // Optional for first payment during join request
    joinRequest: { type: mongoose.Schema.Types.ObjectId, ref: "SchemeJoinRequest" }, // Link to join request for first payment
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    monthNumber: { type: Number, required: true }, // 1 to 12 (13 = owner bonus)
    amount: { type: Number, required: true },

    goldRateOnPaymentDay: { type: Number, required: true },
    gramsAdded: { type: Number, required: true }, // amount / goldRate

    paidDate: { type: Date },
    dueDate: { type: Date },

    isOwnerPayment: { type: Boolean, default: false }, // true for 13th month

    status: {
      type: String,
      enum: ["paid", "pending", "overdue", "awaiting_verification", "rejected"],
      default: "pending",
    },

    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Bank Transfer", "Online"],
      default: "Online",
    },

    // ── Proof submitted by user ───────────────────────────────────────────
    // User uploads screenshot and/or UTR number; admin reviews and marks paid/rejected
    screenshotUrl: { type: String, default: "" },
    screenshotUploadedAt: { type: Date, default: null },
    utrNumber: { type: String, default: "" },    // UTR / transaction reference number
    userNote: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },

    markedPaidBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

// Auto-generate paymentId
paymentSchema.pre("save", async function (next) {
  if (!this.paymentId) {
    const lastPayment = await mongoose.model("Payment").findOne({}, { paymentId: 1 }).sort({ paymentId: -1 });
    let nextNum = 1;
    if (lastPayment && lastPayment.paymentId) {
      const lastNum = parseInt(lastPayment.paymentId.replace("PAY", ""), 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    this.paymentId = `PAY${String(nextNum).padStart(3, "0")}`;
  }
  next();
});

module.exports = mongoose.model("Payment", paymentSchema);