const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getDashboardStats,
  getRevenueAnalytics,
  getRecentOrders
} = require('../controllers/analyticsController');

// All routes are protected and require admin role
router.use(protect);
router.use(admin);

router.get('/stats', getDashboardStats);
router.get('/revenue', getRevenueAnalytics);
router.get('/orders', getRecentOrders);

module.exports = router;
