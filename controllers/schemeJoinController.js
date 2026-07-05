const SchemeJoinRequest = require("../models/SchemeJoinRequest");
const SchemeTemplate    = require("../models/SchemeTemplate");
const Scheme            = require("../models/Scheme");
const Payment           = require("../models/Payment");
const GoldRate          = require("../models/GoldRate");
const User              = require("../models/User");
const Plan              = require("../models/Plan");
const { normalizeFileUrl } = require("../utils/fileUrl");

// @GET /api/scheme-join/my  — user sees own join requests
const getUserRequests = async (req, res) => {
  try {
    const requests = await SchemeJoinRequest.find({ user: req.user._id })
      .populate("template", "name monthlyAmount description durationMonths")
      .populate("scheme",   "schemeId monthlyAmount description startDate isVisible")
      .populate("plan",     "name monthlyAmount duration planType")
      .populate("schemeCreated", "schemeId status currentMonth totalGramsAccumulated")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/scheme-join/request  — user submits a join request for a SchemeTemplate
const createRequest = async (req, res) => {
  try {
    const { templateId } = req.body;
    if (!templateId)
      return res.status(400).json({ success: false, message: "Template ID required" });

    const template = await SchemeTemplate.findById(templateId);
    if (!template || !template.isActive)
      return res.status(404).json({ success: false, message: "Scheme plan not found or inactive" });

    const request = await SchemeJoinRequest.create({ user: req.user._id, template: templateId });
    await request.populate("template", "name monthlyAmount");
    res.status(201).json({ success: true, message: "Request submitted! Admin will review shortly.", data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/scheme-join/request-scheme  — user requests to join a real Scheme directly
const createSchemeRequest = async (req, res) => {
  try {
    const { schemeId } = req.body;
    if (!schemeId)
      return res.status(400).json({ success: false, message: "schemeId is required" });

    const scheme = await Scheme.findOne({ _id: schemeId, isVisible: true });
    if (!scheme)
      return res.status(404).json({ success: false, message: "Scheme not found or not visible" });

    const request = await SchemeJoinRequest.create({ user: req.user._id, scheme: schemeId });
    res.status(201).json({ success: true, message: "Request submitted! Admin will review shortly.", data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/scheme-join/request-plan  — user requests to join a hierarchical Plan
const createPlanRequest = async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: "planId is required" });

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    const request = await SchemeJoinRequest.create({ user: req.user._id, plan: planId });
    res.status(201).json({ success: true, message: "Request submitted! Admin will review shortly.", data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/scheme-join  — admin sees all join requests for their shop
const getAllRequests = async (req, res) => {
  try {
    const requests = await SchemeJoinRequest.find()
      .populate("user",     "name phone userId adminId")
      .populate("template", "name monthlyAmount createdBy")
      .populate("scheme",   "schemeId monthlyAmount createdBy description")
      .populate("plan",     "name monthlyAmount planType")
      .sort({ createdAt: -1 });

    // Filter to only this admin's users or schemes/templates
    const filtered = requests.filter(r =>
      r.user?.adminId?.toString()       === req.admin._id.toString() ||
      r.template?.createdBy?.toString() === req.admin._id.toString() ||
      r.scheme?.createdBy?.toString()   === req.admin._id.toString()
    );
    res.json({ success: true, count: filtered.length, data: filtered });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/scheme-join/:id/approve  — admin approves, adds user to the existing scheme
const approveRequest = async (req, res) => {
  try {
    const joinReq = await SchemeJoinRequest.findById(req.params.id)
      .populate("scheme")
      .populate("user");
    if (!joinReq)
      return res.status(404).json({ success: false, message: "Request not found" });
    if (!joinReq.user?.adminId || joinReq.user.adminId.toString() !== req.admin._id.toString())
      return res.status(403).json({ success: false, message: "Not authorized to approve this request" });
    if (joinReq.status !== "pending" && joinReq.status !== "payment_verified")
      return res.status(400).json({ success: false, message: "Request already processed or not yet verified" });

    // Get latest available gold rate
    const goldRateDoc = await GoldRate.findOne().sort({ date: -1 });
    if (!goldRateDoc)
      return res.status(400).json({ success: false, message: "Please update the gold rate before approving" });

    // Logic for unique schemeId: CH + userId numeric digits + last 4 of phone
    const userDigits = (joinReq.user.userId || "").replace(/\D/g, ""); // e.g. USR001 → 001
    const baseId = `CH${userDigits}${joinReq.user.phone.slice(-4)}`;
    let finalId = baseId;
    let exists = await Scheme.findOne({ schemeId: finalId });
    let counter = 2;
    while (exists) {
      finalId = `${baseId}-${counter}`;
      exists = await Scheme.findOne({ schemeId: finalId });
      counter++;
    }

    let scheme;
    if (joinReq.plan) {
      // Create a brand new scheme for this user based on the hierarchical Plan
      const plan = await Plan.findById(joinReq.plan).populate("schemeCategoryId");
      if (!plan) return res.status(404).json({ success: false, message: "Associated hierarchical plan not found" });

      // Create new scheme document
      scheme = await Scheme.create({
        schemeId: finalId,
        monthlyAmount: plan.monthlyAmount,
        description:   `${plan.schemeCategoryId?.name} - ${plan.name}`,
        planType:      plan.planType,
        startDate:     new Date(),
        goldRateAtStart: goldRateDoc.ratePerGram,
        createdBy:     plan.createdBy || req.admin._id,
        members:       [joinReq.user._id],
        user:          joinReq.user._id,
        plan:          plan._id, // Keep reference to original plan
      });
    } else if (joinReq.scheme) {
      const template = await Scheme.findById(joinReq.scheme._id);
      if (!template) return res.status(404).json({ success: false, message: "Master scheme not found" });

      // Create a UNIQUE profile for this user's enrollment
      scheme = await Scheme.create({
        schemeId: finalId,
        monthlyAmount: template.monthlyAmount,
        description: template.description || template.name,
        startDate: new Date(),
        dueDay: new Date().getDate(),
        goldRateAtStart: goldRateDoc.ratePerGram,
        isVisible: false,
        createdBy: template.createdBy,
        user: joinReq.user._id,
        members: [joinReq.user._id],
      });
    } else if (joinReq.planType && joinReq.monthlyAmount) {
      // Create a brand new scheme using stored startDate + totalMonths
      const schemeStart = joinReq.startDate ? new Date(joinReq.startDate) : new Date();
      const months = joinReq.totalMonths || 13;
      scheme = await Scheme.create({
        schemeId: finalId,
        monthlyAmount: joinReq.monthlyAmount,
        planType: joinReq.planType,
        description: joinReq.planType === "Type1" ? "Monthly Gold Accumulation (Scheme 1)" : "Final Currency Conversion (Scheme 2)",
        startDate: schemeStart,
        totalMonths: months,
        goldRateAtStart: goldRateDoc.ratePerGram,
        createdBy: req.admin._id,
        members: [joinReq.user._id],
        user: joinReq.user._id,
      });
    }




    // Add scheme to user's schemes list
    if (!joinReq.user.schemes) joinReq.user.schemes = [];
    if (!joinReq.user.schemes.map(s => s.toString()).includes(scheme._id.toString())) {
      joinReq.user.schemes.push(scheme._id);
      await joinReq.user.save();
    }

    // 4. Handle the first month payment (if already paid via Payment Approvals)
    const existingPayment = await Payment.findOne({ joinRequest: joinReq._id, status: "paid", monthNumber: 1 });
    
    if (existingPayment) {
      existingPayment.scheme = scheme._id;
      existingPayment.goldRateOnPaymentDay = goldRateDoc.ratePerGram;
      
      if (scheme.planType === "Type1") {
        const grams = parseFloat((existingPayment.amount / goldRateDoc.ratePerGram).toFixed(4));
        existingPayment.gramsAdded = grams;
        scheme.totalGramsAccumulated = grams;
      } else {
        scheme.totalAmountAccumulated = existingPayment.amount;
      }
      scheme.currentMonth = 1;
      await existingPayment.save();
      await scheme.save();
    }

    // 5. Create pending payment records for the REMAINING months
    const startDate = scheme.startDate || new Date();
    const totalUserMonths = (scheme.totalMonths || 13) - 1; 
    const paymentDocs = [];
    
    // Get the absolute latest payment ID to avoid duplicates
    const lastPayment = await Payment.findOne({}, { paymentId: 1 }).sort({ paymentId: -1 });
    let baseNum = 0;
    if (lastPayment && lastPayment.paymentId) {
      const parsed = parseInt(lastPayment.paymentId.replace("PAY", ""), 10);
      if (!isNaN(parsed)) baseNum = parsed;
    }
    
    // Start from i = 2 if the first month is already paid
    const startFrom = existingPayment ? 2 : 1;

    for (let i = startFrom; i <= totalUserMonths; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));
      
      const currentPayNum = baseNum + (i - (startFrom - 1));
      
      paymentDocs.push({
        paymentId: `PAY${String(currentPayNum).padStart(3, "0")}`,
        scheme:  scheme._id,
        user:    joinReq.user._id,
        monthNumber: i,
        amount:  scheme.monthlyAmount,
        goldRateOnPaymentDay: goldRateDoc.ratePerGram,
        gramsAdded: 0,
        dueDate,
        status: "pending",
      });
    }
    if (paymentDocs.length > 0) {
      await Payment.insertMany(paymentDocs);
    }

    // Update the join request
    joinReq.status        = "approved";
    joinReq.approvedBy    = req.admin._id;
    joinReq.startDate     = startDate;
    joinReq.schemeCreated = scheme._id;
    await joinReq.save();

    res.json({ success: true, message: "Request approved & user added to scheme", data: { joinReq, scheme } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/scheme-join/:id/reject  — admin rejects
const rejectRequest = async (req, res) => {
  try {
    const { note } = req.body;
    const joinReq = await SchemeJoinRequest.findById(req.params.id);
    if (!joinReq)
      return res.status(404).json({ success: false, message: "Request not found" });
    if (joinReq.status !== "pending")
      return res.status(400).json({ success: false, message: "Request already processed" });

    joinReq.status    = "rejected";
    joinReq.adminNote = note || "";
    await joinReq.save();
    res.json({ success: true, message: "Request rejected successfully", data: joinReq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/scheme-join/:id/reopen — admin re-opens a rejected request
const reopenRequest = async (req, res) => {
  try {
    const joinReq = await SchemeJoinRequest.findById(req.params.id);
    if (!joinReq) return res.status(404).json({ success: false, message: "Request not found" });

    // Determine the next logical status
    // If it has proof, go back to awaiting_payment or payment_verified if payment was already verified
    if (joinReq.screenshotUrl || joinReq.utrNumber) {
      const Payment = require("../models/Payment");
      const verifiedPayment = await Payment.findOne({ joinRequest: joinReq._id, status: "paid", monthNumber: 1 });
      joinReq.status = verifiedPayment ? "payment_verified" : "awaiting_payment";
    } else {
      joinReq.status = "pending";
    }

    joinReq.adminNote = "";
    await joinReq.save();

    res.json({ success: true, message: "Request re-opened for review", data: joinReq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/scheme-join/request-type  — user requests a specific type with custom amount + dates + T&C
const createTypeRequest = async (req, res) => {
  try {
    const { planType, monthlyAmount, startDate, endDate, termsAccepted, termsVersion, userNote } = req.body;
    if (!planType || !monthlyAmount)
      return res.status(400).json({ success: false, message: "planType and monthlyAmount are required" });
    if (!startDate || !endDate)
      return res.status(400).json({ success: false, message: "startDate and endDate are required" });
    if (!termsAccepted)
      return res.status(400).json({ success: false, message: "You must accept the terms and conditions" });

    // Calculate totalMonths from the date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    if (diffMonths < 1)
      return res.status(400).json({ success: false, message: "Duration must be at least 1 month" });

    const request = await SchemeJoinRequest.create({
      user: req.user._id,
      planType,
      monthlyAmount: Number(monthlyAmount),
      startDate: start,
      endDate: end,
      totalMonths: diffMonths,
      termsAccepted: true,
      termsVersion: termsVersion || 1,
      userNote: (userNote || "").trim(),
    });
    res.status(201).json({ success: true, message: "Chit request submitted! Now upload your first payment proof.", data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/scheme-join/:id/first-payment — user uploads first month payment proof
const submitFirstPaymentProof = async (req, res) => {
  try {
    const joinReq = await SchemeJoinRequest.findOne({
      _id: req.params.id, user: req.user._id, status: "pending",
    });
    if (!joinReq)
      return res.status(404).json({ success: false, message: "Chit request not found or already processed" });

    const { utrNumber, userNote } = req.body;
    const hasScreenshot = !!req.file;
    const hasUtr = !!(utrNumber && utrNumber.trim());

    if (!hasScreenshot && !hasUtr)
      return res.status(400).json({ success: false, message: "Please provide screenshot or UTR number as payment proof" });

    if (hasScreenshot) {
      joinReq.screenshotUrl = normalizeFileUrl(req.file.path);
    }
    if (hasUtr) joinReq.utrNumber = utrNumber.trim();
    if (userNote) joinReq.userNote = userNote.trim();
    joinReq.status = "awaiting_payment";
    await joinReq.save();

    // ALSO: Create a Payment record so it shows up in "Payment Approvals"
    await Payment.create({
      joinRequest: joinReq._id,
      user:        req.user._id,
      monthNumber: 1,
      amount:      joinReq.monthlyAmount || 0,
      goldRateOnPaymentDay: 0, // Will be set on approval
      gramsAdded:  0,
      dueDate:     new Date(),
      status:      "awaiting_verification",
      screenshotUrl: joinReq.screenshotUrl || "",
      screenshotUploadedAt: new Date(),
      utrNumber:     joinReq.utrNumber || "",
      userNote:      joinReq.userNote || "Enrollment first payment",
    });

    res.json({ success: true, message: "Payment proof submitted! Admin will verify and activate your chit.", data: joinReq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @DELETE /api/scheme-join/:id — user deletes their own request
const deleteRequest = async (req, res) => {
  try {
    const joinReq = await SchemeJoinRequest.findById(req.params.id);
    if (!joinReq) return res.status(404).json({ success: false, message: "Request not found" });

    // Authorization check: user can only delete their own request
    if (joinReq.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this request" });
    }

    // Only allow deletion if not already approved
    if (joinReq.status === "approved") {
      return res.status(400).json({ success: false, message: "Cannot delete an approved request. Scheme is already active." });
    }

    // Remove associated payments that are not yet paid
    const Payment = require("../models/Payment");
    await Payment.deleteMany({ joinRequest: joinReq._id, status: { $ne: "paid" } });

    await joinReq.deleteOne();
    res.json({ success: true, message: "Request cancelled and removed successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { 
  getUserRequests, createRequest, createSchemeRequest, createPlanRequest, createTypeRequest, 
  submitFirstPaymentProof, getAllRequests, approveRequest, rejectRequest, reopenRequest,
  deleteRequest
};
