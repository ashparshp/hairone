const express = require('express');
const router = express.Router();
const { createBooking, getMyBookings, cancelBooking, getShopBookings, updateBookingStatus, getBookingLimits } = require('../controllers/bookingController');
const { protect, blockSuspendedOwner } = require('../middleware/authMiddleware');

router.use(protect, blockSuspendedOwner);

router.post('/', createBooking);
router.get('/limits', getBookingLimits);
router.get('/user/:userId', getMyBookings);
router.get('/shop/:shopId', getShopBookings);
router.put('/:id/cancel', cancelBooking);
router.patch('/:id/status', updateBookingStatus);

module.exports = router;