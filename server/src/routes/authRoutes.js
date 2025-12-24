const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, updateProfile, toggleFavorite } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { upload, compressAndUpload } = require('../middleware/uploadMiddleware');

// Middleware to set upload folder to 'avatars'
const setAvatarFolder = (req, res, next) => {
    req.uploadFolder = 'avatars';
    next();
};

router.post('/otp', sendOTP);
router.post('/verify', verifyOTP);
router.put('/profile', protect, upload.single('avatar'), setAvatarFolder, compressAndUpload, updateProfile);
router.post('/favorites', protect, toggleFavorite);

module.exports = router;