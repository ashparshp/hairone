const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const initConfig = require("./config/init");
const { initializeCron } = require("./jobs/settlementJob");

// Load environment variables
dotenv.config();

// Connect to MongoDB
if (require.main === module) {
  connectDB().then(() => {
    initConfig();
    initializeCron(); // Start the scheduler
  });
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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
app.use("/api/reviews", require("./routes/reviewRoutes"));
app.use("/api/finance", require("./routes/financeRoutes"));

// Server Port Configuration
const PORT = process.env.PORT || 8000;

// Listen on all network interfaces for mobile access
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`☁️  Cloud Storage: DigitalOcean Spaces Active`);
  });
}

module.exports = app;
