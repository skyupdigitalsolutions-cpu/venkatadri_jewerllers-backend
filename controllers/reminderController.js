const cron     = require("node-cron");
const Payment  = require("../models/Payment");
const Reminder = require("../models/Reminder");
const User     = require("../models/User");
const { sendSMS } = require("../utils/smsHelper");
const { sendWhatsApp, sendBulkWhatsApp } = require("../utils/whatsappHelper");

// @GET /api/reminders
const getAllReminders = async (req, res) => {
  try {
    const reminders = await Reminder.find()
      .populate("user",    "name phone")
      .populate("payment", "amount dueDate status monthNumber")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reminders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/reminders/stats
// Returns sentToday, pending (due in 7 days), overdue counts
const getReminderStats = async (req, res) => {
  try {
    const now   = new Date();

    // Start and end of today (UTC)
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // 7 days from now
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    sevenDaysLater.setHours(23, 59, 59, 999);

    // Fetch user IDs belonging to this admin's shop
    const adminUsers = await User.find({ adminId: req.admin._id }).select("_id");
    const userIds = adminUsers.map(u => u._id);

    // Sent today: reminders with sentAt today scoped to admin's users
    const sentToday = await Reminder.countDocuments({
      user: { $in: userIds },
      sentAt: { $gte: todayStart, $lte: todayEnd },
      status: "sent",
    });

    // Pending: unique users with pending payments due within next 7 days (not yet overdue) scoped to admin's users
    const pendingPayments = await Payment.find({
      user: { $in: userIds },
      status: "pending",
      dueDate: { $gt: now, $lte: sevenDaysLater },
    }).distinct("user");
    const pending = pendingPayments.length;

    // Overdue: unique users with overdue payments scoped to admin's users
    const overdueByStatus = await Payment.find({
      user: { $in: userIds },
      status: "overdue",
    }).distinct("user");

    const overdueByDate = await Payment.find({
      user: { $in: userIds },
      status: "pending",
      dueDate: { $lt: now },
    }).distinct("user");

    // Merge and deduplicate
    const overdueSet = new Set([
      ...overdueByStatus.map(String),
      ...overdueByDate.map(String),
    ]);
    const overdue = overdueSet.size;

    res.json({ success: true, data: { sentToday, pending, overdue } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/reminders/pending-list
// Returns list of pending (due in 7 days) and overdue payments for display
const getPendingList = async (req, res) => {
  try {
    const now = new Date();

    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    sevenDaysLater.setHours(23, 59, 59, 999);

    // Fetch user IDs belonging to this admin's shop
    const adminUsers = await User.find({ adminId: req.admin._id }).select("_id");
    const userIds = adminUsers.map(u => u._id);

    // Pending due within 7 days
    const pendingPayments = await Payment.find({
      user: { $in: userIds },
      status: "pending",
      dueDate: { $lte: sevenDaysLater },
    })
      .populate("user",   "name phone userId")
      .populate("scheme", "schemeId monthlyAmount")
      .sort({ dueDate: 1 });

    // Overdue payments
    const overduePayments = await Payment.find({
      user: { $in: userIds },
      status: "overdue",
    })
      .populate("user",   "name phone userId")
      .populate("scheme", "schemeId monthlyAmount")
      .sort({ dueDate: 1 });

    // Merge: put overdue first, then pending
    const all = [
      ...overduePayments.map(p => ({ ...p.toObject(), _computedStatus: "overdue" })),
      ...pendingPayments.filter(p => p.dueDate > now).map(p => ({
        ...p.toObject(),
        _computedStatus: "pending",
      })),
    ];

    res.json({ success: true, data: all });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/reminders/send/:paymentId
const sendReminderManual = async (req, res) => {
  try {
    const adminUsers = await User.find({ adminId: req.admin._id }).select("_id");
    const userIds = adminUsers.map(u => u._id.toString());

    const payment = await Payment.findById(req.params.paymentId)
      .populate("user",   "name phone")
      .populate("scheme", "schemeId monthlyAmount");

    if (!payment)
      return res.status(404).json({ success: false, message: "Payment not found" });

    if (!userIds.includes(payment.user?._id.toString()))
      return res.status(403).json({ success: false, message: "Not authorized to send reminder to this user" });

    if (payment.status === "paid")
      return res.status(400).json({ success: false, message: "Already paid" });

    const message =
      `Dear ${payment.user.name}, your Gold Chit payment of ` +
      `Rs.${payment.amount.toLocaleString()} for scheme ${payment.scheme.schemeId} ` +
      `(Month ${payment.monthNumber}) is due. ` +
      `Please pay at the earliest. - SkyUp Digital Solution`;

    const sent = await sendSMS(payment.user.phone, message);

    const reminder = await Reminder.create({
      payment: payment._id,
      user:    payment.user._id,
      scheme:  payment.scheme._id,
      phone:   payment.user.phone,
      message,
      sentAt:  new Date(),
      status:  sent ? "sent" : "failed",
    });

    res.json({
      success: true,
      message: sent ? "SMS sent" : "SMS skipped (not configured)",
      data: reminder,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Auto SMS cron — every day 9:00 AM
const scheduleAutoReminders = () => {
  cron.schedule("0 9 * * *", async () => {
    console.log("Running auto reminders...");
    try {
      const today        = new Date().toISOString().split("T")[0];
      const twoDaysLater = new Date();
      twoDaysLater.setDate(twoDaysLater.getDate() + 2);
      const dueDateStr   = twoDaysLater.toISOString().split("T")[0];

      const payments = await Payment.find({ status: { $in: ["pending", "overdue"] } })
        .populate("user",   "name phone")
        .populate("scheme", "schemeId monthlyAmount");

      for (const payment of payments) {
        const due = new Date(payment.dueDate).toISOString().split("T")[0];
        if (due === dueDateStr || due < today) {
          const isOverdue = due < today;
          const message =
            `Dear ${payment.user.name}, your Gold Chit payment of ` +
            `Rs.${payment.amount.toLocaleString()} (Month ${payment.monthNumber}) is ` +
            `${isOverdue ? "OVERDUE" : "due in 2 days"}. ` +
            `Please visit the shop. - SkyUp Digital Solution`;

          const sent = await sendSMS(payment.user.phone, message);
          await Reminder.create({
            payment: payment._id,
            user:    payment.user._id,
            scheme:  payment.scheme._id,
            phone:   payment.user.phone,
            message,
            sentAt:  new Date(),
            status:  sent ? "sent" : "failed",
          });
        }
      }
      console.log("Auto reminders done");
    } catch (err) {
      console.error("Reminder cron error:", err.message);
    }
  });
  console.log("Auto reminder cron scheduled (daily 9:00 AM)");
};

// @GET /api/reminders/sent-today
// Returns all SMS reminders that were dispatched today
const getSentTodayList = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Fetch user IDs belonging to this admin's shop
    const adminUsers = await User.find({ adminId: req.admin._id }).select("_id");
    const userIds = adminUsers.map(u => u._id);

    const reminders = await Reminder.find({
      user: { $in: userIds },
      sentAt: { $gte: todayStart, $lte: todayEnd },
      status: "sent",
    })
      .populate("user",    "name phone userId")
      .populate("payment", "amount dueDate status monthNumber")
      .populate("scheme",  "schemeId")
      .sort({ sentAt: -1 });

    res.json({ success: true, data: reminders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @GET /api/reminders/whatsapp/contacts
// Returns ALL users with their most urgent payment status attached
const getWAContacts = async (req, res) => {
  try {
    const now = new Date();

    // Fetch all users
    const users = await User.find({ adminId: req.admin._id })
      .select("name phone userId _id")
      .sort({ name: 1 });

    // Fetch all non-paid payments and index by userId
    const payments = await Payment.find({ status: { $ne: "paid" } })
      .populate("scheme", "schemeId")
      .sort({ dueDate: 1 });

    // Build a map: userId -> most urgent payment
    const paymentMap = new Map();
    payments.forEach((p) => {
      if (!p.user) return;
      const uid = p.user.toString();
      const isOverdue = p.status === "overdue" || new Date(p.dueDate) < now;
      const existing  = paymentMap.get(uid);
      // Prefer overdue over pending; otherwise keep earliest due date
      if (!existing || (isOverdue && !existing._isOverdue)) {
        paymentMap.set(uid, { ...p.toObject(), _isOverdue: isOverdue, _isPending: !isOverdue });
      }
    });

    // Build contact list: every user + their payment info (if any)
    const contacts = users.map((u) => {
      const payment = paymentMap.get(u._id.toString());
      return {
        // user object embedded directly for front-end compatibility
        _id:         payment?._id   || u._id,     // use payment _id for sending; fallback to user _id
        user:        { _id: u._id, name: u.name, phone: u.phone, userId: u.userId },
        scheme:      payment?.scheme    || null,
        amount:      payment?.amount    || 0,
        monthNumber: payment?.monthNumber || null,
        dueDate:     payment?.dueDate   || null,
        status:      payment?.status    || "paid",
        _isOverdue:  payment?._isOverdue || false,
        _isPending:  payment?._isPending || false,
        _hasPayment: !!payment,
        _paymentId:  payment?._id       || null,
      };
    });

    res.json({ success: true, data: contacts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// @POST /api/reminders/whatsapp/send
// Send WhatsApp to a single user by paymentId
const sendWAMessage = async (req, res) => {
  try {
    const { paymentId, customMessage } = req.body;
    let phone, name, message;

    // Check if the ID corresponds to a Payment first
    let payment = await Payment.findById(paymentId)
      .populate("user",   "name phone")
      .populate("scheme", "schemeId");

    if (payment) {
      if (payment.status === "paid" && !customMessage) {
        return res.status(400).json({ success: false, message: "Already paid" });
      }
      phone = payment.user?.phone;
      name = payment.user?.name;
      const isOverdue = payment.status === "overdue" || new Date(payment.dueDate) < new Date();
      message = customMessage ||
        `Your Gold Chit payment of Rs.${payment.amount.toLocaleString()} for scheme ${payment.scheme?.schemeId} ` +
        `(Month ${payment.monthNumber}) is ${isOverdue ? "OVERDUE" : "due soon"}. ` +
        `Please pay at the earliest. - SkyUp Digital Solution`;
    } else {
      // Otherwise, it must be a User ID
      const user = await User.findById(paymentId);
      if (!user) {
        return res.status(404).json({ success: false, message: "Recipient not found (neither payment nor user exists)" });
      }
      phone = user.phone;
      name = user.name;
      message = customMessage || `Dear ${user.name}, thank you for being a valued member of SkyUp Gold Jewellers!`;
    }

    if (!phone) {
      return res.status(400).json({ success: false, message: "Recipient phone number is missing" });
    }

    const result = await sendWhatsApp(phone, name, message);
    res.json({ success: result.success, message: result.success ? "WhatsApp sent" : "WhatsApp skipped", data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @POST /api/reminders/whatsapp/bulk
// Bulk WhatsApp to selected filters (scoped to admin's users)
const sendWABulk = async (req, res) => {
  try {
    const { customMessage, filter } = req.body; // filter: "all" | "pending" | "overdue" | "all_users"
    const now = new Date();
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    sevenDaysLater.setHours(23, 59, 59, 999);

    // Fetch user IDs belonging to this admin's shop to restrict queries
    const adminUsers = await User.find({ adminId: req.admin._id }).select("_id name phone");
    const userIds = adminUsers.map(u => u._id);

    if (filter === "all_users") {
      // Send to all users under this admin
      const recipients = adminUsers
        .filter(u => u.phone)
        .map(u => {
          const msg = customMessage || `Dear ${u.name}, thank you for being a valued member of SkyUp Digital Solution!`;
          return { phone: u.phone, name: u.name, message: msg };
        });

      if (recipients.length === 0)
        return res.json({ success: true, message: "No recipients", sent: 0, failed: 0 });

      const result = await sendBulkWhatsApp(recipients);
      return res.json({ success: true, ...result });
    }

    let query;
    if (filter === "overdue") {
      query = {
        status: { $in: ["pending", "overdue"] },
        user: { $in: userIds },
        $or: [{ status: "overdue" }, { status: "pending", dueDate: { $lt: now } }]
      };
    } else if (filter === "pending") {
      query = {
        status: "pending",
        user: { $in: userIds },
        dueDate: { $gt: now, $lte: sevenDaysLater }
      };
    } else {
      // filter: "all" (Pending + Overdue)
      query = {
        status: { $in: ["pending", "overdue"] },
        user: { $in: userIds },
        $or: [{ status: "overdue" }, { status: "pending", dueDate: { $lte: sevenDaysLater } }]
      };
    }

    const payments = await Payment.find(query)
      .populate("user",   "name phone")
      .populate("scheme", "schemeId");

    // Deduplicate by user
    const seen = new Set();
    const recipients = [];
    payments.forEach((p) => {
      if (!p.user?.phone || seen.has(p.user._id.toString())) return;
      seen.add(p.user._id.toString());
      const isOverdue = p.status === "overdue" || new Date(p.dueDate) < now;
      const msg = customMessage ||
        `Dear ${p.user.name}, your Gold Chit payment of Rs.${p.amount.toLocaleString()} ` +
        `(Scheme ${p.scheme?.schemeId}, Month ${p.monthNumber}) is ${isOverdue ? "OVERDUE" : "due soon"}. ` +
        `Please pay immediately. - SkyUp Digital Solution`;
      recipients.push({ phone: p.user.phone, name: p.user.name, message: msg });
    });

    if (recipients.length === 0)
      return res.json({ success: true, message: "No recipients", sent: 0, failed: 0 });

    const result = await sendBulkWhatsApp(recipients);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllReminders, getReminderStats, getPendingList, getSentTodayList, sendReminderManual, getWAContacts, sendWAMessage, sendWABulk, scheduleAutoReminders };