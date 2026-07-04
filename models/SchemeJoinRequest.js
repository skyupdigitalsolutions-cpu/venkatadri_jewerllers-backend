const mongoose = require("mongoose");

const schemeJoinRequestSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: "User",           required: true },
    // Can request via SchemeTemplate (old flow) OR directly via Scheme (new flow)
    template: { type: mongoose.Schema.Types.ObjectId, ref: "SchemeTemplate", default: null },
    scheme:   { type: mongoose.Schema.Types.ObjectId, ref: "Scheme",         default: null },
    plan:     { type: mongoose.Schema.Types.ObjectId, ref: "Plan",           default: null },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "awaiting_payment", "payment_verified"],
      default: "pending",
    },
    adminNote:    { type: String, default: "" },
    approvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    schemeCreated:{ type: mongoose.Schema.Types.ObjectId, ref: "Scheme" },
    monthlyAmount: { type: Number },
    planType: { type: String, enum: ["Type1", "Type2"] },
    startDate:    { type: Date },
    endDate:      { type: Date },
    totalMonths:  { type: Number },
    termsAccepted: { type: Boolean, default: false },
    termsVersion:  { type: Number, default: null },
    // First payment proof (uploaded alongside chit creation)
    screenshotUrl: { type: String, default: "" },
    utrNumber:     { type: String, default: "" },
    userNote:      { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SchemeJoinRequest", schemeJoinRequestSchema);
