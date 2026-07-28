const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, updateProfile, toggleFavorite, getMe, logout } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { upload, compressAndUpload } = require('../middleware/uploadMiddleware');

router.post('/otp', sendOTP);
router.post('/verify', verifyOTP);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, upload.single('avatar'), compressAndUpload('avatars'), updateProfile);
router.post('/favorites', protect, toggleFavorite);

module.exports = router;