const express = require("express");
const router = express.Router();
const { protectAdmin } = require("../middleware/auth");
const {
  getAllSubCategories,
  getSubCategoriesByCategory,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
} = require("../controllers/schemeSubCategoryController");

router.get("/", protectAdmin, getAllSubCategories);
router.get("/category/:catId", protectAdmin, getSubCategoriesByCategory);
router.post("/", protectAdmin, createSubCategory);
router.put("/:id", protectAdmin, updateSubCategory);
router.delete("/:id", protectAdmin, deleteSubCategory);

module.exports = router;
