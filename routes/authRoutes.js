require("dotenv").config();
const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { protectUser, protectAdmin } = require("../middleware/auth");
const {
  adminLogin, adminRegister,
  userLogin, userRegister, userResubmit,
  userLoginSendOtp, userLoginVerifyOtp,
  validateShopCode,
  getShopPaymentInfo,
  getShopSettings, updateShopSettings,
  sendAdminOtp, verifyAdminOtp, verifyAdminPasskey,
  adminForgotPasswordSendOtp,
  adminForgotPasswordVerifyOtp,
  adminForgotPasswordReset
} = require("../controllers/authController");

router.post("/admin/login", adminLogin);
router.post("/admin/forgot-password/send-otp", adminForgotPasswordSendOtp);
router.post("/admin/forgot-password/verify-otp", adminForgotPasswordVerifyOtp);
router.post("/admin/forgot-password/reset", adminForgotPasswordReset);
router.post("/admin/register", adminRegister);
router.post("/user/login", userLogin);
router.post("/user/login/send-otp", userLoginSendOtp);
router.post("/user/login/verify-otp", userLoginVerifyOtp);
router.get("/validate-shop/:code", validateShopCode);

// Logged-in user fetches their shop's payment info (QR, phone, owner name)
router.get("/shop-payment-info", protectUser, getShopPaymentInfo);

// Admin fetches / updates their own shop payment settings
router.get("/admin/shop-settings", protectAdmin, getShopSettings);
router.put(
  "/admin/shop-settings",
  protectAdmin,
  upload.fields([
    { name: "qrCode", maxCount: 1 },
    { name: "adminPhoto", maxCount: 1 }
  ]),
  updateShopSettings
);

// Admin Security Verification Routes
router.post("/admin/verification/send-otp", protectAdmin, sendAdminOtp);
router.post("/admin/verification/verify-otp", protectAdmin, verifyAdminOtp);
router.post("/admin/verification/verify-passkey", protectAdmin, verifyAdminPasskey);

// User register with file uploads
router.post(
  "/user/register",
  upload.fields([
    { name: "aadharCardPhoto", maxCount: 1 },
    { name: "userPhoto", maxCount: 1 },
  ]),
  userRegister
);

// Rejected user resubmits with updated docs
router.put(
  "/user/resubmit",
  protectUser,
  upload.fields([
    { name: "aadharCardPhoto", maxCount: 1 },
    { name: "userPhoto", maxCount: 1 },
  ]),
  userResubmit
);

module.exports = router;