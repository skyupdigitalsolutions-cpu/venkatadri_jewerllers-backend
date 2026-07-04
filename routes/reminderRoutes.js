// routes/reminderRoutes.js
const express = require("express");
const router  = express.Router();
const { protectAdmin } = require("../middleware/auth");
const {
  getAllReminders, getReminderStats, getPendingList,
  getSentTodayList, sendReminderManual,
  getWAContacts, sendWAMessage, sendWABulk,
} = require("../controllers/reminderController");

router.get("/",                        protectAdmin, getAllReminders);
router.get("/stats",                   protectAdmin, getReminderStats);
router.get("/pending-list",            protectAdmin, getPendingList);
router.get("/sent-today",              protectAdmin, getSentTodayList);
router.post("/send/:paymentId",        protectAdmin, sendReminderManual);

// WhatsApp routes
router.get("/whatsapp/contacts",       protectAdmin, getWAContacts);
router.post("/whatsapp/send",          protectAdmin, sendWAMessage);
router.post("/whatsapp/bulk",          protectAdmin, sendWABulk);

module.exports = router;