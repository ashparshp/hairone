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
const { creditWallet, WalletServiceError } = require("./walletService");

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
    applyWalletCredit: Boolean(draft.applyWalletCredit),
    walletCreditToUse: draft.walletCreditToUse ?? null,
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
};

const getAmountDuePaise = (pricing) =>
  Math.round((pricing.amountDue ?? pricing.finalPrice) * 100);

const creditCapturedPaymentToWallet = async (paymentOrder, note) => {
  if (paymentOrder.walletCreditedAt) {
    return paymentOrder.walletCreditedAmount || 0;
  }

  const creditAmount = paymentOrder.amountPaise / 100;
  if (creditAmount <= 0) return 0;

  const PaymentOrder = require("../models/PaymentOrder");
  const claimed = await PaymentOrder.findOneAndUpdate(
    {
      _id: paymentOrder._id,
      walletCreditedAt: { $exists: false },
    },
    {
      $set: {
        walletCreditedAt: new Date(),
        walletCreditedAmount: creditAmount,
      },
    },
    { new: true },
  );

  if (!claimed) {
    return paymentOrder.walletCreditedAmount || 0;
  }

  await creditWallet(paymentOrder.userId, creditAmount, {
    reason: "unfulfilled_payment",
    referenceType: "payment_order",
    referenceId: paymentOrder._id,
    note,
  });

  paymentOrder.walletCreditedAt = claimed.walletCreditedAt;
  paymentOrder.walletCreditedAmount = creditAmount;
  return creditAmount;
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
  const amountDuePaise = getAmountDuePaise(prepared.pricing);

  if (
    amountDuePaise === 0 &&
    (prepared.pricing.walletCreditApplied || 0) > 0
  ) {
    const balance = await require("./walletService").getWalletBalance(user._id);
    if (balance < prepared.pricing.walletCreditApplied) {
      throw new PaymentServiceError(400, "Insufficient account credit.");
    }
    const booking = await createBookingFromPrepared(prepared, {});
    return {
      walletOnly: true,
      booking,
      prepared,
      paymentOrder: null,
      reused: false,
    };
  }

  if (amountDuePaise < MIN_AMOUNT_PAISE) {
    if (amountDuePaise > 0) {
      throw new PaymentServiceError(
        400,
        "Remaining amount is below ₹1 minimum for online payment. Use more account credit or pay the full amount online.",
      );
    }
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
    if (getAmountDuePaise(prepared.pricing) !== existing.amountPaise) {
      existing.status = PAYMENT_ORDER_STATUS.EXPIRED;
      await existing.save();
    } else {
      return {
        paymentOrder: existing,
        prepared,
        reused: true,
        walletOnly: false,
      };
    }
  }

  try {
    const referenceId = generateReferenceId();
    const razorpayOrder = await createOrder({
      amountPaise: amountDuePaise,
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
        amountPaise: amountDuePaise,
        currency: razorpayOrder.currency || "INR",
        status: PAYMENT_ORDER_STATUS.CREATED,
        bookingDraft: {
          ...bookingDraft,
          applyWalletCredit: false,
          walletCreditToUse: prepared.pricing.walletCreditApplied || 0,
        },
        pricing: prepared.pricing,
        expiresAt,
      });

      return { paymentOrder, prepared, reused: false, walletOnly: false };
    } catch (createError) {
      if (createError?.code === 11000) {
        const raced = await PaymentOrder.findOne({
          userId: user._id,
          fingerprint,
          status: PAYMENT_ORDER_STATUS.CREATED,
          expiresAt: { $gt: new Date() },
        });
        if (raced) {
          return { paymentOrder: raced, prepared, reused: true, walletOnly: false };
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

const isProcessingLockStale = (paymentOrder) =>
  !paymentOrder.processingAt ||
  Date.now() - paymentOrder.processingAt.getTime() >
    PAYMENT_PROCESSING_STALE_MS;

const tryClaimPaymentOrderForFulfillment = async (paymentOrder) => {
  if (
    paymentOrder.status === PAYMENT_ORDER_STATUS.PAID &&
    paymentOrder.bookingId
  ) {
    return { paymentOrder, alreadyPaid: true, locked: false };
  }

  if (
    paymentOrder.status === PAYMENT_ORDER_STATUS.CREATED &&
    isOrderExpired(paymentOrder)
  ) {
    await markOrderExpired(paymentOrder);
    throw new PaymentServiceError(
      400,
      "Payment order expired. Please start checkout again.",
    );
  }

  if (paymentOrder.status === PAYMENT_ORDER_STATUS.PROCESSING) {
    if (!isProcessingLockStale(paymentOrder)) {
      return { paymentOrder, alreadyPaid: false, locked: true };
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
      bookingId: { $exists: false },
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
    const refreshed = await PaymentOrder.findById(paymentOrder._id);
    if (
      refreshed?.status === PAYMENT_ORDER_STATUS.PAID &&
      refreshed.bookingId
    ) {
      return { paymentOrder: refreshed, alreadyPaid: true, locked: false };
    }
    return {
      paymentOrder: refreshed || paymentOrder,
      alreadyPaid: false,
      locked: true,
    };
  }

  return { paymentOrder: claimed, alreadyPaid: false, locked: false };
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

  const claim = await tryClaimPaymentOrderForFulfillment(paymentOrder);
  if (claim.locked) {
    throw new PaymentServiceError(
      409,
      "Payment verification already in progress.",
    );
  }
  return claim;
};

const applyPricingSnapshot = (prepared, snapshot) => {
  if (!snapshot) return prepared;

  prepared.pricing.walletCreditApplied = snapshot.walletCreditApplied || 0;
  prepared.pricing.amountDue =
    snapshot.amountDue ?? snapshot.finalPrice ?? prepared.pricing.finalPrice;

  return prepared;
};

const fulfillPaymentOrder = async (
  paymentOrder,
  razorpayPaymentId,
  user,
  fulfilledVia,
) => {
  if (paymentOrder.bookingId) {
    const existingBooking = await require("../models/Booking").findById(
      paymentOrder.bookingId,
    );
    if (existingBooking) return existingBooking;
  }

  await assertPaymentCapturedForOrder(paymentOrder, razorpayPaymentId);

  if (!paymentOrder.razorpayPaymentId) {
    paymentOrder.razorpayPaymentId = razorpayPaymentId;
    await paymentOrder.save();
  } else if (paymentOrder.razorpayPaymentId !== razorpayPaymentId) {
    throw new PaymentServiceError(400, "Payment ID mismatch.");
  }

  const {
    applyWalletCredit: _applyWalletCredit,
    walletCreditToUse: _walletCreditToUse,
    ...bookingDraftForPrepare
  } = paymentOrder.bookingDraft;

  const prepared = await prepareBooking(user, {
    ...bookingDraftForPrepare,
    paymentMethod: "ONLINE",
  });

  applyPricingSnapshot(prepared, paymentOrder.pricing);

  if (
    Math.round(
      (prepared.pricing.amountDue ?? prepared.pricing.finalPrice) * 100,
    ) !== paymentOrder.amountPaise
  ) {
    throw new PaymentServiceError(400, "Booking price changed. Please retry checkout.");
  }

  if ((prepared.pricing.walletCreditApplied || 0) > 0) {
    const balance = await require("./walletService").getWalletBalance(
      paymentOrder.userId,
    );
    if (balance < prepared.pricing.walletCreditApplied) {
      throw new PaymentServiceError(
        400,
        "Insufficient account credit for this payment order. Please start checkout again.",
      );
    }
  }

  const booking = await createBookingFromPrepared(prepared, {
    razorpayOrderId: paymentOrder.razorpayOrderId,
    razorpayPaymentId,
    paymentOrderId: paymentOrder._id,
  }).catch(async (error) => {
    if (error?.code === 11000) {
      const existingBooking = await require("../models/Booking").findOne({
        paymentOrderId: paymentOrder._id,
      });
      if (existingBooking) return existingBooking;
    }
    throw error;
  });

  paymentOrder.status = PAYMENT_ORDER_STATUS.PAID;
  paymentOrder.razorpayPaymentId = razorpayPaymentId;
  paymentOrder.bookingId = booking._id;
  paymentOrder.paidAt = new Date();
  paymentOrder.fulfilledVia = fulfilledVia;
  paymentOrder.failureReason = undefined;
  await paymentOrder.save();

  return booking;
};

const handleFulfillmentError = async (paymentOrder, error) => {
  const paymentCaptured = Boolean(paymentOrder.razorpayPaymentId);

  if (error instanceof RazorpayServiceError || !paymentCaptured) {
    paymentOrder.status = PAYMENT_ORDER_STATUS.CREATED;
    paymentOrder.processingAt = undefined;
    paymentOrder.failureReason = undefined;
  } else if (paymentCaptured) {
    const credited = await creditCapturedPaymentToWallet(
      paymentOrder,
      error?.message || "Booking could not be completed.",
    );
    paymentOrder.status = PAYMENT_ORDER_STATUS.FAILED;
    paymentOrder.failedAt = new Date();
    paymentOrder.failureReason =
      credited > 0
        ? `booking_failed: ₹${credited} credited to your account`
        : `booking_failed: ${error?.message || "Booking could not be completed."}`;
    paymentOrder.processingAt = undefined;
  } else {
    paymentOrder.status = PAYMENT_ORDER_STATUS.FAILED;
    paymentOrder.failedAt = new Date();
    paymentOrder.failureReason = error?.message || "Payment failed.";
    paymentOrder.processingAt = undefined;
  }

  await paymentOrder.save();
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
    await handleFulfillmentError(paymentOrder, error);

    if (error instanceof RazorpayServiceError) {
      throw new PaymentServiceError(error.status, error.message);
    }

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

  const claim = await tryClaimPaymentOrderForFulfillment(paymentOrder);
  if (claim.alreadyPaid) {
    await WebhookEvent.findOneAndUpdate(
      { eventId },
      { processed: true, processedAt: new Date() },
    );
    return { duplicate: true, bookingId: claim.paymentOrder.bookingId };
  }

  if (claim.locked) {
    await WebhookEvent.findOneAndUpdate(
      { eventId },
      { processed: false, error: "fulfillment_in_progress" },
    );
    return { handled: false, reason: "fulfillment_in_progress" };
  }

  try {
    const booking = await fulfillPaymentOrder(
      claim.paymentOrder,
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
    await handleFulfillmentError(claim.paymentOrder, error);
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
