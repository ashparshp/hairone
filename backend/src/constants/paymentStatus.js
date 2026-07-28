/**
 * Internal payment order lifecycle (HairOne PaymentOrder document).
 *
 * created    → Razorpay order created, awaiting customer payment
 * processing → verify/fulfillment in progress (short-lived lock)
 * paid       → payment captured and booking confirmed
 * expired    → TTL elapsed without successful payment
 * failed     → payment failed or verification rejected
 */
const PAYMENT_ORDER_STATUS = Object.freeze({
  CREATED: "created",
  PROCESSING: "processing",
  PAID: "paid",
  EXPIRED: "expired",
  FAILED: "failed",
});

/** How long a customer has to complete checkout after order creation. */
const PAYMENT_ORDER_TTL_MINUTES = 15;

/** Re-claim a stuck processing lock after this duration. */
const PAYMENT_PROCESSING_STALE_MS = 3 * 60 * 1000;

/** Minimum charge in paise (₹1). */
const MIN_AMOUNT_PAISE = 100;

module.exports = {
  PAYMENT_ORDER_STATUS,
  PAYMENT_ORDER_TTL_MINUTES,
  PAYMENT_PROCESSING_STALE_MS,
  MIN_AMOUNT_PAISE,
};
