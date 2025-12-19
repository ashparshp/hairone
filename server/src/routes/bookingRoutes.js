const express = require('express');
const router = express.Router();
// 1. Make sure these names MATCH the exports in bookingController.js
const { createBooking, getMyBookings } = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

// 2. Define Routes
router.post('/', protect, createBooking);
router.get('/user/:userId', protect, getMyBookings);

module.exports = router;