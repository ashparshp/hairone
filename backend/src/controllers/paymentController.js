const crypto = require("crypto");
const PaymentOrder = require("../models/PaymentOrder");
const {
  getRazorpayClient,
  getRazorpayKeyId,
  getRazorpayKeySecret,
  isRazorpayConfigured,
} = require("../config/razorpay");
const {
  BookingServiceError,
  prepareBooking,
  createBookingFromPrepared,
} = require("../services/bookingService");

const ORDER_TTL_MINUTES = 15;

const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", getRazorpayKeySecret())
    .update(body)
    .digest("hex");
  return expected === signature;
};

exports.getPaymentConfig = (req, res) => {
  res.json({
    onlinePaymentsEnabled: isRazorpayConfigured(),
    razorpayKeyId: isRazorpayConfigured() ? getRazorpayKeyId() : null,
  });
};

exports.createBookingOrder = async (req, res) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(503).json({ message: "Online payments are not configured." });
    }

    const body = {
      ...req.body,
      paymentMethod: "ONLINE",
    };

    const prepared = await prepareBooking(req.user, body);
    const amountPaise = Math.round(prepared.pricing.finalPrice * 100);

    if (amountPaise < 100) {
      return res.status(400).json({ message: "Minimum online payment is ₹1." });
    }

    const razorpay = getRazorpayClient();
    const receipt = `bk_${Date.now()}_${req.user._id.toString().slice(-6)}`;

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        userId: req.user._id.toString(),
        shopId: prepared.shopId.toString(),
        date: prepared.date,
        startTime: prepared.startTime,
      },
    });

    const expiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60 * 1000);

    const paymentOrder = await PaymentOrder.create({
      userId: req.user._id,
      razorpayOrderId: order.id,
      amount: amountPaise,
      currency: order.currency,
      bookingDraft: body,
      pricing: prepared.pricing,
      expiresAt,
    });

    res.json({
      paymentOrderId: paymentOrder._id,
      orderId: order.id,
      amount: amountPaise,
      currency: order.currency,
      keyId: getRazorpayKeyId(),
      shopName: prepared.shop.name,
      finalPrice: prepared.pricing.finalPrice,
    });
  } catch (error) {
    if (error instanceof BookingServiceError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: "Failed to create payment order" });
  }
};

exports.verifyBookingPayment = async (req, res) => {
  try {
    const {
      paymentOrderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !paymentOrderId ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({ message: "Missing payment verification fields." });
    }

    if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return res.status(400).json({ message: "Invalid payment signature." });
    }

    const paymentOrder = await PaymentOrder.findById(paymentOrderId);
    if (!paymentOrder) {
      return res.status(404).json({ message: "Payment order not found." });
    }

    if (paymentOrder.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized for this payment." });
    }

    if (paymentOrder.status === "paid" && paymentOrder.bookingId) {
      return res.json({
        message: "Payment already verified",
        bookingId: paymentOrder.bookingId,
      });
    }

    if (paymentOrder.status !== "pending") {
      return res.status(400).json({ message: "Payment order is no longer valid." });
    }

    if (paymentOrder.expiresAt < new Date()) {
      paymentOrder.status = "expired";
      await paymentOrder.save();
      return res.status(400).json({ message: "Payment order expired. Please try again." });
    }

    if (paymentOrder.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Order ID mismatch." });
    }

    const prepared = await prepareBooking(req.user, {
      ...paymentOrder.bookingDraft,
      paymentMethod: "ONLINE",
    });

    if (prepared.pricing.finalPrice * 100 !== paymentOrder.amount) {
      return res.status(400).json({ message: "Payment amount mismatch." });
    }

    const booking = await createBookingFromPrepared(prepared, {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    paymentOrder.status = "paid";
    paymentOrder.razorpayPaymentId = razorpay_payment_id;
    paymentOrder.bookingId = booking._id;
    await paymentOrder.save();

    res.status(201).json({
      message: "Payment verified and booking confirmed",
      booking,
    });
  } catch (error) {
    if (error instanceof BookingServiceError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: "Payment verification failed" });
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(503).json({ message: "Webhook not configured" });
    }

    const signature = req.headers["x-razorpay-signature"];
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body)
      .digest("hex");

    if (signature !== expected) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = JSON.parse(req.body.toString());
    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      const paymentOrder = await PaymentOrder.findOne({
        razorpayOrderId: orderId,
        status: "pending",
      });

      if (paymentOrder && !paymentOrder.bookingId) {
        // Webhook is a backup; client verify is primary
        console.log(`Webhook captured payment for order ${orderId}`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ message: "Webhook processing failed" });
  }
};
