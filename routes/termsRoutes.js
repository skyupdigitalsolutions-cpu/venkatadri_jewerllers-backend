const express = require("express");
const router = express.Router();
const { protectAdmin, protectUser } = require("../middleware/auth");
const {
    getTermsByShopCode, getPlatformTerms, getMyTerms,
    getTermsByType, updateTerms, updateTermsByType,
    getTermsHistory, recordAgreement, getSchemeTermsForUser,
} = require("../controllers/termsController");

// PUBLIC — for admin signup (no shopCode yet)
router.get("/platform", getPlatformTerms);

// PUBLIC — for user registration page
router.get("/shop/:shopCode", getTermsByShopCode);

// USER
router.post("/agree", protectUser, recordAgreement);
router.get("/user/scheme/:planType", protectUser, getSchemeTermsForUser);


// ADMIN
router.get("/", protectAdmin, getMyTerms);
router.get("/type/:planType", protectAdmin, getTermsByType);
router.get("/history", protectAdmin, getTermsHistory);
router.put("/", protectAdmin, updateTerms);
router.put("/type/:planType", protectAdmin, updateTermsByType);

module.exports = router;