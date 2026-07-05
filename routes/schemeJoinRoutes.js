const express = require("express");
const router  = express.Router();
const { protectAdmin, protectUser } = require("../middleware/auth");
const upload = require("../middleware/upload");
const {
  getUserRequests, createRequest, createSchemeRequest, createPlanRequest, createTypeRequest, submitFirstPaymentProof,
  getAllRequests, approveRequest, rejectRequest, reopenRequest, deleteRequest
} = require("../controllers/schemeJoinController");

// User routes
router.get("/my",               protectUser, getUserRequests);
router.post("/request",         protectUser, createRequest);
router.post("/request-scheme",  protectUser, createSchemeRequest);
router.post("/request-plan",    protectUser, createPlanRequest);
router.post("/request-type",    protectUser, createTypeRequest);
router.post("/:id/first-payment", protectUser, upload.single("screenshot"), submitFirstPaymentProof);
router.delete("/:id",          protectUser, deleteRequest);

// Admin routes
router.get("/",               protectAdmin, getAllRequests);
router.put("/:id/approve",    protectAdmin, approveRequest);
router.put("/:id/reject",     protectAdmin, rejectRequest);
router.put("/:id/reopen",     protectAdmin, reopenRequest);

module.exports = router;
