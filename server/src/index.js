const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

/** * NOTE: Local 'uploads' directory logic removed. 
 * Images are now handled by DigitalOcean Spaces via shopRoutes.
 */

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/shops', require('./routes/shopRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Server Port Configuration
const PORT = process.env.PORT || 8080;

// Listen on all network interfaces for mobile access
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`☁️  Cloud Storage: DigitalOcean Spaces Active`);
});