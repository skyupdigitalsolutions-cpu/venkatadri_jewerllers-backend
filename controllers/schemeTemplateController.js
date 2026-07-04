const SchemeTemplate = require("../models/SchemeTemplate");

// @GET /api/scheme-templates/public  — user can see active templates for their admin's shop
const getPublicTemplates = async (req, res) => {
  try {
    // req.user.adminId is set by protectUser middleware
    const templates = await SchemeTemplate.find({
      createdBy: req.user.adminId,
      isActive:  true,
    }).sort({ createdAt: -1 });
    res.json({ success: true, count: templates.length, data: templates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/scheme-templates  — admin sees all their templates
const getAllTemplates = async (req, res) => {
  try {
    const templates = await SchemeTemplate.find({ createdBy: req.admin._id })
      .sort({ createdAt: -1 });
    res.json({ success: true, count: templates.length, data: templates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/scheme-templates  — admin creates a template
const createTemplate = async (req, res) => {
  try {
    const { name, description, monthlyAmount } = req.body;
    if (!name || !monthlyAmount)
      return res.status(400).json({ success: false, message: "Name and monthly amount are required" });
    if (monthlyAmount < 6000)
      return res.status(400).json({ success: false, message: "Minimum monthly amount is ₹6,000" });

    const template = await SchemeTemplate.create({
      name,
      description: description || "",
      monthlyAmount,
      createdBy: req.admin._id,
    });
    res.status(201).json({ success: true, message: "Scheme plan created", data: template });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/scheme-templates/:id  — admin updates a template
const updateTemplate = async (req, res) => {
  try {
    const template = await SchemeTemplate.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.admin._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!template)
      return res.status(404).json({ success: false, message: "Template not found" });
    res.json({ success: true, data: template });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/scheme-templates/:id/toggle  — admin toggles isActive
const toggleTemplate = async (req, res) => {
  try {
    const template = await SchemeTemplate.findOne({ _id: req.params.id, createdBy: req.admin._id });
    if (!template)
      return res.status(404).json({ success: false, message: "Template not found" });
    template.isActive = !template.isActive;
    await template.save();
    res.json({ success: true, message: `Plan ${template.isActive ? "activated" : "deactivated"}`, data: template });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @DELETE /api/scheme-templates/:id  — admin deletes a template
const deleteTemplate = async (req, res) => {
  try {
    const template = await SchemeTemplate.findOneAndDelete({ _id: req.params.id, createdBy: req.admin._id });
    if (!template)
      return res.status(404).json({ success: false, message: "Template not found" });
    res.json({ success: true, message: "Scheme plan deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getPublicTemplates, getAllTemplates, createTemplate, updateTemplate, toggleTemplate, deleteTemplate };
