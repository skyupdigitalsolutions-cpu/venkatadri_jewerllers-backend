const mongoose = require("mongoose");

const schemeSchema = new mongoose.Schema(
  {
    schemeId:    { type: String, unique: true }, // e.g. SCH001

    // A scheme may have 0 or more enrolled users
    // user = null means it's an open plan (visible to all)
    user:        { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Array of all users enrolled in this scheme (direct-add or via join request)
    members:     [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    monthlyAmount: { type: Number, required: true },

    startDate:   { type: Date, required: true },
    dueDay:      { type: Number }, // day of month (same as start date day)

    totalMonths: { type: Number, default: 13 }, // user pays 12 months + 1 admin bonus
    currentMonth:{ type: Number, default: 0  }, // how many paid so far

    totalGramsAccumulated: { type: Number, default: 0 },

    // 13th month — owner pays bonus
    ownerPaymentDone: { type: Boolean, default: false },
    ownerPaymentGrams:{ type: Number,  default: 0 },

    goldRateAtStart: { type: Number }, // gold rate on joining day

    // Visibility: admin can show/hide this scheme from user Browse Schemes tab
    isVisible: { type: Boolean, default: true },

    // Description shown to users
    description: { type: String, default: "" },

    status: {
      type: String,
      enum: ["active", "complete", "early_exit", "pending"],
      default: "active",
    },

    earlyExitDate:  { type: Date },
    completionDate: { type: Date },

    // Link to the master Plan/Chet
    planId:   { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
    planType: { type: String, enum: ["Type1", "Type2"], default: "Type1" },
    totalAmountAccumulated: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

// Auto-generate schemeId
schemeSchema.pre("save", async function (next) {
  if (!this.schemeId) {
    const count = await mongoose.model("Scheme").countDocuments();
    this.schemeId = `SCH${String(count + 1).padStart(3, "0")}`;
  }
  // Set due day from startDate
  if (this.startDate && !this.dueDay) {
    this.dueDay = new Date(this.startDate).getDate();
  }
  next();
});

module.exports = mongoose.model("Scheme", schemeSchema);