const Payment = require("../models/Payment");
const Scheme = require("../models/Scheme");
const GoldRate = require("../models/GoldRate");
const { normalizeFileUrl } = require("../utils/fileUrl");

// @GET /api/payments
const getAllPayments = async (req, res) => {
  try {
    // Only return payments for users belonging to this admin's shop
    const adminUsers = await require("../models/User").find({ adminId: req.admin._id }).select("_id");
    const userIds = adminUsers.map(u => u._id);
    const payments = await Payment.find({ user: { $in: userIds } })
      .populate("user", "name phone userId")
      .populate("scheme", "schemeId monthlyAmount startDate planType")
      .populate("joinRequest", "planType monthlyAmount")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: payments.length, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/payments/scheme/:schemeId
const getPaymentsByScheme = async (req, res) => {
  try {
    const payments = await Payment.find({ scheme: req.params.schemeId })
      .populate("user", "name phone userId")
      .sort({ monthNumber: 1 });
    res.json({ success: true, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/payments/user/:userId
const getPaymentsByUser = async (req, res) => {
  try {
    // Ensure this user belongs to this admin
    const User = require("../models/User");
    const user = await User.findOne({ _id: req.params.userId, adminId: req.admin._id });
    if (!user) return res.status(403).json({ success: false, message: "User not found in your shop" });
    const payments = await Payment.find({ user: req.params.userId })
      .populate("scheme", "schemeId monthlyAmount startDate")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/payments/:id/mark-paid — admin marks payment as paid
const markPaymentPaid = async (req, res) => {
  try {
    const { paidDate, paymentMode, utrNumber } = req.body;
    let payment = await Payment.findById(req.params.id);
    let joinReq = null;

    if (!payment) {
      // Check if it's a JoinRequest being approved as a payment
      const SchemeJoinRequest = require("../models/SchemeJoinRequest");
      joinReq = await SchemeJoinRequest.findById(req.params.id);
      if (!joinReq) return res.status(404).json({ success: false, message: "Payment or Join Request not found" });
      
      // Verify authorization
      const User = require("../models/User");
      const owner = await User.findOne({ _id: joinReq.user, adminId: req.admin._id });
      if (!owner) return res.status(403).json({ success: false, message: "Not authorized to modify this request" });

      joinReq.status = "payment_verified";
      await joinReq.save();

      // Create the official paid payment record now
      payment = await Payment.create({
        joinRequest: joinReq._id,
        user: joinReq.user,
        monthNumber: 1,
        amount: joinReq.monthlyAmount || 0,
        goldRateOnPaymentDay: 0, 
        gramsAdded: 0,
        dueDate: new Date(),
        status: "paid",
        paidDate: paidDate ? new Date(paidDate) : new Date(),
        paymentMode: paymentMode || "Cash",
        markedPaidBy: req.admin._id,
        screenshotUrl: joinReq.screenshotUrl || "",
        utrNumber: utrNumber || joinReq.utrNumber || "",
      });

      return res.json({ success: true, message: "Enrollment payment verified! You can now approve the scheme in Enrollment Requests.", data: payment });
    }

    if (payment.status === "paid")
      return res.status(400).json({ success: false, message: "Payment already marked as paid" });

    // Verify payment belongs to this admin's shop
    const User = require("../models/User");
    const owner = await User.findOne({ _id: payment.user, adminId: req.admin._id });
    if (!owner) return res.status(403).json({ success: false, message: "Not authorized to modify this payment" });

    const goldRateDoc = await GoldRate.findOne().sort({ date: -1 });
    if (!goldRateDoc)
      return res.status(400).json({ success: false, message: "Please update the gold rate first" });

    // If this is a first payment for a join request
    if (!payment.scheme && payment.joinRequest) {
      const SchemeJoinRequest = require("../models/SchemeJoinRequest");
      const joinReq = await SchemeJoinRequest.findById(payment.joinRequest);
      if (joinReq) {
        joinReq.status = "payment_verified";
        await joinReq.save();
      }
      
      payment.status = "paid";
      payment.paidDate = paidDate ? new Date(paidDate) : new Date();
      payment.paymentMode = paymentMode || "Cash";
      if (utrNumber) payment.utrNumber = utrNumber;
      payment.markedPaidBy = req.admin._id;
      await payment.save();
      
      return res.json({ success: true, message: "Enrollment payment verified! You can now approve the scheme in Enrollment Requests.", data: payment });
    }

    const scheme = await Scheme.findById(payment.scheme);
    if (!scheme) return res.status(404).json({ success: false, message: "Scheme enrollment not found" });

    const isType2 = scheme.planType === "Type2";
    let grams = 0;

    if (!isType2) {
      // Type 1: Monthly Gold Accumulation
      grams = parseFloat((payment.amount / goldRateDoc.ratePerGram).toFixed(4));
      scheme.totalGramsAccumulated = parseFloat(
        (scheme.totalGramsAccumulated + grams).toFixed(4)
      );
    } else {
      // Type 2: Monthly Amount Accumulation
      scheme.totalAmountAccumulated = (scheme.totalAmountAccumulated || 0) + payment.amount;
    }

    payment.status = "paid";
    payment.paidDate = paidDate ? new Date(paidDate) : new Date();
    payment.paymentMode = paymentMode || "Cash";
    payment.goldRateOnPaymentDay = goldRateDoc.ratePerGram;
    payment.gramsAdded = isType2 ? 0 : grams;
    payment.markedPaidBy = req.admin._id;
    if (utrNumber) payment.utrNumber = utrNumber;
    await payment.save();

    scheme.currentMonth += 1;

    // Handle 13th Month / Maturity
    if (scheme.currentMonth === 13 && !scheme.ownerPaymentDone) {
      if (!isType2) {
        // Type 1 Bonus: 1 month extra gold
        const ownerGrams = parseFloat((scheme.monthlyAmount / goldRateDoc.ratePerGram).toFixed(4));
        scheme.ownerPaymentDone = true;
        scheme.ownerPaymentGrams = ownerGrams;
        scheme.totalGramsAccumulated = parseFloat(
          (scheme.totalGramsAccumulated + ownerGrams).toFixed(4)
        );
      } else {
        // Type 2 Bonus: Total Amount + 1 month bonus amount -> Convert to Gold
        const bonusAmount = scheme.monthlyAmount; // 13th month bonus
        const totalAmount = scheme.totalAmountAccumulated + bonusAmount;
        const totalGramsAtMaturity = parseFloat((totalAmount / goldRateDoc.ratePerGram).toFixed(4));
        
        scheme.ownerPaymentDone = true;
        scheme.ownerPaymentGrams = parseFloat((bonusAmount / goldRateDoc.ratePerGram).toFixed(4)); // Recorded bonus grams
        scheme.totalGramsAccumulated = totalGramsAtMaturity;
        scheme.totalAmountAccumulated = totalAmount;
      }
      scheme.status = "complete";
      scheme.completionDate = new Date();
    }

    await scheme.save();

    res.json({
      success: true,
      message: `Payment marked as paid. ${grams}g gold added at ₹${goldRateDoc.ratePerGram}/g`,
      data: payment,
      scheme: {
        totalGrams: scheme.totalGramsAccumulated,
        currentMonth: scheme.currentMonth,
        status: scheme.status,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/payments/pending — get all pending/overdue
const getPendingPayments = async (req, res) => {
  try {
    const { upcoming } = req.query;

    // Get user IDs belonging to this admin only
    const User = require("../models/User");
    const adminUsers = await User.find({ adminId: req.admin._id }).select("_id");
    const userIds = adminUsers.map(u => u._id);

    await Payment.updateMany(
      { status: "pending", dueDate: { $lt: new Date() }, user: { $in: userIds } },
      { status: "overdue" }
    );

    let query = { status: { $in: ["pending", "overdue"] }, user: { $in: userIds } };

    if (upcoming === "true") {
      const next7Days = new Date();
      next7Days.setDate(next7Days.getDate() + 7);
      query.dueDate = { $lte: next7Days };
    }

    let payments = await Payment.find(query)
      .populate("user", "name phone userId")
      .populate("scheme", "schemeId monthlyAmount startDate")
      .sort({ dueDate: 1 });

    if (upcoming === "true") {
      const uniqueMap = new Map();
      payments.forEach(p => {
        const key = `${p.user?._id || p.user}_${p.scheme?._id || p.scheme}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, p);
        }
      });
      payments = Array.from(uniqueMap.values());
    }

    res.json({ success: true, count: payments.length, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// @POST /api/payments/submit — USER submits payment proof for verification
// Accepts: multipart/form-data with fields:
//   - schemeId    (string, required)
//   - monthNumber (number, optional — defaults to current month + 1)
//   - utrNumber   (string, optional but required if no screenshot)
//   - userNote    (string, optional)
//   - screenshot  (file,   optional but required if no utrNumber)
//
// At least one of (screenshot, utrNumber) MUST be provided.
// ───────────────────────────────────────────────────────────────────────────
const submitPaymentScreenshot = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Not authorized" });

    const { schemeId, monthNumber, userNote, utrNumber } = req.body;
    if (!schemeId) return res.status(400).json({ success: false, message: "Scheme ID required" });

    const hasScreenshot = !!req.file;
    const hasUtr = !!(utrNumber && utrNumber.trim());

    if (!hasScreenshot && !hasUtr) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one proof: upload a screenshot or enter your UTR / transaction reference number.",
      });
    }

    const scheme = await Scheme.findById(schemeId);
    if (!scheme) return res.status(404).json({ success: false, message: "Scheme not found" });

    const targetMonth = parseInt(monthNumber, 10) || (scheme.currentMonth || 0) + 1;

    let screenshotUrl = "";
    if (hasScreenshot) {
      screenshotUrl = normalizeFileUrl(req.file.path);
    }

    // Get current gold rate
    const goldRateDoc = await GoldRate.findOne().sort({ date: -1 });
    const rate = goldRateDoc ? goldRateDoc.ratePerGram : 0;
    const isType2 = scheme.planType === "Type2";

    let payment = await Payment.findOne({
      scheme: schemeId,
      user: req.user._id,
      monthNumber: targetMonth,
    });

    if (payment) {
      if (payment.status === "paid") {
        return res.status(400).json({ success: false, message: "This month's payment is already recorded" });
      }
      if (hasScreenshot) {
        payment.screenshotUrl = screenshotUrl;
        payment.screenshotUploadedAt = new Date();
      }
      if (hasUtr) payment.utrNumber = utrNumber.trim();
      payment.userNote = (userNote || "").trim();
      payment.rejectionReason = "";
    } else {
      payment = new Payment({
        scheme: schemeId,
        user: req.user._id,
        monthNumber: targetMonth,
        amount: scheme.monthlyAmount,
        dueDate: new Date(),
        screenshotUrl,
        screenshotUploadedAt: hasScreenshot ? new Date() : null,
        utrNumber: hasUtr ? utrNumber.trim() : "",
        userNote: (userNote || "").trim(),
      });
    }

    // Auto-approve: mark as paid immediately
    const now = new Date();
    payment.status = "paid";
    payment.paidDate = now;
    payment.paymentMode = "Bank Transfer";
    payment.goldRateOnPaymentDay = rate;

    let grams = 0;
    if (!isType2) {
      grams = rate ? parseFloat((scheme.monthlyAmount / rate).toFixed(4)) : 0;
      payment.gramsAdded = grams;
      scheme.totalGramsAccumulated = parseFloat((scheme.totalGramsAccumulated + grams).toFixed(4));
    } else {
      payment.gramsAdded = 0;
      scheme.totalAmountAccumulated = (scheme.totalAmountAccumulated || 0) + scheme.monthlyAmount;
    }

    await payment.save();

    scheme.currentMonth += 1;

    // Handle 13th month maturity
    if (scheme.currentMonth === 13 && !scheme.ownerPaymentDone) {
      if (!isType2) {
        const ownerGrams = rate ? parseFloat((scheme.monthlyAmount / rate).toFixed(4)) : 0;
        scheme.ownerPaymentDone = true;
        scheme.ownerPaymentGrams = ownerGrams;
        scheme.totalGramsAccumulated = parseFloat((scheme.totalGramsAccumulated + ownerGrams).toFixed(4));
      } else {
        const bonusAmount = scheme.monthlyAmount;
        const totalAmount = scheme.totalAmountAccumulated + bonusAmount;
        const totalGrams = rate ? parseFloat((totalAmount / rate).toFixed(4)) : 0;
        scheme.ownerPaymentDone = true;
        scheme.ownerPaymentGrams = rate ? parseFloat((bonusAmount / rate).toFixed(4)) : 0;
        scheme.totalGramsAccumulated = totalGrams;
        scheme.totalAmountAccumulated = totalAmount;
      }
      scheme.status = "complete";
      scheme.completionDate = now;
    }

    await scheme.save();

    res.json({
      success: true,
      message: `Payment recorded! ${grams ? `${grams}g gold added at ₹${rate}/g.` : "Account updated."} You can update the proof within 10 minutes.`,
      data: payment,
      scheme: {
        totalGrams: scheme.totalGramsAccumulated,
        currentMonth: scheme.currentMonth,
        status: scheme.status,
      },
    });
  } catch (err) {
    console.error("submitPaymentScreenshot error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// @PUT /api/payments/:id/reject — admin rejects a submitted screenshot
// Body: { reason }
// ───────────────────────────────────────────────────────────────────────────
const rejectPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment)
      return res.status(404).json({ success: false, message: "Payment not found" });

    // Verify payment belongs to this admin's shop
    const User = require("../models/User");
    const owner = await User.findOne({ _id: payment.user, adminId: req.admin._id });
    if (!owner) return res.status(403).json({ success: false, message: "Not authorized to modify this payment" });

    payment.status = "rejected";
    payment.rejectionReason = (req.body.reason || "").trim();
    await payment.save();

    // If this was a join request payment, update the request status
    if (payment.joinRequest) {
      const SchemeJoinRequest = require("../models/SchemeJoinRequest");
      const joinReq = await SchemeJoinRequest.findById(payment.joinRequest);
      if (joinReq) {
        joinReq.status = "rejected";
        joinReq.adminNote = payment.rejectionReason;
        await joinReq.save();
      }
    }

    res.json({ success: true, message: "Payment rejected", data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// @GET /api/payments/awaiting — admin gets all payments awaiting verification
// ───────────────────────────────────────────────────────────────────────────
const getAwaitingPayments = async (req, res) => {
  try {
    const User = require("../models/User");
    const adminUsers = await User.find({ adminId: req.admin._id }).select("_id");
    const userIds = adminUsers.map(u => u._id);
    const payments = await Payment.find({ status: "awaiting_verification", user: { $in: userIds } })
      .populate("user", "name phone userId")
      .populate("scheme", "schemeId monthlyAmount startDate")
      .populate("joinRequest", "monthlyAmount planType")
      .sort({ screenshotUploadedAt: -1 });

    // ALSO: Find any JoinRequests that are "awaiting_payment" but might not have a Payment record yet
    const SchemeJoinRequest = require("../models/SchemeJoinRequest");
    const joinRequests = await SchemeJoinRequest.find({
      status: "awaiting_payment",
      user: { $in: userIds }
    }).populate("user", "name phone userId");

    // Map JoinRequests to a format similar to Payment for the frontend table
    const virtualPayments = joinRequests
      .filter(jr => !payments.some(p => p.joinRequest?._id?.toString() === jr._id.toString()))
      .map(jr => ({
        _id: jr._id,
        isJoinRequest: true, // Flag for frontend
        user: jr.user,
        amount: jr.monthlyAmount,
        monthNumber: 1,
        status: "awaiting_verification",
        screenshotUrl: jr.screenshotUrl,
        utrNumber: jr.utrNumber,
        userNote: jr.userNote,
        screenshotUploadedAt: jr.updatedAt,
        createdAt: jr.createdAt,
        updatedAt: jr.updatedAt
      }));

    const combined = [...payments, ...virtualPayments].sort((a, b) => 
      new Date(b.screenshotUploadedAt || b.updatedAt) - new Date(a.screenshotUploadedAt || a.updatedAt)
    );

    res.json({ success: true, count: combined.length, data: combined });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// @PUT /api/payments/:id/edit-proof — user edits proof within 10-min window
// ───────────────────────────────────────────────────────────────────────────
const editPaymentProof = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Not authorized" });

    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

    if (payment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (payment.status !== "paid") {
      return res.status(400).json({ success: false, message: "Only paid payments can be edited" });
    }

    // Enforce 10-minute window from submission time (paidDate for auto-paid)
    const submittedAt = payment.screenshotUploadedAt || payment.paidDate || payment.createdAt;
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (submittedAt < tenMinsAgo) {
      return res.status(403).json({ success: false, message: "Edit window has expired. Payment is locked." });
    }

    const { utrNumber, userNote } = req.body;
    const hasScreenshot = !!req.file;
    const hasUtr = !!(utrNumber && utrNumber.trim());

    if (!hasScreenshot && !hasUtr) {
      return res.status(400).json({ success: false, message: "Please provide an updated screenshot or UTR number" });
    }

    if (hasScreenshot) {
      payment.screenshotUrl = normalizeFileUrl(req.file.path);
      // Do NOT reset screenshotUploadedAt — the 10-min window stays from original submit
    }
    if (hasUtr) payment.utrNumber = utrNumber.trim();
    if (userNote !== undefined) payment.userNote = userNote.trim();

    await payment.save();

    res.json({
      success: true,
      message: "Payment proof updated successfully.",
      data: payment,
    });
  } catch (err) {
    console.error("editPaymentProof error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllPayments,
  getPaymentsByScheme,
  getPaymentsByUser,
  markPaymentPaid,
  getPendingPayments,
  submitPaymentScreenshot,
  editPaymentProof,
  rejectPayment,
  getAwaitingPayments,
};