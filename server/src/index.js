const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const connectDB = require("./config/db");
const initConfig = require("./config/init");

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB().then(() => {
  initConfig();
});

const app = express();

// Middleware - Global
app.use(cors()); // TODO: In production, configure origin: 'https://your-domain.com'
app.use(helmet()); // Security Headers
app.use(express.json({ limit: "10kb" })); // Body limit
app.use(mongoSanitize()); // Prevent NoSQL injection

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// Strict Rate Limiting for Auth
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 login attempts per hour
  message: "Too many login attempts from this IP, please try again after an hour"
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

/** * NOTE: Local 'uploads' directory logic removed.
 * Images are now handled by DigitalOcean Spaces via shopRoutes.
 */

app.get("/api/ping", (req, res) => {
  console.log("PING HIT");
  res.json({ ok: true });
});

// API Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/shops", require("./routes/shopRoutes"));
app.use("/api/bookings", require("./routes/bookingRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/support", require("./routes/supportRoutes"));

// Server Port Configuration
const PORT = process.env.PORT || 8000;

// Listen on all network interfaces for mobile access
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`☁️  Cloud Storage: DigitalOcean Spaces Active`);
});
