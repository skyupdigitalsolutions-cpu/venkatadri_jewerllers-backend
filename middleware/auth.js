const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const User  = require("../models/User");

// Protect admin routes
const protectAdmin = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) return res.status(401).json({ success: false, message: "Not authorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = await Admin.findById(decoded.id).select("-password");
    if (!req.admin) return res.status(401).json({ success: false, message: "Admin not found" });
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Token invalid" });
  }
};

// Protect user routes
const protectUser = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) return res.status(401).json({ success: false, message: "Not authorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) return res.status(401).json({ success: false, message: "User not found" });
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Token invalid" });
  }
};

module.exports = { protectAdmin, protectUser };