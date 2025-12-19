const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, updateProfile, toggleFavorite } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/otp', sendOTP);
router.post('/verify', verifyOTP);
router.put('/profile', protect, updateProfile);
router.post('/favorites', protect, toggleFavorite);

module.exports = router;