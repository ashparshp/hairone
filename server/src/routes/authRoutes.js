const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP } = require('../controllers/authController');

router.post('/otp', sendOTP);
router.post('/verify', verifyOTP);

module.exports = router;