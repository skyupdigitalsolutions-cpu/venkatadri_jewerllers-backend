const Payment  = require("../models/Payment");
const Scheme   = require("../models/Scheme");
const User     = require("../models/User");
const GoldRate = require("../models/GoldRate");

// @GET /api/reports/dashboard — main dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    const adminId = req.admin._id;
    const today = new Date().toISOString().split("T")[0];

    const [
      totalUsers,
      activeSchemes,
      totalGoldSaved,
      todayCollection,
      pendingPayments,
    ] = await Promise.all([
      User.countDocuments({ status: "active", adminId }),
      Scheme.countDocuments({ status: "active", createdBy: adminId }),
      Scheme.aggregate([
        { $match: { createdBy: adminId } },
        { $group: { _id: null, total: { $sum: "$totalGramsAccumulated" } } }
      ]),
      Payment.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "userData"
          }
        },
        { $match: { status: "paid", paidDate: { $gte: new Date(today) }, "userData.adminId": adminId } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "userData"
          }
        },
        { $match: { status: { $in: ["pending", "overdue"] }, "userData.adminId": adminId } },
        { $count: "count" }
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        activeSchemes,
        totalGoldSaved:   totalGoldSaved[0]?.total || 0,
        todayCollection:  todayCollection[0]?.total || 0,
        pendingPayments:  pendingPayments[0]?.count || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/reports/monthly?year=2025
const getMonthlyReport = async (req, res) => {
  try {
    const adminId = req.admin._id;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const report = await Payment.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userData"
        }
      },
      {
        $match: {
          status: "paid",
          paidDate: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          },
          "userData.adminId": adminId
        },
      },
      {
        $group: {
          _id:          { $month: "$paidDate" },
          totalAmount:  { $sum: "$amount" },
          totalGrams:   { $sum: "$gramsAdded" },
          paymentCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, year, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/reports/gold-summary — gold accumulated per user
const getGoldSummary = async (req, res) => {
  try {
    const adminId = req.admin._id;
    const schemes = await Scheme.find({ createdBy: adminId })
      .populate("user", "name phone userId")
      .select("user schemeId totalGramsAccumulated ownerPaymentGrams status monthlyAmount currentMonth startDate totalMonths planType");
    res.json({ success: true, data: schemes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getDashboardStats, getMonthlyReport, getGoldSummary };