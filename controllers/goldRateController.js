const GoldRate      = require("../models/GoldRate");
const AdminSettings = require("../models/AdminSettings");
const axios         = require("axios");
const cheerio       = require("cheerio");

// ── Helpers ───────────────────────────────────────────────────────────

/** Returns today's date string in IST (YYYY-MM-DD) */
function todayIST() {
  const now = new Date();
  // IST = UTC + 5:30
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split("T")[0];
}

/** Returns the most recent non-snapshot rate for this admin */
async function getLatestRate(adminId) {
  return GoldRate.findOne({ adminId, isSnapshot: false }).sort({ createdAt: -1 });
}

// ─────────────────────────────────────────────────────────────────────
// @GET /api/goldrate/today  (admin + user)
// ─────────────────────────────────────────────────────────────────────
const getTodayRate = async (req, res) => {
  try {
    // Works for both admin and user tokens
    const adminId = req.admin?._id || req.user?.adminId;
    if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const rate = await GoldRate.findOne({ adminId, isSnapshot: false }).sort({ createdAt: -1 });
    const today = todayIST();
    res.json({ success: true, data: rate || null, today });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// @POST /api/goldrate  (admin)
// Body: { ratePerGram, source? }
// Sets/updates the live rate for today. Overwrites any previous
// non-snapshot entry for this admin today (upsert by adminId + date).
// ─────────────────────────────────────────────────────────────────────
const setTodayRate = async (req, res) => {
  try {
    const { ratePerGram, source = "manual" } = req.body;
    if (!ratePerGram || ratePerGram <= 0)
      return res.status(400).json({ success: false, message: "Valid rate required" });

    const today = todayIST();

    const rate = await GoldRate.findOneAndUpdate(
      { adminId: req.admin._id, date: today, isSnapshot: false },
      {
        ratePerGram,
        updatedBy: req.admin._id,
        shopCode:  req.admin.shopCode,
        adminId:   req.admin._id,
        source,
        isSnapshot: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: "Gold rate updated", data: rate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// @GET /api/goldrate/history?days=7  (admin)
// Returns daily snapshots for the last N days (most recent first).
// If a day has no snapshot, we fall back to the latest non-snapshot
// entry for that day so the chart is never empty.
// ─────────────────────────────────────────────────────────────────────
const getRateHistory = async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 30);
    const adminId = req.admin._id;

    // Build a list of date strings for the last N days (IST)
    const dates = [];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
      dates.push(ist.toISOString().split("T")[0]);
    }

    // Fetch all snapshot records in that window
    const snapshots = await GoldRate.find({
      adminId,
      date: { $in: dates },
      isSnapshot: true,
    }).sort({ date: -1 });

    // For days with no snapshot, try to find a live rate
    const liveRates = await GoldRate.find({
      adminId,
      date: { $in: dates },
      isSnapshot: false,
    }).sort({ date: -1, createdAt: -1 });

    // Merge: prefer snapshot, fall back to latest live
    const snapshotMap = {};
    snapshots.forEach(s => { if (!snapshotMap[s.date]) snapshotMap[s.date] = s; });

    const liveMap = {};
    liveRates.forEach(l => { if (!liveMap[l.date]) liveMap[l.date] = l; });

    const history = dates.map(date => {
      const entry = snapshotMap[date] || liveMap[date] || null;
      return entry ? { date, ratePerGram: entry.ratePerGram, source: entry.source, isSnapshot: entry.isSnapshot } : null;
    }).filter(Boolean);

    // Compute day-over-day change
    const withChange = history.map((h, i) => {
      const prev = history[i + 1];
      const change = prev ? h.ratePerGram - prev.ratePerGram : 0;
      return { ...h, change };
    });

    res.json({ success: true, count: withChange.length, data: withChange });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// @GET /api/goldrate/settings  (admin)
// @PUT /api/goldrate/settings  (admin)
// ─────────────────────────────────────────────────────────────────────
const getSettings = async (req, res) => {
  try {
    let settings = await AdminSettings.findOne({ adminId: req.admin._id });
    if (!settings) {
      settings = await AdminSettings.create({
        adminId:  req.admin._id,
        shopCode: req.admin.shopCode,
      });
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { goldReferenceUrl, snapshotEnabled, referenceRate } = req.body;

    const update = {};
    if (goldReferenceUrl !== undefined) update.goldReferenceUrl = goldReferenceUrl.trim();
    if (snapshotEnabled  !== undefined) update.snapshotEnabled  = Boolean(snapshotEnabled);
    if (referenceRate    !== undefined) update.referenceRate    = referenceRate ? Number(referenceRate) : null;

    const settings = await AdminSettings.findOneAndUpdate(
      { adminId: req.admin._id },
      { ...update, shopCode: req.admin.shopCode, adminId: req.admin._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: "Settings saved", data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// Midnight Snapshot Cron
// Called from server.js at exactly 00:00 IST every day.
// Locks the current live rate as an immutable snapshot.
// Only runs for admins whose snapshotEnabled === true.
// ─────────────────────────────────────────────────────────────────────
const runMidnightSnapshot = async () => {
  try {
    const now   = new Date();
    // Yesterday's IST date (snapshot is for the day that just ended)
    const ist   = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const yesterday = new Date(ist);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    // Find all admin settings with snapshot enabled
    const settingsList = await AdminSettings.find({ snapshotEnabled: true });

    let created = 0;
    for (const s of settingsList) {
      // Check if snapshot already exists for this admin + yesterday
      const existing = await GoldRate.findOne({ adminId: s.adminId, date: dateStr, isSnapshot: true });
      if (existing) continue;

      // Find the latest live rate for this admin for yesterday (or most recent overall)
      const liveRate = await GoldRate.findOne({ adminId: s.adminId, date: dateStr, isSnapshot: false })
        .sort({ createdAt: -1 });

      // If no rate for yesterday, try last known rate
      const fallback = liveRate || await GoldRate.findOne({ adminId: s.adminId, isSnapshot: false })
        .sort({ createdAt: -1 });

      if (fallback) {
        await GoldRate.create({
          adminId:     s.adminId,
          shopCode:    s.shopCode,
          date:        dateStr,
          ratePerGram: fallback.ratePerGram,
          updatedBy:   s.adminId,
          isSnapshot:  true,
          source:      "snapshot",
        });
        created++;
      }
    }

    console.log(`[GoldRate] Midnight snapshot done — ${created} entries created for ${dateStr}`);
  } catch (err) {
    console.error("[GoldRate] Midnight snapshot error:", err.message);
  }
};

module.exports = { getTodayRate, setTodayRate, getRateHistory, getSettings, updateSettings, runMidnightSnapshot };