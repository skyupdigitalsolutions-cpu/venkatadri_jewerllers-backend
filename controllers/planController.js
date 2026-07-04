const Plan = require("../models/Plan");
const Scheme = require("../models/Scheme");

// @GET /api/categories/:categoryId/plans
const getPlansByCategory = async (req, res) => {
  try {
    const plans = await Plan.find({ 
      schemeCategoryId: req.params.categoryId,
      createdBy: req.admin._id 
    }).sort({ monthlyAmount: 1 });
    
    // Add active user counts to each plan
    const data = await Promise.all(plans.map(async (plan) => {
      const activeUsers = await Scheme.countDocuments({ planId: plan._id, status: "active" });
      return { ...plan.toObject(), activeUsers };
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/plans/public/:categoryId
const getPublicPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ 
      schemeCategoryId: req.params.categoryId,
      status: "active" 
    }).sort({ monthlyAmount: 1 });
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/plans
const createPlan = async (req, res) => {
  try {
    const { schemeCategoryId, name, monthlyAmount, duration, planType, bonusDetails, eligibility } = req.body;
    
    if (!schemeCategoryId || !name || !monthlyAmount) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const plan = await Plan.create({
      schemeCategoryId,
      name,
      monthlyAmount,
      duration: duration || 12,
      planType: planType || "Type1",
      bonusDetails,
      eligibility,
      createdBy: req.admin._id
    });

    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/plans/:id
const updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.admin._id },
      req.body,
      { new: true }
    );
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @DELETE /api/plans/:id
const deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, createdBy: req.admin._id });
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    // Check if there are active subscribers
    const subscriberCount = await Scheme.countDocuments({ planId: plan._id, status: "active" });
    if (subscriberCount > 0) {
      return res.status(400).json({ success: false, message: "Cannot delete plan with active subscribers" });
    }

    await plan.deleteOne();
    res.json({ success: true, message: "Plan deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getPlanMembers = async (req, res) => {
  try {
    const enrollments = await Scheme.find({ 
      planId: req.params.id, 
      createdBy: req.admin._id 
    }).populate("user", "name phone userId userPhoto");
    
    const members = enrollments.map(e => {
      if (!e.user) return null;
      return {
        ...e.user.toObject(),
        schemeId: e.schemeId,
        enrollmentStatus: e.status,
        currentMonth: e.currentMonth,
        startDate: e.startDate
      };
    }).filter(x => x !== null);

    res.json({ success: true, data: members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getPlansByCategory, getPublicPlans, createPlan, updatePlan, deletePlan, getPlanMembers };
