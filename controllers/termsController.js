const Terms = require("../models/TermsAndConditions");
const Admin = require("../models/Admin");
const User = require("../models/User");
const { DEFAULT_TERMS }    = require("../data/defaultTerms");
const { PLATFORM_TERMS }   = require("../data/platformTerms");
const jwt = require("jsonwebtoken");
const { sendSMS } = require("../utils/smsHelper");


// Helper: lazy-create default T&C if shop has none
async function ensureTerms(admin, planType = null) {
    let query = { adminId: admin._id, isActive: true, planType };
    let active = await Terms.findOne(query);
    if (active) return active;

    let seeded = DEFAULT_TERMS;
    let title = "Terms and Conditions";

    if (planType === "Type1") {
        title = "Scheme 1 — Terms and Conditions";
        seeded = `SCHEME 1 (MONTHLY GOLD ACCUMULATION) TERMS\n\n1. This scheme allows monthly accumulation of gold grams based on current market rates...\n\n(Default content for Scheme 1)`;
    } else if (planType === "Type2") {
        title = "Scheme 2 — Terms and Conditions";
        seeded = `SCHEME 2 (FINAL AMOUNT CONVERSION) TERMS\n\n1. This scheme converts the total paid amount into gold at the end of the duration...\n\n(Default content for Scheme 2)`;
    } else {
        seeded = seeded
            .replace(/{{SHOP_NAME}}/g, admin.shopName || "the Shop")
            .replace(/{{SHOP_CITY}}/g, "your city")
            .replace(/{{SHOP_PHONE}}/g, admin.phone || "")
            .replace(/{{LAST_UPDATED}}/g, new Date().toLocaleDateString("en-IN"));
    }

    active = await Terms.create({
        adminId: admin._id,
        shopCode: admin.shopCode,
        version: 1,
        title,
        content: seeded,
        updatedBy: admin._id,
        planType,
    });
    return active;
}

// ─────────────────────────────────────────────────────────────────────
// @GET /api/terms/shop/:shopCode  (PUBLIC — used during user registration)
// Returns the active T&C for a given shop so the user can read it before
// signing up. No auth required.
// ─────────────────────────────────────────────────────────────────────
const getTermsByShopCode = async (req, res) => {
    try {
        const admin = await Admin.findOne({ shopCode: req.params.shopCode.toUpperCase() });
        if (!admin) return res.status(404).json({ success: false, message: "Shop not found" });

        const terms = await ensureTerms(admin);
        res.json({
            success: true,
            data: {
                version: terms.version,
                title: terms.title,
                content: terms.content,
                effectiveFrom: terms.effectiveFrom,
                shopName: admin.shopName,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────
// @GET /api/terms/platform  (PUBLIC — fixed SkyUp Platform Terms.
// This content is HARDCODED and cannot be edited by shop admins.
// Served during user signup for the SkyUp ↔ User agreement.)
// ─────────────────────────────────────────────────────────────────────
const getPlatformTerms = async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                version: 1,
                title: "SkyUp Platform — Terms and Conditions",
                content: PLATFORM_TERMS,
                shopName: "SkyUp Digital Solutions",
                effectiveFrom: new Date("2025-05-06"),
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────
// @GET /api/terms  (admin — get current active T&C for their shop)
// ─────────────────────────────────────────────────────────────────────
const getMyTerms = async (req, res) => {
    try {
        const terms = await ensureTerms(req.admin, null);
        res.json({ success: true, data: terms });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @GET /api/terms/type/:planType (admin)
const getTermsByType = async (req, res) => {
    try {
        const { planType } = req.params;
        const terms = await ensureTerms(req.admin, planType);
        res.json({ success: true, data: terms });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────
// @PUT /api/terms  (admin, OTP-gated — update T&C, increments version)
// ─────────────────────────────────────────────────────────────────────
const updateTerms = async (req, res) => {
    await performUpdate(req, res, null);
};

// @PUT /api/terms/type/:planType (admin)
const updateTermsByType = async (req, res) => {
    await performUpdate(req, res, req.params.planType);
};

// Generic update logic
async function performUpdate(req, res, planType) {
    try {
        const { content, title, verificationToken } = req.body;
        
        const vToken = req.headers["x-verification-token"] || verificationToken;
        if (!vToken) return res.status(403).json({ success: false, message: "Verification required" });

        try {
            const decoded = jwt.verify(vToken, process.env.JWT_SECRET || "default_secret");
            if (!decoded.verified || decoded.adminId !== req.admin._id.toString()) throw new Error("Invalid verification");
        } catch (err) {
            return res.status(403).json({ success: false, message: "Verification token invalid or expired." });
        }

        if (!content || !content.trim())
            return res.status(400).json({ success: false, message: "Content is required" });

        const current = await Terms.findOne({ adminId: req.admin._id, isActive: true, planType });
        const nextVersion = current ? current.version + 1 : 1;

        if (current) {
            current.isActive = false;
            await current.save();
        }

        const fresh = await Terms.create({
            adminId: req.admin._id,
            shopCode: req.admin.shopCode,
            version: nextVersion,
            title: title || (planType ? `${planType} Terms` : "Terms and Conditions"),
            content: content.trim(),
            updatedBy: req.admin._id,
            effectiveFrom: new Date(),
            isActive: true,
            planType
        });

        const admin = await Admin.findById(req.admin._id);
        if (admin) {
            const msg = `Security Alert: Your SkyUp T&C (${planType || 'General'}) updated to v${fresh.version}.`;
            await sendSMS(admin.phone, msg);
        }

        res.json({ success: true, message: "Terms updated.", data: fresh });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────
// @GET /api/terms/history  (admin — full version history)
// ─────────────────────────────────────────────────────────────────────
const getTermsHistory = async (req, res) => {
    try {
        const list = await Terms.find({ adminId: req.admin._id })
            .sort({ version: -1 })
            .select("version title effectiveFrom isActive createdAt updatedBy");
        res.json({ success: true, count: list.length, data: list });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────
// @POST /api/terms/agree  (logged-in user)
// Body: { version }
// Records that the user agreed to a specific T&C version.
// ─────────────────────────────────────────────────────────────────────
const recordAgreement = async (req, res) => {
    try {
        const { version } = req.body;
        if (!version) return res.status(400).json({ success: false, message: "version required" });

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.agreedToTerms = true;
        user.agreedTermsVersion = version;
        user.agreedAt = new Date();
        await user.save();

        res.json({
            success: true,
            message: "Agreement recorded",
            data: {
                agreedToTerms: user.agreedToTerms,
                agreedTermsVersion: user.agreedTermsVersion,
                agreedAt: user.agreedAt,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────
// @GET /api/terms/user/scheme/:planType  (logged-in user)
// Fetches the T&C for a specific scheme type from the user's own admin/shop.
// ─────────────────────────────────────────────────────────────────────
const getSchemeTermsForUser = async (req, res) => {
    try {
        const { planType } = req.params; // "Type1" or "Type2"
        const admin = await Admin.findById(req.user.adminId);
        if (!admin) return res.status(404).json({ success: false, message: "Admin/Shop not found" });

        const terms = await ensureTerms(admin, planType);
        res.json({
            success: true,
            data: {
                version: terms.version,
                title: terms.title,
                content: terms.content,
                effectiveFrom: terms.effectiveFrom,
                shopName: admin.shopName,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    getTermsByShopCode,
    getPlatformTerms,
    getMyTerms,
    getTermsByType,
    updateTerms,
    updateTermsByType,
    getTermsHistory,
    recordAgreement,
    getSchemeTermsForUser,
};