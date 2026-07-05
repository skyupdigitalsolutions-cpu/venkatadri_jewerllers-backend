const User   = require("../models/User");
const Scheme = require("../models/Scheme");
const Payment = require("../models/Payment");
const ProfileUpdateRequest = require("../models/ProfileUpdateRequest");
const { normalizeFileUrl } = require("../utils/fileUrl");

// @GET /api/users — get all users for this admin's shop
const getAllUsers = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { adminId: req.admin._id };
    if (status) filter.status = status;
    const users = await User.find(filter).select("-password").sort({ createdAt: -1 });

    const populatedUsers = await Promise.all(
      users.map(async (user) => {
        const schemes = await Scheme.find({
          $or: [
            { user: user._id },
            { members: user._id }
          ]
        });
        
        const userObj = user.toObject();
        userObj.schemes = schemes;
        return userObj;
      })
    );

    res.json({ success: true, count: populatedUsers.length, data: populatedUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/users/:id
const getUserById = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, adminId: req.admin._id }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found in your shop" });

    const userId = user._id.toString();
    const schemes = await Scheme.find({
      $or: [
        { user: user._id },
        { user: userId },
        { members: user._id },
        { members: userId }
      ]
    });
    const payments = await Payment.find({
      $or: [
        { user: user._id },
        { user: userId }
      ]
    }).sort({ monthNumber: 1 });

    res.json({ success: true, data: { ...user.toObject(), schemes, payments } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/users — admin creates user directly
const createUser = async (req, res) => {
  try {
    const { name, phone, email, password, aadharNumber, dateOfBirth, occupation, address } = req.body;
    const exists = await User.findOne({ phone });
    if (exists)
      return res.status(400).json({ success: false, message: "Phone already exists" });

    const files = req.files || {};
    const user = await User.create({
      name, phone, email, password,
      aadharNumber: aadharNumber || "PENDING",
      dateOfBirth:  dateOfBirth  || null,
      occupation:   occupation   || "",
      address:      address      || "",
      shopCode:     req.admin.shopCode,
      adminId:      req.admin._id,
      createdBy:    req.admin._id,
      status:       "active",  // admin-created users are immediately active
      aadharCardPhoto: files.aadharCardPhoto?.[0]?.path || null,
      userPhoto:       files.userPhoto?.[0]?.path       || null,
    });
    const result = user.toObject();
    delete result.password;
    res.status(201).json({ success: true, message: "User created successfully", data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/users/:id/approve — admin approves pending user
const approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.adminId.toString() !== req.admin._id.toString())
      return res.status(403).json({ success: false, message: "Not authorized" });

    user.status       = "active";
    user.rejectReason = "";
    await user.save();
    res.json({ success: true, message: "User approved successfully", data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/users/:id/reject — admin rejects pending user
const rejectUser = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: "Rejection reason required" });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.adminId.toString() !== req.admin._id.toString())
      return res.status(403).json({ success: false, message: "Not authorized" });

    user.status       = "rejected";
    user.rejectReason = reason;
    await user.save();
    res.json({ success: true, message: "User rejected", data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/users/:id — update user
const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body,
      { new: true, runValidators: true }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const active = await Scheme.find({ user: user._id, status: "active" });
    if (active.length > 0)
      return res.status(400).json({ success: false, message: "User has active schemes. Close them first." });
    await user.deleteOne();
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/users/me — user's own profile + schemes + payments
const getMyProfile = async (req, res) => {
  try {
    const fs = require('fs');
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(401).json({ success: false, message: "User not found" });

    const uid = req.user._id;
    const uidStr = uid.toString();

    // Robust schemes query
    const schemes = await Scheme.find({
      $or: [
        { user: uid },
        { user: uidStr },
        { members: uid },
        { members: uidStr }
      ]
    }).sort({ createdAt: -1 });

    // Robust payments query
    const payments = await Payment.find({
      $or: [
        { user: uid },
        { user: uidStr }
      ]
    }).populate("scheme", "schemeId monthlyAmount startDate")
      .sort({ createdAt: -1 });

    const userData = user.toObject();
    userData.schemes = schemes;
    userData.payments = payments;

    // Log to a file we can read
    const logPath = './debug_profile.log';
    const logData = `[${new Date().toISOString()}] Profile Fetch:
- User ID: ${uidStr}
- Account Name: ${user.name}
- Schemes Found: ${schemes.length}
- Payments Found: ${payments.length}\n`;
    fs.appendFileSync(logPath, logData);

    res.json({ success: true, data: userData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/users/find-for-chit — find user by ID or phone for direct chit creation
const findUserForChit = async (req, res) => {
  try {
    const { query } = req.query; // can be userId or phone
    if (!query) return res.status(400).json({ success: false, message: "Query is required" });

    const user = await User.findOne({
      $or: [{ userId: query }, { phone: query }],
      adminId: req.admin._id
    }).select("name userId phone shopCode status userPhoto");

    if (!user) return res.status(404).json({ success: false, message: "User not found in your shop" });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/users/profile-update-request — user requests a profile change
const requestProfileUpdate = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const userPhoto = req.file ? normalizeFileUrl(req.file.path) : null;

    if (!name && !phone && !userPhoto) {
      return res.status(400).json({ success: false, message: "No changes requested" });
    }

    const requestedChanges = {};
    if (name) requestedChanges.name = name;
    if (phone) requestedChanges.phone = phone;
    if (userPhoto) {
      requestedChanges.userPhoto = userPhoto;
    }

    // Check if there's already a pending request
    let existingRequest = await ProfileUpdateRequest.findOne({ user: req.user._id, status: "pending" });
    if (existingRequest) {
      // Overwrite the pending request
      existingRequest.requestedChanges = { ...existingRequest.requestedChanges, ...requestedChanges };
      await existingRequest.save();
      return res.json({ success: true, message: "Profile update request updated", data: existingRequest });
    }

    const newRequest = await ProfileUpdateRequest.create({
      user: req.user._id,
      adminId: req.user.adminId,
      requestedChanges,
    });

    res.status(201).json({ success: true, message: "Profile update requested. Pending admin approval.", data: newRequest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/users/profile-requests — admin views all pending profile requests
const getProfileRequests = async (req, res) => {
  try {
    const requests = await ProfileUpdateRequest.find({ adminId: req.admin._id, status: "pending" })
      .populate("user", "name phone userPhoto userId")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/users/profile-requests/:id/approve — admin approves a request
const approveProfileRequest = async (req, res) => {
  try {
    const request = await ProfileUpdateRequest.findById(req.params.id);
    if (!request || request.adminId.toString() !== req.admin._id.toString()) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ success: false, message: "Request already processed" });
    }

    const user = await User.findById(request.user);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Apply changes
    const changes = request.requestedChanges;
    if (changes.name) user.name = changes.name;
    if (changes.phone) user.phone = changes.phone;
    if (changes.userPhoto) user.userPhoto = changes.userPhoto;

    await user.save();

    request.status = "approved";
    await request.save();

    res.json({ success: true, message: "Profile update approved", data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/users/profile-requests/:id/reject — admin rejects a request
const rejectProfileRequest = async (req, res) => {
  try {
    const { reason } = req.body;
    const request = await ProfileUpdateRequest.findById(req.params.id);
    if (!request || request.adminId.toString() !== req.admin._id.toString()) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ success: false, message: "Request already processed" });
    }

    request.status = "rejected";
    request.rejectionReason = reason || "";
    await request.save();

    res.json({ success: true, message: "Profile update rejected", data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { 
  getAllUsers, getUserById, createUser, approveUser, rejectUser, 
  updateUser, deleteUser, getMyProfile, findUserForChit,
  requestProfileUpdate, getProfileRequests, approveProfileRequest, rejectProfileRequest 
};

