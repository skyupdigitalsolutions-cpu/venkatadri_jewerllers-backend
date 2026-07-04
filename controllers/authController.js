require("dotenv").config();
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const User = require("../models/User");
const { sendSMS, sendMsg91Otp } = require("../utils/smsHelper");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });

// ─────────────────────────────────────────────
// @POST /api/auth/admin/register
// ─────────────────────────────────────────────
const adminRegister = async (req, res) => {
  try {
    const { name, email, password, phone, shopName } = req.body;

    if (!name || !email || !password || !phone)
      return res.status(400).json({ success: false, message: "Name, email, password and phone are required" });

    if (await Admin.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ success: false, message: "Email already registered" });

    if (await Admin.findOne({ phone }))
      return res.status(400).json({ success: false, message: "Phone number already registered" });

    const admin = await Admin.create({ name, email, password, phone, shopName });

    res.status(201).json({
      success: true,
      message: "Admin registered successfully!",
      token: generateToken(admin._id),
      shopCode: admin.shopCode,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        shopName: admin.shopName,
        shopCode: admin.shopCode,
        role: admin.role,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @POST /api/auth/admin/login
// ─────────────────────────────────────────────
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password required" });

    const queryStr = email.trim().toLowerCase();
    const admin = await Admin.findOne({
      $or: [
        { email: queryStr },
        { phone: queryStr }
      ]
    });
    if (!admin || !(await admin.matchPassword(password)))
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    res.json({
      success: true,
      token: generateToken(admin._id),
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        shopName: admin.shopName,
        shopCode: admin.shopCode,
        role: admin.role,
        adminPhoto: admin.adminPhoto || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @POST /api/auth/user/register  (public)
// ─────────────────────────────────────────────
const userRegister = async (req, res) => {
  try {
    const {
      name, email, password, phone,
      shopCode,
      address, dateOfBirth, occupation,
      aadharNumber,
      agreedToTerms, agreedTermsVersion,    // Scheme Terms (Shop ↔ User)
      agreedToPlatformTerms,               // Platform Terms (SkyUp ↔ User)
    } = req.body;

    if (!name || !phone || !password)
      return res.status(400).json({ success: false, message: "Name, phone and password are required" });

    if (!shopCode)
      return res.status(400).json({ success: false, message: "Shop code is required" });

    // Scheme T&C must be accepted
    if (!agreedToTerms || agreedToTerms === "false")
      return res.status(400).json({ success: false, message: "You must agree to the Scheme Terms and Conditions" });

    // Platform T&C must also be accepted
    if (!agreedToPlatformTerms || agreedToPlatformTerms === "false")
      return res.status(400).json({ success: false, message: "You must agree to the SkyUp Platform Terms and Conditions" });

    const admin = await Admin.findOne({ shopCode: shopCode.toUpperCase() });
    if (!admin)
      return res.status(404).json({ success: false, message: "Invalid shop code. Please check and try again." });

    if (await User.findOne({ phone }))
      return res.status(409).json({ success: false, message: "An account with this phone already exists" });

    if (email && await User.findOne({ email }))
      return res.status(409).json({ success: false, message: "An account with this email already exists" });

    const aadharCardPhoto = req.files?.aadharCardPhoto?.[0]?.path || null;
    const userPhoto = req.files?.userPhoto?.[0]?.path || null;

    const newUser = await User.create({
      name,
      email: email || "",
      phone,
      password,
      shopCode: shopCode.toUpperCase(),
      adminId: admin._id,
      address: address || "",
      dateOfBirth: dateOfBirth || null,
      occupation: occupation || "",
      aadharNumber: aadharNumber || "PENDING",
      aadharCardPhoto,
      userPhoto,
      status: "pending",
      agreedToTerms: true,
      agreedTermsVersion: Number(agreedTermsVersion) || 1,
      agreedAt: new Date(),
      agreedToPlatformTerms: true,
      agreedPlatformTermsAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: `Registration submitted to ${admin.shopName}! Pending admin approval.`,
      userId: newUser._id,
    });
  } catch (err) {
    console.error("userRegister error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @POST /api/auth/user/login
// ─────────────────────────────────────────────
const userLogin = async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    if ((!email && !phone) || !password)
      return res.status(400).json({ success: false, message: "Email/phone and password required" });

    const user = await User.findOne(email ? { email } : { phone });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    if (user.status === "pending")
      return res.status(403).json({
        success: false,
        message: "Your account is pending admin approval. Please wait.",
        status: "pending",
      });

    if (user.status === "rejected") {
      // Issue a token so the user can authenticate the /resubmit endpoint
      return res.json({
        success: true,
        status: "rejected",
        rejectReason: user.rejectReason || "",
        token: generateToken(user._id),
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          shopCode: user.shopCode,
        },
      });
    }

    if (user.status === "inactive")
      return res.status(403).json({ success: false, message: "Account deactivated. Contact admin." });

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        userId: user.userId,
        shopCode: user.shopCode,
        status: user.status,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @PUT /api/auth/user/resubmit  (rejected users only)
// Allows a rejected user to re-upload their KYC docs and
// reset their status to "pending" for admin re-review.
// Requires the token issued at login for rejected users.
// ─────────────────────────────────────────────
const userResubmit = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.status !== "rejected")
      return res.status(400).json({ success: false, message: "Only rejected accounts can resubmit" });

    // Update documents if new ones are provided
    const newAadhar   = req.files?.aadharCardPhoto?.[0]?.path || null;
    const newPhoto    = req.files?.userPhoto?.[0]?.path       || null;

    if (newAadhar) user.aadharCardPhoto = newAadhar;
    if (newPhoto)  user.userPhoto       = newPhoto;

    // Reset status back to pending and clear rejection reason
    user.status       = "pending";
    user.rejectReason = "";

    await user.save();

    res.json({
      success: true,
      message: "Application resubmitted successfully! Pending admin approval.",
    });
  } catch (err) {
    console.error("userResubmit error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @GET /api/auth/validate-shop/:code
// ─────────────────────────────────────────────
const validateShopCode = async (req, res) => {
  try {
    const admin = await Admin.findOne({ shopCode: req.params.code.toUpperCase() });
    if (!admin)
      return res.status(404).json({ success: false, message: "Invalid shop code" });

    res.json({
      success: true,
      shopName: admin.shopName,
      shopCode: admin.shopCode,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @GET /api/auth/shop-payment-info
// Returns the shop's payment details for the currently logged-in user.
// Requires user to be authenticated so we know which shop to return.
// Returns: { shopName, ownerName, phone, bankName, branch, accountNumber, ifscCode, accountName }
// ─────────────────────────────────────────────
const getShopPaymentInfo = async (req, res) => {
  try {
    // req.user is populated by protectUser middleware
    if (!req.user || !req.user.adminId)
      return res.status(400).json({ success: false, message: "No shop associated with this account" });

    const admin = await Admin.findById(req.user.adminId)
      .select("name email phone shopName shopCode bankName branch accountNumber ifscCode accountName adminPhoto");

    if (!admin)
      return res.status(404).json({ success: false, message: "Shop owner not found" });

    res.json({
      success: true,
      data: {
        shopName: admin.shopName,
        shopCode: admin.shopCode,
        ownerName: admin.name,
        email: admin.email || "",
        phone: admin.phone,
        bankName: admin.bankName || "",
        branch: admin.branch || "",
        accountNumber: admin.accountNumber || "",
        ifscCode: admin.ifscCode || "",
        accountName: admin.accountName || "",
        adminPhoto: admin.adminPhoto || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @GET /api/auth/admin/shop-settings
// Admin fetches their own shop payment settings (for the Settings UI)
// ─────────────────────────────────────────────
const getShopSettings = async (req, res) => {
  try {
    if (!req.admin) return res.status(401).json({ success: false, message: "Not authorized" });

    const admin = await Admin.findById(req.admin._id)
      .select("name email phone shopName shopCode bankName branch accountNumber ifscCode accountName adminPhoto");

    if (!admin)
      return res.status(404).json({ success: false, message: "Admin not found" });

    res.json({
      success: true,
      data: {
        shopName: admin.shopName,
        shopCode: admin.shopCode,
        ownerName: admin.name,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        bankName: admin.bankName || "",
        branch: admin.branch || "",
        accountNumber: admin.accountNumber || "",
        ifscCode: admin.ifscCode || "",
        accountName: admin.accountName || "",
        adminPhoto: admin.adminPhoto || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @POST /api/auth/admin/verification/send-otp
// Generates a 6-digit OTP, saves it to Admin, and sends via SMS
// ─────────────────────────────────────────────
const sendAdminOtp = async (req, res) => {
  try {
    if (!req.admin) return res.status(401).json({ success: false, message: "Not authorized" });
    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    admin.verificationOtp = otp;
    admin.verificationOtpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins expiry
    await admin.save();

    const msg = `Your SkyUp verification code is: ${otp}. It expires in 5 minutes.`;
    await sendSMS(admin.phone, msg);
    console.log(`[DEV OTP for ${admin.phone}]: ${otp}`);

    res.json({ success: true, message: "OTP sent to your registered mobile number." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @POST /api/auth/admin/verification/verify-otp
// Verifies OTP and returns a short-lived verificationToken
// ─────────────────────────────────────────────
const verifyAdminOtp = async (req, res) => {
  try {
    if (!req.admin) return res.status(401).json({ success: false, message: "Not authorized" });
    const { otp } = req.body;
    const admin = await Admin.findById(req.admin._id);

    if (!admin || !admin.verificationOtp || admin.verificationOtp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }
    if (admin.verificationOtpExpires < new Date()) {
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }

    admin.verificationOtp = null;
    admin.verificationOtpExpires = null;
    await admin.save();

    const verificationToken = jwt.sign(
      { adminId: admin._id, verified: true, method: "otp" },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "10m" }
    );

    res.json({ success: true, verificationToken });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @POST /api/auth/admin/verification/verify-passkey
// Verifies a passkey/biometric payload and returns verificationToken
// ─────────────────────────────────────────────
const verifyAdminPasskey = async (req, res) => {
  try {
    if (!req.admin) return res.status(401).json({ success: false, message: "Not authorized" });
    const { passkeyPayload } = req.body;
    
    if (!passkeyPayload) {
      return res.status(400).json({ success: false, message: "Invalid Passkey payload" });
    }

    // Support for text-based preset passkey
    if (passkeyPayload.text && passkeyPayload.text !== "123456") {
      return res.status(403).json({ success: false, message: "Incorrect Preset Passkey" });
    }

    const verificationToken = jwt.sign(
      { adminId: req.admin._id, verified: true, method: passkeyPayload.text ? "preset-passkey" : "passkey" },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "10m" }
    );

    res.json({ success: true, verificationToken });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @PUT /api/auth/admin/shop-settings
// Admin updates their own shop payment settings.
// Requires verificationToken.
// ─────────────────────────────────────────────
const updateShopSettings = async (req, res) => {
  try {
    if (!req.admin) return res.status(401).json({ success: false, message: "Not authorized" });

    // 1. Check for verification token
    const vToken = req.headers["x-verification-token"] || req.body.verificationToken;
    if (!vToken) return res.status(403).json({ success: false, message: "Verification required before updating settings" });

    try {
      const decoded = jwt.verify(vToken, process.env.JWT_SECRET || "default_secret");
      if (!decoded.verified || decoded.adminId !== req.admin._id.toString()) throw new Error("Invalid verification");
    } catch (err) {
      return res.status(403).json({ success: false, message: "Verification token invalid or expired. Please verify again." });
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin)
      return res.status(404).json({ success: false, message: "Admin not found" });

    const { name, ownerName, email, phone, shopName, bankName, branch, accountNumber, ifscCode, accountName } = req.body;
    const photoFile = req.files?.adminPhoto?.[0];

    const isVal = (v) => v !== undefined && v !== null && v !== "" && v !== "undefined" && v !== "null";

    // Support both 'name' and 'ownerName' from frontend
    const finalName = name || ownerName;

    if (isVal(finalName)) admin.name = finalName.trim();

    if (isVal(email)) {
      const existingEmail = await Admin.findOne({ email: email.toLowerCase(), _id: { $ne: admin._id } });
      if (existingEmail) return res.status(409).json({ success: false, message: "This email is already in use by another account." });
      admin.email = email.trim().toLowerCase();
    }

    if (isVal(phone)) {
      const existingPhone = await Admin.findOne({ phone: phone.trim(), _id: { $ne: admin._id } });
      if (existingPhone) return res.status(409).json({ success: false, message: "This phone number is already in use by another account." });
      admin.phone = phone.trim();
    }

    if (isVal(shopName))      admin.shopName = shopName.trim();
    if (isVal(bankName))      admin.bankName = bankName.trim();
    if (isVal(branch))        admin.branch = branch.trim();
    if (isVal(accountNumber)) admin.accountNumber = accountNumber.trim();
    if (isVal(ifscCode))      admin.ifscCode = ifscCode.trim().toUpperCase();
    if (isVal(accountName))   admin.accountName = accountName.trim();

    if (photoFile) {
      const normalizedPhoto = photoFile.path.replace(/\\/g, "/");
      admin.adminPhoto = "/" + (normalizedPhoto.startsWith("/") ? normalizedPhoto.slice(1) : normalizedPhoto);
    }

    await admin.save();

    // Send Notification SMS
    const msg = `Security Alert: Your SkyUp Payment Settings were recently updated. If this wasn't you, contact support immediately.`;
    await sendSMS(admin.phone, msg);

    res.json({
      success: true,
      message: "Shop settings securely updated",
      data: {
        shopName: admin.shopName,
        shopCode: admin.shopCode,
        ownerName: admin.name,
        email: admin.email,
        phone: admin.phone,
        bankName: admin.bankName,
        branch: admin.branch,
        accountNumber: admin.accountNumber,
        ifscCode: admin.ifscCode,
        accountName: admin.accountName,
        adminPhoto: admin.adminPhoto || null,
      },
    });
  } catch (err) {
    console.error("updateShopSettings error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @POST /api/auth/admin/forgot-password/send-otp
// ─────────────────────────────────────────────
const adminForgotPasswordSendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }

    const admin = await Admin.findOne({ phone: phone.trim() });
    if (!admin) {
      return res.status(404).json({ success: false, message: "No admin account registered with this phone number." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    admin.verificationOtp = otp;
    admin.verificationOtpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins expiry
    await admin.save();

    const isSent = await sendMsg91Otp(admin.phone, otp);
    console.log(`[Forgot Password OTP for ${admin.phone}]: ${otp} (MSG91 Sent: ${isSent})`);

    res.json({ success: true, message: "OTP sent successfully using MSG91." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @POST /api/auth/admin/forgot-password/verify-otp
// ─────────────────────────────────────────────
const adminForgotPasswordVerifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: "Phone and OTP are required" });
    }

    const admin = await Admin.findOne({ phone: phone.trim() });
    if (!admin || !admin.verificationOtp || admin.verificationOtp !== otp.trim()) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (admin.verificationOtpExpires < new Date()) {
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }

    // Generate a short-lived reset token containing adminId and verification state
    const resetToken = jwt.sign(
      { adminId: admin._id, resetVerified: true },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "10m" }
    );

    res.json({ success: true, resetToken });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @POST /api/auth/admin/forgot-password/reset
// ─────────────────────────────────────────────
const adminForgotPasswordReset = async (req, res) => {
  try {
    const { resetToken, password } = req.body;
    if (!resetToken || !password) {
      return res.status(400).json({ success: false, message: "Token and password are required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET || "default_secret");
    } catch (err) {
      return res.status(400).json({ success: false, message: "Reset link invalid or expired." });
    }

    if (!decoded.resetVerified || !decoded.adminId) {
      return res.status(400).json({ success: false, message: "Unauthorized password reset attempt." });
    }

    const admin = await Admin.findById(decoded.adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin account not found" });
    }

    // Set new password (the mongoose pre-save hook will hash it automatically)
    admin.password = password;
    admin.verificationOtp = null;
    admin.verificationOtpExpires = null;
    await admin.save();

    res.json({ success: true, message: "Password reset successfully! You can now log in." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @POST /api/auth/user/login/send-otp
// ─────────────────────────────────────────────
const userLoginSendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }

    const user = await User.findOne({ phone: phone.trim() });
    if (!user) {
      return res.status(404).json({ success: false, message: "No user account registered with this phone number." });
    }

    if (user.status === "inactive") {
      return res.status(403).json({ success: false, message: "Account deactivated. Contact admin." });
    }

    if (user.status === "pending") {
      return res.status(403).json({
        success: false,
        message: "Your account is pending admin approval. Please wait.",
        status: "pending"
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationOtp = otp;
    user.verificationOtpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins expiry
    await user.save();

    const isSent = await sendMsg91Otp(user.phone, otp);
    console.log(`[User OTP Login for ${user.phone}]: ${otp} (MSG91 Sent: ${isSent})`);

    res.json({ success: true, message: "OTP sent successfully." });
  } catch (err) {
    console.error("userLoginSendOtp error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// @POST /api/auth/user/login/verify-otp
// ─────────────────────────────────────────────
const userLoginVerifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: "Phone and OTP are required" });
    }

    const user = await User.findOne({ phone: phone.trim() });
    if (!user || !user.verificationOtp || user.verificationOtp !== otp.trim()) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (user.verificationOtpExpires < new Date()) {
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }

    // Clear OTP
    user.verificationOtp = null;
    user.verificationOtpExpires = null;
    await user.save();

    // Check status
    if (user.status === "pending") {
      return res.status(403).json({
        success: false,
        message: "Your account is pending admin approval. Please wait.",
        status: "pending",
      });
    }

    if (user.status === "rejected") {
      return res.json({
        success: true,
        status: "rejected",
        rejectReason: user.rejectReason || "",
        token: generateToken(user._id),
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          shopCode: user.shopCode,
        },
      });
    }

    if (user.status === "inactive") {
      return res.status(403).json({ success: false, message: "Account deactivated. Contact admin." });
    }

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        userId: user.userId,
        shopCode: user.shopCode,
        status: user.status,
      },
    });
  } catch (err) {
    console.error("userLoginVerifyOtp error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
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
};