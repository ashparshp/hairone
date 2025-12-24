const Booking = require('../models/Booking');
const Shop = require('../models/Shop');
const User = require('../models/User');
const { subDays, format } = require('date-fns');

/**
 * =================================================================================================
 * ANALYTICS CONTROLLER
 * =================================================================================================
 *
 * Purpose:
 * Provides aggregated data for the Admin Dashboard.
 *
 * Endpoints:
 * 1. getDashboardStats: High-level KPIs (Revenue, Count, Active Shops).
 * 2. getRevenueAnalytics: Time-series data for charts (Last 30 days).
 * 3. getRecentOrders: List of recent transactions with details.
 * =================================================================================================
 */

// --- 1. Dashboard Stats (KPIs) ---
exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Total GMV (Gross Merchandise Value) & Platform Revenue
    // Only count 'completed' bookings for revenue accuracy
    const revenueStats = await Booking.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalGMV: { $sum: '$finalPrice' },
          platformRevenue: { $sum: '$adminNetRevenue' },
          completedBookings: { $sum: 1 }
        }
      }
    ]);

    const stats = revenueStats[0] || { totalGMV: 0, platformRevenue: 0, completedBookings: 0 };

    // 2. Total Bookings (All statuses)
    const totalBookings = await Booking.countDocuments({});

    // 3. Active Shops
    const activeShops = await Shop.countDocuments({ isDisabled: false });

    // 4. Total Users
    const totalUsers = await User.countDocuments({ role: 'user' });

    res.json({
      totalGMV: stats.totalGMV,
      platformRevenue: stats.platformRevenue,
      totalBookings,
      completedBookings: stats.completedBookings,
      activeShops,
      totalUsers
    });

  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
};

// --- 2. Revenue Analytics (Chart Data) ---
exports.getRevenueAnalytics = async (req, res) => {
  try {
    const days = 30;
    const pastDate = subDays(new Date(), days);

    // Group by Date (YYYY-MM-DD)
    // We use the 'date' string field from Booking (e.g. "2023-10-25")
    const dailyRevenue = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: pastDate } // Filter by creation to ensure recent relevance, or use 'date' string
        }
      },
      {
        $group: {
          _id: '$date', // Group by the booking date string
          revenue: { $sum: '$finalPrice' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(dailyRevenue);
  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ message: "Failed to fetch revenue analytics" });
  }
};

// --- 3. Recent Orders ---
exports.getRecentOrders = async (req, res) => {
  try {
    const orders = await Booking.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('shopId', 'name')
      .populate('userId', 'name email');

    res.json(orders);
  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ message: "Failed to fetch recent orders" });
  }
};
