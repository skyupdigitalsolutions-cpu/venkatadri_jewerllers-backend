const SchemeSubCategory = require("../models/SchemeSubCategory");
const Plan = require("../models/Plan");

// @GET /api/scheme-subcategories
const getAllSubCategories = async (req, res) => {
  try {
    const subs = await SchemeSubCategory.find()
      .populate("schemeCategoryId", "name")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: subs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/scheme-subcategories/category/:catId
const getSubCategoriesByCategory = async (req, res) => {
  try {
    const subs = await SchemeSubCategory.find({ schemeCategoryId: req.params.catId })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: subs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/scheme-subcategories
const createSubCategory = async (req, res) => {
  try {
    const { name, description, schemeCategoryId, planType } = req.body;
    if (!name || !schemeCategoryId) {
      return res.status(400).json({ success: false, message: "Name and Category ID are required" });
    }

    const sub = await SchemeSubCategory.create({
      name,
      description,
      schemeCategoryId,
      planType,
      createdBy: req.admin._id,
    });

    res.status(201).json({ success: true, data: sub });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/scheme-subcategories/:id
const updateSubCategory = async (req, res) => {
  try {
    const sub = await SchemeSubCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!sub) return res.status(404).json({ success: false, message: "Scheme not found" });
    res.json({ success: true, data: sub });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @DELETE /api/scheme-subcategories/:id
const deleteSubCategory = async (req, res) => {
  try {
    // Check if there are plans inside
    const planCount = await Plan.countDocuments({ schemeSubCategoryId: req.params.id });
    if (planCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot delete scheme because it contains active chits. Please delete the chits first." 
      });
    }

    const sub = await SchemeSubCategory.findByIdAndDelete(req.params.id);
    if (!sub) return res.status(404).json({ success: false, message: "Scheme not found" });
    res.json({ success: true, message: "Scheme deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllSubCategories,
  getSubCategoriesByCategory,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
};
