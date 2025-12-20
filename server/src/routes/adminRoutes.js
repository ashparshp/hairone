const express = require('express');
const router = express.Router();
const { submitApplication, getApplications, processApplication, getAllShops, getSystemStats } = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');

router.post('/apply', protect, submitApplication);

router.get('/applications', protect, getApplications);
router.post('/process', protect, processApplication);

// Analytics & Shops
router.get('/shops', protect, getAllShops);
router.get('/stats', protect, getSystemStats);

module.exports = router;