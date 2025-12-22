const express = require('express');
const router = express.Router();
const {
    submitApplication, getApplications, processApplication,
    getAllShops, getSystemStats, suspendShop, reapply, getShopBookings,
    getSystemConfig, updateSystemConfig, getFinanceStats, settleShop
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');

router.post('/apply', protect, submitApplication);
router.post('/reapply', protect, reapply);

router.get('/applications', protect, getApplications);
router.post('/process', protect, processApplication);

// Analytics & Shops
router.get('/shops', protect, getAllShops);
router.post('/shops/:shopId/suspend', protect, suspendShop);
router.get('/shops/:shopId/bookings', protect, getShopBookings);
router.get('/stats', protect, getSystemStats);

// Config & Finance
router.get('/config', protect, getSystemConfig);
router.put('/config', protect, updateSystemConfig);
router.get('/finance', protect, getFinanceStats);
router.post('/settle', protect, settleShop);

module.exports = router;