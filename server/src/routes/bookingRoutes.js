const express = require('express');
const router = express.Router();
const { createBooking, getMyBookings, cancelBooking, getShopBookings } = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createBooking);
router.get('/user/:userId', protect, getMyBookings);
router.get('/shop/:shopId', protect, getShopBookings); // Added
router.put('/:id/cancel', protect, cancelBooking);

module.exports = router;