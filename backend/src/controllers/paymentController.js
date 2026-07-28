const {
  getPaymentConfig,
  createBookingPaymentOrder,
  verifyAndFulfillBookingPayment,
  processWebhookEvent,
  serializePaymentOrder,
  getPaymentOrderForUser,
  PaymentServiceError,
} = require("../services/paymentService");
const { verifyWebhookSignature, RazorpayServiceError } = require("../services/razorpayService");
const { BookingServiceError } = require("../services/bookingService");
const { getRazorpayKeyId } = require("../config/razorpay");

const handleServiceError = (res, error) => {
  if (error instanceof PaymentServiceError) {
    return res.status(error.status).json({ message: error.message });
  }
  if (error instanceof BookingServiceError) {
    return res.status(error.status).json({ message: error.message });
  }
  if (error instanceof RazorpayServiceError) {
    return res.status(error.status).json({ message: error.message });
  }
  console.error(error);
  return res.status(500).json({ message: "Payment request failed" });
};

exports.getPaymentConfig = (req, res) => {
  res.json(getPaymentConfig());
};

exports.createBookingOrder = async (req, res) => {
  try {
    const { paymentOrder, prepared, reused } =
      await createBookingPaymentOrder(req.user, req.body);

    res.status(reused ? 200 : 201).json({
      paymentOrder: serializePaymentOrder(paymentOrder),
      checkout: {
        keyId: getRazorpayKeyId(),
        orderId: paymentOrder.razorpayOrderId,
        amountPaise: paymentOrder.amountPaise,
        currency: paymentOrder.currency,
        referenceId: paymentOrder.referenceId,
      },
      summary: {
        shopName: prepared.shop.name,
        finalPrice: prepared.pricing.finalPrice,
        originalPrice: prepared.pricing.originalPrice,
        discountAmount: prepared.pricing.discountAmount,
      },
      reused,
    });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

exports.verifyBookingPayment = async (req, res) => {
  try {
    const { paymentOrder, booking, duplicate } =
      await verifyAndFulfillBookingPayment(req.user, req.body);

    if (duplicate) {
      return res.json({
        message: "Payment already confirmed",
        paymentOrder: serializePaymentOrder(paymentOrder),
        bookingId: paymentOrder.bookingId,
      });
    }

    res.status(201).json({
      message: "Payment verified and booking confirmed",
      paymentOrder: serializePaymentOrder(paymentOrder),
      booking,
    });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

exports.getPaymentOrder = async (req, res) => {
  try {
    const paymentOrder = await getPaymentOrderForUser(
      req.params.id,
      req.user._id,
    );
    res.json({ paymentOrder: serializePaymentOrder(paymentOrder) });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(503).json({ message: "Webhook not configured" });
    }

    const signature = req.headers["x-razorpay-signature"];
    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = JSON.parse(req.body.toString());
    const result = await processWebhookEvent(event);

    res.json({ received: true, ...result });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ message: "Webhook processing failed" });
  }
};
