const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getPaymentConfig,
  createBookingOrder,
  verifyBookingPayment,
  getPaymentOrder,
} = require("../controllers/paymentController");

router.get("/config", protect, getPaymentConfig);
router.get("/orders/:id", protect, getPaymentOrder);
router.post("/create-booking-order", protect, createBookingOrder);
router.post("/verify-booking", protect, verifyBookingPayment);

module.exports = router;
