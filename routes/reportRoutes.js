// routes/reportRoutes.js
const express = require("express");
const router  = express.Router();
const { protectAdmin } = require("../middleware/auth");
const { getDashboardStats, getMonthlyReport, getGoldSummary } = require("../controllers/reportController");

router.get("/dashboard",    protectAdmin, getDashboardStats);
router.get("/monthly",      protectAdmin, getMonthlyReport);
router.get("/gold-summary", protectAdmin, getGoldSummary);

module.exports = router;