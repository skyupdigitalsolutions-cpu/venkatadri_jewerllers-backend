const express = require("express");
const router = express.Router();
const {
  getAllUsers, getUserById, createUser,
  approveUser, rejectUser,
  updateUser, deleteUser, getMyProfile, findUserForChit,
  requestProfileUpdate, getProfileRequests, approveProfileRequest, rejectProfileRequest
} = require("../controllers/userController");
const { protectAdmin, protectUser } = require("../middleware/auth");
const upload = require("../middleware/upload");

// ─────────────────────────────────────────────────────────────────────────────
// ⚠ IMPORTANT: /me MUST be declared BEFORE /:id
// Express matches routes in order. If /:id comes first, "/me" is matched as
// a param and the wrong controller runs, which causes auth errors or 404s.
// ─────────────────────────────────────────────────────────────────────────────

// User self-access
router.get("/me", protectUser, getMyProfile);
router.post(
  "/profile-update-request",
  protectUser,
  upload.single("userPhoto"),
  requestProfileUpdate
);

// Admin — list / read
router.get("/profile-requests", protectAdmin, getProfileRequests);
router.get("/find-for-chit", protectAdmin, findUserForChit);
router.get("/", protectAdmin, getAllUsers);        // supports ?status=pending
router.get("/:id", protectAdmin, getUserById);


// Admin — create user with file uploads
router.post(
  "/",
  protectAdmin,
  upload.fields([
    { name: "aadharCardPhoto", maxCount: 1 },
    { name: "userPhoto", maxCount: 1 },
  ]),
  createUser
);

// Admin — update / delete / approve / reject
router.put("/profile-requests/:id/approve", protectAdmin, approveProfileRequest);
router.put("/profile-requests/:id/reject", protectAdmin, rejectProfileRequest);

router.put("/:id", protectAdmin, updateUser);
router.delete("/:id", protectAdmin, deleteUser);
router.put("/:id/approve", protectAdmin, approveUser);
router.put("/:id/reject", protectAdmin, rejectUser);

module.exports = router;