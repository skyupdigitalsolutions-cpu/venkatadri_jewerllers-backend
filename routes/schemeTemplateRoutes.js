const express = require("express");
const router  = express.Router();
const { protectAdmin, protectUser } = require("../middleware/auth");
const {
  getPublicTemplates, getAllTemplates,
  createTemplate, updateTemplate, toggleTemplate, deleteTemplate,
} = require("../controllers/schemeTemplateController");

// User route — see active plans
router.get("/public", protectUser, getPublicTemplates);

// Admin routes
router.get("/",              protectAdmin, getAllTemplates);
router.post("/",             protectAdmin, createTemplate);
router.put("/:id",           protectAdmin, updateTemplate);
router.put("/:id/toggle",    protectAdmin, toggleTemplate);
router.delete("/:id",        protectAdmin, deleteTemplate);

module.exports = router;
