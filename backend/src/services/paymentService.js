const crypto = require("crypto");
const PaymentOrder = require("../models/PaymentOrder");
const WebhookEvent = require("../models/WebhookEvent");
const { getRazorpayKeyId } = require("../config/razorpay");
const {
  PAYMENT_ORDER_STATUS,
  PAYMENT_ORDER_TTL_MINUTES,
  PAYMENT_PROCESSING_STALE_MS,
  MIN_AMOUNT_PAISE,
} = require("../constants/paymentStatus");
const {
  BookingServiceError,
  prepareBooking,
  createBookingFromPrepared,
} = require("./bookingService");
const {
  RazorpayServiceError,
  isRazorpayConfigured,
  verifyPaymentSignature,
  createOrder,
  assertPaymentCapturedForOrder,
} = require("./razorpayService");

class PaymentServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const generateReferenceId = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `HO-${ts}-${rand}`;
};

const buildBookingFingerprint = (userId, draft) => {
  const payload = {
    userId: userId.toString(),
    shopId: draft.shopId?.toString(),
    barberId: draft.barberId?.toString() || "any",
    date: draft.date,
    startTime: draft.startTime,
    serviceNames: [...(draft.serviceNames || [])].sort(),
    bookingMode: draft.bookingMode || "schedule",
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
};

const isOrderExpired = (paymentOrder) =>
  paymentOrder.expiresAt && paymentOrder.expiresAt < new Date();

const markOrderExpired = async (paymentOrder) => {
  if (paymentOrder.status !== PAYMENT_ORDER_STATUS.CREATED) return paymentOrder;
  paymentOrder.status = PAYMENT_ORDER_STATUS.EXPIRED;
  await paymentOrder.save();
  return paymentOrder;
};

const serializePaymentOrder = (paymentOrder, extras = {}) => ({
  id: paymentOrder._id,
  referenceId: paymentOrder.referenceId,
  razorpayOrderId: paymentOrder.razorpayOrderId,
  amountPaise: paymentOrder.amountPaise,
  currency: paymentOrder.currency,
  status: paymentOrder.status,
  expiresAt: paymentOrder.expiresAt,
  bookingId: paymentOrder.bookingId || null,
  ...extras,
});

const getPaymentConfig = () => ({
  onlinePaymentsEnabled: isRazorpayConfigured(),
  razorpayKeyId: isRazorpayConfigured() ? getRazorpayKeyId() : null,
});

const createBookingPaymentOrder = async (user, body) => {
  if (!isRazorpayConfigured()) {
    throw new PaymentServiceError(503, "Online payments are not configured.");
  }

  const bookingDraft = { ...body, paymentMethod: "ONLINE" };
  const prepared = await prepareBooking(user, bookingDraft);
  const amountPaise = Math.round(prepared.pricing.finalPrice * 100);

  if (amountPaise < MIN_AMOUNT_PAISE) {
    throw new PaymentServiceError(400, "Minimum online payment is ₹1.");
  }

  const fingerprint = buildBookingFingerprint(user._id, bookingDraft);

  const existing = await PaymentOrder.findOne({
    userId: user._id,
    fingerprint,
    status: PAYMENT_ORDER_STATUS.CREATED,
    expiresAt: { $gt: new Date() },
  });

  if (existing) {
    return {
      paymentOrder: existing,
      prepared,
      reused: true,
    };
  }

  try {
    const referenceId = generateReferenceId();
    const razorpayOrder = await createOrder({
      amountPaise,
      currency: "INR",
      receipt: referenceId,
      notes: {
        referenceId,
        userId: user._id.toString(),
        shopId: prepared.shopId.toString(),
        date: prepared.date,
        startTime: prepared.startTime,
      },
    });

    const expiresAt = new Date(
      Date.now() + PAYMENT_ORDER_TTL_MINUTES * 60 * 1000,
    );

    try {
      const paymentOrder = await PaymentOrder.create({
        referenceId,
        fingerprint,
        userId: user._id,
        shopId: prepared.shopId,
        razorpayOrderId: razorpayOrder.id,
        amountPaise,
        currency: razorpayOrder.currency || "INR",
        status: PAYMENT_ORDER_STATUS.CREATED,
        bookingDraft,
        pricing: prepared.pricing,
        expiresAt,
      });

      return { paymentOrder, prepared, reused: false };
    } catch (createError) {
      if (createError?.code === 11000) {
        const raced = await PaymentOrder.findOne({
          userId: user._id,
          fingerprint,
          status: PAYMENT_ORDER_STATUS.CREATED,
          expiresAt: { $gt: new Date() },
        });
        if (raced) {
          return { paymentOrder: raced, prepared, reused: true };
        }
      }
      throw createError;
    }
  } catch (error) {
    if (error instanceof BookingServiceError) throw error;
    throw error;
  }
};

const getPaymentOrderForUser = async (paymentOrderId, userId) => {
  const paymentOrder = await PaymentOrder.findById(paymentOrderId);
  if (!paymentOrder) {
    throw new PaymentServiceError(404, "Payment order not found.");
  }
  if (paymentOrder.userId.toString() !== userId.toString()) {
    throw new PaymentServiceError(403, "Not authorized for this payment.");
  }
  if (
    paymentOrder.status === PAYMENT_ORDER_STATUS.CREATED &&
    isOrderExpired(paymentOrder)
  ) {
    await markOrderExpired(paymentOrder);
  }
  return paymentOrder;
};

const claimPaymentOrderForProcessing = async (
  paymentOrderId,
  userId,
  razorpayOrderId,
) => {
  const paymentOrder = await PaymentOrder.findById(paymentOrderId);
  if (!paymentOrder) {
    throw new PaymentServiceError(404, "Payment order not found.");
  }

  if (paymentOrder.userId.toString() !== userId.toString()) {
    throw new PaymentServiceError(403, "Not authorized for this payment.");
  }

  if (paymentOrder.razorpayOrderId !== razorpayOrderId) {
    throw new PaymentServiceError(400, "Order ID mismatch.");
  }

  if (paymentOrder.status === PAYMENT_ORDER_STATUS.PAID && paymentOrder.bookingId) {
    return { paymentOrder, alreadyPaid: true };
  }

  if (isOrderExpired(paymentOrder)) {
    await markOrderExpired(paymentOrder);
    throw new PaymentServiceError(
      400,
      "Payment order expired. Please start checkout again.",
    );
  }

  if (paymentOrder.status === PAYMENT_ORDER_STATUS.PROCESSING) {
    const stale =
      paymentOrder.processingAt &&
      Date.now() - paymentOrder.processingAt.getTime() >
        PAYMENT_PROCESSING_STALE_MS;

    if (!stale) {
      throw new PaymentServiceError(
        409,
        "Payment verification already in progress.",
      );
    }
  }

  if (
    paymentOrder.status !== PAYMENT_ORDER_STATUS.CREATED &&
    paymentOrder.status !== PAYMENT_ORDER_STATUS.PROCESSING
  ) {
    throw new PaymentServiceError(400, "Payment order is no longer valid.");
  }

  const claimed = await PaymentOrder.findOneAndUpdate(
    {
      _id: paymentOrder._id,
      status: {
        $in: [
          PAYMENT_ORDER_STATUS.CREATED,
          PAYMENT_ORDER_STATUS.PROCESSING,
        ],
      },
    },
    {
      $set: {
        status: PAYMENT_ORDER_STATUS.PROCESSING,
        processingAt: new Date(),
      },
    },
    { new: true },
  );

  if (!claimed) {
    throw new PaymentServiceError(
      409,
      "Could not lock payment order. Please retry.",
    );
  }

  return { paymentOrder: claimed, alreadyPaid: false };
};

const fulfillPaymentOrder = async (
  paymentOrder,
  razorpayPaymentId,
  user,
  fulfilledVia,
) => {
  await assertPaymentCapturedForOrder(paymentOrder, razorpayPaymentId);

  const prepared = await prepareBooking(user, {
    ...paymentOrder.bookingDraft,
    paymentMethod: "ONLINE",
  });

  if (Math.round(prepared.pricing.finalPrice * 100) !== paymentOrder.amountPaise) {
    throw new PaymentServiceError(400, "Booking price changed. Please retry checkout.");
  }

  const booking = await createBookingFromPrepared(prepared, {
    razorpayOrderId: paymentOrder.razorpayOrderId,
    razorpayPaymentId,
    paymentOrderId: paymentOrder._id,
  });

  paymentOrder.status = PAYMENT_ORDER_STATUS.PAID;
  paymentOrder.razorpayPaymentId = razorpayPaymentId;
  paymentOrder.bookingId = booking._id;
  paymentOrder.paidAt = new Date();
  paymentOrder.fulfilledVia = fulfilledVia;
  await paymentOrder.save();

  return booking;
};

const verifyAndFulfillBookingPayment = async (
  user,
  { paymentOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature },
) => {
  if (
    !paymentOrderId ||
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature
  ) {
    throw new PaymentServiceError(400, "Missing payment verification fields.");
  }

  let signatureValid = false;
  try {
    signatureValid = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    throw new PaymentServiceError(400, "Invalid payment signature.");
  }

  const { paymentOrder, alreadyPaid } = await claimPaymentOrderForProcessing(
    paymentOrderId,
    user._id,
    razorpayOrderId,
  );

  if (alreadyPaid) {
    return { paymentOrder, booking: null, duplicate: true };
  }

  try {
    const booking = await fulfillPaymentOrder(
      paymentOrder,
      razorpayPaymentId,
      user,
      "client_verify",
    );
    return { paymentOrder, booking, duplicate: false };
  } catch (error) {
    if (error instanceof RazorpayServiceError) {
      paymentOrder.status = PAYMENT_ORDER_STATUS.CREATED;
      paymentOrder.processingAt = undefined;
      await paymentOrder.save();
      throw new PaymentServiceError(error.status, error.message);
    }

    if (
      error instanceof PaymentServiceError ||
      error instanceof BookingServiceError
    ) {
      paymentOrder.status = PAYMENT_ORDER_STATUS.CREATED;
      paymentOrder.processingAt = undefined;
      await paymentOrder.save();
      throw error;
    }

    paymentOrder.status = PAYMENT_ORDER_STATUS.FAILED;
    paymentOrder.failedAt = new Date();
    paymentOrder.failureReason = error.message;
    await paymentOrder.save();
    throw error;
  }
};

const processWebhookEvent = async (event) => {
  const eventId = event?.id || `${event?.event}-${event?.created_at}`;
  if (!eventId) {
    throw new PaymentServiceError(400, "Invalid webhook payload.");
  }

  const existing = await WebhookEvent.findOne({ eventId });
  if (existing?.processed) {
    return { duplicate: true };
  }

  if (!existing) {
    await WebhookEvent.create({
      eventId,
      eventType: event.event,
      razorpayOrderId: event?.payload?.payment?.entity?.order_id,
      razorpayPaymentId: event?.payload?.payment?.entity?.id,
    });
  }

  if (event.event !== "payment.captured") {
    await WebhookEvent.findOneAndUpdate(
      { eventId },
      { processed: true, processedAt: new Date() },
    );
    return { handled: false, reason: "ignored_event_type" };
  }

  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id || !payment?.id) {
    throw new PaymentServiceError(400, "Incomplete payment webhook payload.");
  }

  const paymentOrder = await PaymentOrder.findOne({
    razorpayOrderId: payment.order_id,
  });

  if (!paymentOrder) {
    await WebhookEvent.findOneAndUpdate(
      { eventId },
      { processed: true, processedAt: new Date(), error: "order_not_found" },
    );
    return { handled: false, reason: "order_not_found" };
  }

  if (paymentOrder.status === PAYMENT_ORDER_STATUS.PAID && paymentOrder.bookingId) {
    await WebhookEvent.findOneAndUpdate(
      { eventId },
      { processed: true, processedAt: new Date() },
    );
    return { duplicate: true, bookingId: paymentOrder.bookingId };
  }

  const user = await require("../models/User").findById(paymentOrder.userId);
  if (!user) {
    throw new PaymentServiceError(404, "Payment order user not found.");
  }

  try {
    if (paymentOrder.status === PAYMENT_ORDER_STATUS.CREATED) {
      paymentOrder.status = PAYMENT_ORDER_STATUS.PROCESSING;
      paymentOrder.processingAt = new Date();
      await paymentOrder.save();
    }

    const booking = await fulfillPaymentOrder(
      paymentOrder,
      payment.id,
      user,
      "webhook",
    );

    await WebhookEvent.findOneAndUpdate(
      { eventId },
      { processed: true, processedAt: new Date() },
    );

    return { handled: true, bookingId: booking._id };
  } catch (error) {
    await WebhookEvent.findOneAndUpdate(
      { eventId },
      { processed: false, error: error.message },
    );
    throw error;
  }
};

module.exports = {
  PaymentServiceError,
  getPaymentConfig,
  createBookingPaymentOrder,
  getPaymentOrderForUser,
  verifyAndFulfillBookingPayment,
  processWebhookEvent,
  serializePaymentOrder,
};
