const express = require("express");
const router  = express.Router();
const { protectAdmin, protectUser } = require("../middleware/auth");
const {
  getAllSchemes, getPublicSchemes, getSchemeById, getSchemesByUser,
  createScheme, toggleVisibility, addUserToScheme, earlyExit, closeScheme, deleteScheme, directCreateChit, getEnrollmentsByType
} = require("../controllers/schemaController");



// User route — browse visible schemes from their shop
router.get("/public",             protectUser,  getPublicSchemes);

// Admin routes
router.get("/",                   protectAdmin, getAllSchemes);
router.get("/user/:userId",       protectAdmin, getSchemesByUser);
router.get("/type/:planType",     protectAdmin, getEnrollmentsByType);
router.get("/:id",                protectAdmin, getSchemeById);

router.post("/",                   protectAdmin, createScheme);
router.put("/:id/toggle-visibility", protectAdmin, toggleVisibility);
router.post("/direct-create",      protectAdmin, directCreateChit);
router.post("/:id/add-user",      protectAdmin, addUserToScheme);

router.put("/:id/early-exit",     protectAdmin, earlyExit);
router.put("/:id/close",          protectAdmin, closeScheme);
router.delete("/:id",             protectAdmin, deleteScheme);

module.exports = router;