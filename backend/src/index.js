const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const initConfig = require("./config/init");
const { initializeCron } = require("./jobs/settlementJob");
const { initializeBackupJob } = require("./jobs/backupJob");
const runAutoCancelJob = require("./jobs/autoCancelJob");
const mongoose = require("mongoose");
const { printStartupBanner, error: logError } = require("./utils/logger");

// Security Packages
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");

// Load environment variables
dotenv.config({ quiet: true });

const { getJwtSecret } = require("./config/jwt");

// Fail fast in production if JWT is not configured
if (process.env.NODE_ENV === "production") {
  getJwtSecret();
  if (!process.env.CORS_ORIGINS) {
    throw new Error("CORS_ORIGINS is required in production");
  }
}

// Connect to MongoDB and start background jobs after routes are configured
const bootstrap = async () => {
  const dbHost = await connectDB();
  await initConfig();
  initializeCron();
  initializeBackupJob();
  runAutoCancelJob();

  const storageConfigured = Boolean(
    process.env.DO_SPACES_BUCKET &&
      process.env.DO_SPACES_KEY &&
      process.env.DO_SPACES_SECRET &&
      process.env.DO_SPACES_KEY !== "your_spaces_access_key",
  );

  app.listen(PORT, "0.0.0.0", () => {
    printStartupBanner({
      port: PORT,
      env: process.env.NODE_ENV || "development",
      dbHost,
      version: require("../package.json").version,
      storage: storageConfigured
        ? {
            label: process.env.DO_SPACES_ENDPOINT?.includes("digitaloceanspaces.com")
              ? "digitalocean spaces"
              : "aws s3",
            ok: true,
          }
        : { label: "not configured", ok: false },
      mockOtp:
        process.env.NODE_ENV !== "production" &&
        process.env.MOCK_OTP === "true",
      jobs: [
        { name: "settlement", schedule: "daily at 00:00" },
        { name: "db backup", schedule: "daily at 02:00" },
        { name: "auto no-show", schedule: "every 30 min" },
      ],
    });
  });
};

const app = express();

// Trust Proxy for DigitalOcean App Platform
app.set("trust proxy", 1);

// Middleware
if (process.env.NODE_ENV === "production") {
  const allowedOrigins = process.env.CORS_ORIGINS.split(",").map((s) =>
    s.trim(),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
    }),
  );
} else {
  app.use(cors());
}
// Webhook must use raw body for signature verification
const { handleWebhook } = require("./controllers/paymentController");
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook,
);

app.use(express.json());

// Security Middleware
app.use(helmet()); // Set security headers

// Custom MongoDB Sanitization Middleware
const sanitizeMongo = (req, res, next) => {
  const sanitize = (obj) => {
    // Check if it's an object and not null (handles null prototypes)
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (key.startsWith('$')) {
          delete obj[key];
        } else {
          sanitize(obj[key]);
        }
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};

app.use(sanitizeMongo);
app.use(hpp()); // Prevent HTTP Parameter Pollution

// Rate Limiting — general budget sized for mobile tab polling / shop list refresh
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX) || 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts from this IP, please try again later.",
});

// Apply rate limiters
app.use("/api/", generalLimiter);
app.use("/api/auth", authLimiter);

/** * NOTE: Local 'uploads' directory logic removed.
 * Images are now handled by DigitalOcean Spaces via shopRoutes.
 */

app.get("/api/ping", (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  console.log(`PING HIT - DB Status: ${statusMap[dbStatus]}`);
  res.json({
    ok: true,
    dbStatus: statusMap[dbStatus] || "unknown"
  });
});

// API Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/shops", require("./routes/shopRoutes"));
app.use("/api/bookings", require("./routes/bookingRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/support", require("./routes/supportRoutes"));
app.use("/api/reviews", require("./routes/reviewRoutes"));
app.use("/api/finance", require("./routes/financeRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/wallet", require("./routes/walletRoutes"));

// 404 + global error handler (must be after routes)
app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  logError(err.message || "Unhandled error", err);
  res.status(status).json({
    message:
      status >= 500
        ? "Internal server error"
        : err.message || "Request failed",
  });
});

// Server Port Configuration
const PORT = process.env.PORT || 8000;

bootstrap();
