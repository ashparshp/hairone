const crypto = require("crypto");
const {
  getRazorpayClient,
  getRazorpayKeySecret,
  isRazorpayConfigured,
} = require("../config/razorpay");

class RazorpayServiceError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const verifyPaymentSignature = (orderId, paymentId, signature) => {
  if (!orderId || !paymentId || !signature) return false;

  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", getRazorpayKeySecret())
    .update(body)
    .digest("hex");

  if (expected.length !== signature.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(signature, "utf8"),
  );
};

const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (expected.length !== signature.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(signature, "utf8"),
  );
};

const fetchPayment = async (paymentId) => {
  const client = getRazorpayClient();
  return client.payments.fetch(paymentId);
};

const fetchOrder = async (orderId) => {
  const client = getRazorpayClient();
  return client.orders.fetch(orderId);
};

const createOrder = async ({ amountPaise, currency, receipt, notes }) => {
  const client = getRazorpayClient();
  return client.orders.create({
    amount: amountPaise,
    currency,
    receipt,
    notes,
  });
};

/**
 * Confirms payment against Razorpay API — never trust the client alone.
 */
const assertPaymentCapturedForOrder = async (
  paymentOrder,
  razorpayPaymentId,
) => {
  let payment;
  try {
    payment = await fetchPayment(razorpayPaymentId);
  } catch (error) {
    throw new RazorpayServiceError("Unable to verify payment with Razorpay.");
  }

  if (payment.order_id !== paymentOrder.razorpayOrderId) {
    throw new RazorpayServiceError("Payment does not belong to this order.", 400);
  }

  if (payment.status !== "captured") {
    throw new RazorpayServiceError(
      `Payment not captured (status: ${payment.status}).`,
      400,
    );
  }

  if (payment.amount !== paymentOrder.amountPaise) {
    throw new RazorpayServiceError("Payment amount mismatch.", 400);
  }

  if ((payment.currency || "INR") !== paymentOrder.currency) {
    throw new RazorpayServiceError("Payment currency mismatch.", 400);
  }

  return payment;
};

module.exports = {
  RazorpayServiceError,
  isRazorpayConfigured,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPayment,
  fetchOrder,
  createOrder,
  assertPaymentCapturedForOrder,
};
