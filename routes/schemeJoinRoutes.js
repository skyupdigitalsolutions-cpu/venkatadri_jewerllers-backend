const express = require("express");
const router  = express.Router();
const { protectAdmin, protectUser } = require("../middleware/auth");
const multer  = require("multer");
const path    = require("path");
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload  = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
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
