// ─── Load environment variables FIRST (before any other require) ──────────────
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const { scheduleAutoReminders } = require("./controllers/reminderController");

// ─── Connect to MongoDB ──────────────────────────────────────────────────────
connectDB();

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.endsWith(".pages.dev") || origin.startsWith("http://localhost")) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request & Response Logger for debugging
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url} - body:`, req.body);
  const oldJson = res.json;
  res.json = function(data) {
    console.log(`[RESPONSE] ${req.method} ${req.url} - status: ${res.statusCode} - data:`, data);
    return oldJson.apply(res, arguments);
  };
  next();
});

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/schemes", require("./routes/schemeRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/plans", require("./routes/planRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/goldrate", require("./routes/goldRateRoutes"));
app.use("/api/reminders", require("./routes/reminderRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/scheme-templates", require("./routes/schemeTemplateRoutes"));
app.use("/api/scheme-join", require("./routes/schemeJoinRoutes"));
app.use("/api/terms", require("./routes/termsRoutes"));

// ─── Health check ────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SkyUp Digital Solution API is running ✅",
    version: "1.0.0",
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || "Server error",
  });
});

// ─── Cron Jobs ────────────────────────────────────────────────────────────────
const cron = require("node-cron");
const { runMidnightSnapshot } = require("./controllers/goldRateController");

scheduleAutoReminders();

// Run at 00:00 every day
cron.schedule("0 0 * * *", () => {
  runMidnightSnapshot();
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
}); // Trigger restart again 4