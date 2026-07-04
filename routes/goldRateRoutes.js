const express = require("express");
const router  = express.Router();
const { getTodayRate, setTodayRate, getRateHistory, getSettings, updateSettings } = require("../controllers/goldRateController");
const { protectAdmin, protectUser } = require("../middleware/auth");

// IMPORTANT: specific routes BEFORE parameterized routes
router.get("/today",      protectAdmin, getTodayRate);
router.get("/history",    protectAdmin, getRateHistory);
router.get("/settings",   protectAdmin, getSettings);
router.put("/settings",   protectAdmin, updateSettings);
router.get("/user/today", protectUser,  getTodayRate);   // user can see today's rate
router.post("/",          protectAdmin, setTodayRate);

module.exports = router;