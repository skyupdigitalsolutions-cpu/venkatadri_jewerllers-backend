const mongoose = require("mongoose");
const Scheme   = require("../models/Scheme");
const Payment  = require("../models/Payment");
const GoldRate = require("../models/GoldRate");
const User     = require("../models/User");

// @GET /api/schemes  — admin sees all their schemes
const getAllSchemes = async (req, res) => {
  try {
    // Admin sees "Master" schemes (templates) in the Schemes list, not individual enrollments
    const schemes = await Scheme.find({ createdBy: req.admin._id, user: null })
      .populate("user",    "name phone userId")
      .populate("members", "name phone userId")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: schemes.length, data: schemes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/schemes/public  — user sees visible schemes from their admin's shop
const getPublicSchemes = async (req, res) => {
  try {
    const schemes = await Scheme.find({ createdBy: req.user.adminId, isVisible: true })
      .select("schemeId monthlyAmount description startDate goldRateAtStart isVisible members createdAt")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: schemes.length, data: schemes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/schemes/:id
const getSchemeById = async (req, res) => {
  try {
    const scheme = await Scheme.findById(req.params.id)
      .populate("user",    "name phone userId")
      .populate("members", "name phone userId");
    if (!scheme) return res.status(404).json({ success: false, message: "Scheme not found" });

    const payments = await Payment.find({ scheme: scheme._id }).sort({ monthNumber: 1 });
    res.json({ success: true, data: { ...scheme.toObject(), payments } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/schemes/user/:userId  — schemes for a specific user
const getSchemesByUser = async (req, res) => {
  try {
    const schemes = await Scheme.find({
      $or: [
        { user: req.params.userId },
        { members: req.params.userId }
      ]
    }).populate("user", "name phone userId")
      .populate("members", "name phone userId");
    res.json({ success: true, data: schemes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/schemes  — admin creates a scheme (NO user required at creation)
const createScheme = async (req, res) => {
  try {
    const { monthlyAmount, startDate, description } = req.body;

    if (!monthlyAmount || monthlyAmount < 6000)
      return res.status(400).json({ success: false, message: "Minimum monthly amount is ₹6,000" });

    // Get the latest available gold rate
    const goldRateDoc = await GoldRate.findOne().sort({ date: -1 });
    if (!goldRateDoc)
      return res.status(400).json({ success: false, message: "Please update the gold rate first" });

    const start = new Date(startDate || Date.now());
    const scheme = await Scheme.create({
      monthlyAmount,
      description: description || "",
      startDate: start,
      dueDay: start.getDate(),
      goldRateAtStart: goldRateDoc.ratePerGram,
      isVisible: true,
      createdBy: req.admin._id,
    });

    res.status(201).json({
      success: true,
      message: "Scheme created successfully",
      data: scheme,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/schemes/:id/toggle-visibility  — admin shows/hides scheme from users
const toggleVisibility = async (req, res) => {
  try {
    const scheme = await Scheme.findOne({ _id: req.params.id, createdBy: req.admin._id });
    if (!scheme) return res.status(404).json({ success: false, message: "Scheme not found" });
    scheme.isVisible = !scheme.isVisible;
    await scheme.save();
    res.json({ success: true, message: `Scheme is now ${scheme.isVisible ? "visible" : "hidden"} to users`, data: scheme });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/schemes/:id/add-user  — admin directly adds an approved user to a scheme
const addUserToScheme = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });

    const template = await Scheme.findOne({ _id: req.params.id, createdBy: req.admin._id });
    if (!template) return res.status(404).json({ success: false, message: "Scheme template not found" });

    const user = await User.findOne({ _id: userId, adminId: req.admin._id, status: "active" });
    if (!user) return res.status(404).json({ success: false, message: "Active user not found under your shop" });

    // Check if user already has a private enrollment of this template
    // We can check by template ID or schemeId prefix
    const existing = await Scheme.findOne({ user: userId, monthlyAmount: template.monthlyAmount, status: "active" });
    if (existing) {
      return res.status(400).json({ success: false, message: "User is already enrolled in a similar plan" });
    }

    // Get the latest available gold rate
    const goldRateDoc = await GoldRate.findOne().sort({ date: -1 });
    if (!goldRateDoc)
      return res.status(400).json({ success: false, message: "Please update the gold rate first" });

    // IMPORTANT: Create a UNIQUE scheme document for this specific user
    // This prevents payment data and currentMonth from syncing between different users
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const privateScheme = await Scheme.create({
      schemeId: `${template.schemeId}-${user.userId || userId.slice(-4)}`, 
      monthlyAmount: template.monthlyAmount,
      description: template.description || `Personal ${template.schemeId}`,
      startDate: new Date(),
      dueDay: new Date().getDate(),
      goldRateAtStart: goldRateDoc.ratePerGram,
      isVisible: false, // Individual enrollments shouldn't be listed in public gallery
      createdBy: req.admin._id,
      user: userObjectId, // Private owner
      members: [userObjectId],
    });

    // Add private scheme to user's schemes list
    if (!user.schemes) user.schemes = [];
    user.schemes.push(privateScheme._id);
    await user.save();

    // Get the absolute latest payment ID to avoid duplicates
    const lastPayment = await Payment.findOne({}, { paymentId: 1 }).sort({ paymentId: -1 });
    let baseNum = 0;
    if (lastPayment && lastPayment.paymentId) {
      const parsed = parseInt(lastPayment.paymentId.replace("PAY", ""), 10);
      if (!isNaN(parsed)) baseNum = parsed;
    }

    const startDate = new Date();
    const paymentDocs = [];
    for (let i = 1; i <= 12; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));
      paymentDocs.push({
        paymentId:   `PAY${String(baseNum + i).padStart(3, "0")}`,
        scheme:      privateScheme._id,
        user:        userObjectId,
        monthNumber: i,
        amount:      privateScheme.monthlyAmount,
        goldRateOnPaymentDay: goldRateDoc.ratePerGram,
        gramsAdded: 0,
        dueDate,
        status: "pending",
      });
    }
    await Payment.insertMany(paymentDocs);

    res.json({ success: true, message: `${user.name} enrolled in private instance of ${template.schemeId}`, data: privateScheme });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// @PUT /api/schemes/:id/early-exit
const earlyExit = async (req, res) => {
  try {
    const scheme = await Scheme.findById(req.params.id);
    if (!scheme) return res.status(404).json({ success: false, message: "Scheme not found" });
    if (scheme.status !== "active")
      return res.status(400).json({ success: false, message: "Scheme is not active" });
    scheme.status       = "early_exit";
    scheme.earlyExitDate = new Date();
    await scheme.save();
    res.json({ success: true, message: `Early exit processed.`, data: scheme });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/schemes/:id/close
const closeScheme = async (req, res) => {
  try {
    const scheme = await Scheme.findById(req.params.id);
    if (!scheme) return res.status(404).json({ success: false, message: "Scheme not found" });
    if (scheme.status !== "active")
      return res.status(400).json({ success: false, message: "Scheme is not active" });
    scheme.status       = "complete";
    scheme.completionDate = new Date();
    await scheme.save();
    res.json({ success: true, message: `Scheme successfully settled and closed.`, data: scheme });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// @DELETE /api/schemes/:id  — admin deletes a scheme (only if no active members)
const deleteScheme = async (req, res) => {
  try {
    const scheme = await Scheme.findOne({ _id: req.params.id, createdBy: req.admin._id });
    if (!scheme) return res.status(404).json({ success: false, message: "Scheme not found" });

    if (scheme.members && scheme.members.length > 0)
      return res.status(400).json({ success: false, message: "Cannot delete a scheme with active members. Remove members first or mark as early exit." });

    // Delete all related pending payments too
    await Payment.deleteMany({ scheme: scheme._id, status: "pending" });
    await scheme.deleteOne();

    res.json({ success: true, message: "Scheme deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/schemes/type/:planType — admin sees enrollments of a specific type
const getEnrollmentsByType = async (req, res) => {
  try {
    const { planType } = req.params;
    const schemes = await Scheme.find({
      createdBy: req.admin._id,
      planType: planType,
      user: { $ne: null } // Only real enrollments
    }).populate("user", "name phone userId userPhoto")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: schemes.length, data: schemes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/schemes/direct-create — admin directly creates a chit for a user
const directCreateChit = async (req, res) => {
  try {
    const { userId, phone, monthlyAmount, planType, startDate, duration } = req.body;

    if (!monthlyAmount || monthlyAmount < 1)
      return res.status(400).json({ success: false, message: "Monthly amount is required" });

    // Find user by userId or phone
    const user = await User.findOne({
      $or: [{ userId: userId }, { phone: phone }],
      adminId: req.admin._id,
      status: "active"
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Active user not found in your shop. Please verify User ID or Phone." });
    }

    // Get the latest available gold rate
    const goldRateDoc = await GoldRate.findOne().sort({ date: -1 });
    if (!goldRateDoc)
      return res.status(400).json({ success: false, message: "Please update the gold rate first" });

    const start = new Date(startDate || Date.now());
    const dur = parseInt(duration) || 12;

    // Logic for unique schemeId: CH + userId digits + last 4 digits of phone
    const userDigits = (user.userId || "").replace(/\D/g, ""); // extract numeric part e.g. USR001 → 001
    const baseId = `CH${userDigits}${user.phone.slice(-4)}`;
    let finalId = baseId;
    let exists = await Scheme.findOne({ schemeId: finalId });
    let counter = 2;
    while (exists) {
      finalId = `${baseId}-${counter}`;
      exists = await Scheme.findOne({ schemeId: finalId });
      counter++;
    }

    const scheme = await Scheme.create({
      schemeId: finalId,
      monthlyAmount,
      description: planType === "Type2" ? "Final Amount Conversion" : "Monthly Gold Accumulation",
      planType: planType || "Type1",
      startDate: start,
      dueDay: start.getDate(),
      totalMonths: dur + 1, // User pays 'dur' months, +1 is bonus
      goldRateAtStart: goldRateDoc.ratePerGram,
      isVisible: false,
      createdBy: req.admin._id,
      user: user._id,
      members: [user._id],
    });

    // Add scheme to user's schemes list
    if (!user.schemes) user.schemes = [];
    user.schemes.push(scheme._id);
    await user.save();

    // Create payment records
    const paymentDocs = [];
    
    // Get the absolute latest payment ID to avoid duplicates
    const lastPaymentForDirect = await Payment.findOne({}, { paymentId: 1 }).sort({ paymentId: -1 });
    let baseNumDirect = 0;
    if (lastPaymentForDirect && lastPaymentForDirect.paymentId) {
      const parsed = parseInt(lastPaymentForDirect.paymentId.replace("PAY", ""), 10);
      if (!isNaN(parsed)) baseNumDirect = parsed;
    }

    for (let i = 1; i <= dur; i++) {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));
      paymentDocs.push({
        paymentId: `PAY${String(baseNumDirect + i).padStart(3, "0")}`,
        scheme: scheme._id,
        user: user._id,
        monthNumber: i,
        amount: monthlyAmount,
        goldRateOnPaymentDay: goldRateDoc.ratePerGram,
        gramsAdded: 0,
        dueDate,
        status: "pending",
      });
    }
    await Payment.insertMany(paymentDocs);

    res.status(201).json({
      success: true,
      message: "Chit created successfully for " + user.name,
      data: scheme,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllSchemes, getPublicSchemes, getSchemeById, getSchemesByUser, createScheme, toggleVisibility, addUserToScheme, earlyExit, closeScheme, deleteScheme, directCreateChit, getEnrollmentsByType };