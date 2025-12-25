const express = require('express');
const router = express.Router();
const {
    submitApplication, getApplications, processApplication,
    getAllShops, getSystemStats, suspendShop, reactivateShop, reapply, getShopBookings,
    getSystemConfig, updateSystemConfig
} = require('../controllers/adminController');
const financeController = require('../controllers/financeController');
const { protect } = require('../middleware/authMiddleware');

router.post('/apply', protect, submitApplication);
router.post('/reapply', protect, reapply);

router.get('/applications', protect, getApplications);
router.post('/process', protect, processApplication);

// Analytics & Shops
router.get('/shops', protect, getAllShops);
router.post('/shops/:shopId/suspend', protect, suspendShop);
router.post('/shops/:shopId/activate', protect, reactivateShop);
router.get('/shops/:shopId/bookings', protect, getShopBookings);
router.get('/stats', protect, getSystemStats);

// Config & Finance
router.get('/config', protect, getSystemConfig);
router.put('/config', protect, updateSystemConfig);

// Finance (New)
router.get('/finance', protect, financeController.getPendingSettlements);
router.get('/finance/pending/:shopId', protect, financeController.getShopPendingDetails);
router.post('/finance/settle', protect, financeController.createSettlement);
router.get('/finance/settlements', protect, financeController.getSettlementHistory);
router.get('/finance/settlements/:id', protect, financeController.getSettlementDetails);

module.exports = router;