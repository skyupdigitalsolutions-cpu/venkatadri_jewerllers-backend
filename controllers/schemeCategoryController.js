const SchemeCategory = require("../models/SchemeCategory");
const Plan = require("../models/Plan");

// @GET /api/categories
const getAllCategories = async (req, res) => {
  try {
    const categories = await SchemeCategory.find({ createdBy: req.admin._id }).sort({ createdAt: -1 });
    
    // Add plan counts to each category
    const data = await Promise.all(categories.map(async (cat) => {
      const planCount = await Plan.countDocuments({ schemeCategoryId: cat._id });
      return { ...cat.toObject(), planCount };
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/categories/public
const getPublicCategories = async (req, res) => {
  try {
    const categories = await SchemeCategory.find({ isVisible: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/categories
const createCategory = async (req, res) => {
  try {
    const { name, description, planType, termsAndConditions } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Name is required" });

    const category = await SchemeCategory.create({
      name,
      description,
      planType: planType || "Type1",
      termsAndConditions,
      createdBy: req.admin._id,
      image: req.file ? req.file.path : ""
    });

    res.status(201).json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @PUT /api/categories/:id
const updateCategory = async (req, res) => {
  try {
    const category = await SchemeCategory.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.admin._id },
      req.body,
      { new: true }
    );
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });
    res.json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @DELETE /api/categories/:id
const deleteCategory = async (req, res) => {
  try {
    const category = await SchemeCategory.findOne({ _id: req.params.id, createdBy: req.admin._id });
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    // Check if there are plans inside
    const planCount = await Plan.countDocuments({ schemeCategoryId: category._id });
    if (planCount > 0) {
      return res.status(400).json({ success: false, message: "Cannot delete category with active plans" });
    }

    await category.deleteOne();
    res.json({ success: true, message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllCategories, getPublicCategories, createCategory, updateCategory, deleteCategory };
