const express = require("express");
const router = express.Router();
const { getAllCategories, getPublicCategories, createCategory, updateCategory, deleteCategory } = require("../controllers/schemeCategoryController");
const { protectAdmin } = require("../middleware/auth");
const upload = require("../middleware/upload"); 

router.get("/", protectAdmin, getAllCategories);
router.get("/public", getPublicCategories);
router.post("/", protectAdmin, upload.single("image"), createCategory);
router.put("/:id", protectAdmin, updateCategory);
router.delete("/:id", protectAdmin, deleteCategory);

module.exports = router;
