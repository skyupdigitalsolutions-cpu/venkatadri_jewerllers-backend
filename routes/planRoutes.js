const express = require("express");
const router = express.Router();
const { getPlansByCategory, getPublicPlans, createPlan, updatePlan, deletePlan, getPlanMembers } = require("../controllers/planController");
const { protectAdmin } = require("../middleware/auth");

router.get("/category/:categoryId", protectAdmin, getPlansByCategory);
router.get("/public/:categoryId", getPublicPlans);
router.get("/:id/members", protectAdmin, getPlanMembers);
router.post("/", protectAdmin, createPlan);
router.put("/:id", protectAdmin, updatePlan);
router.delete("/:id", protectAdmin, deletePlan);

module.exports = router;
