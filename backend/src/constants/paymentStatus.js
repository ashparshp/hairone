/**
 * Internal payment order lifecycle (HairOne PaymentOrder document).
 *
 * created    → Razorpay order created, awaiting customer payment
 * processing → verify/fulfillment in progress (short-lived lock)
 * paid       → payment captured and booking confirmed
 * expired    → TTL elapsed without successful payment
 * failed     → payment failed or verification rejected
 * refunded   → captured payment later refunded at gateway (ops/external only)
 *
 * Refund policy: HairOne returns value via wallet credit, not Razorpay refunds.
 * Do not gateway-refund amounts that were (or will be) credited to wallet.
 */
const PAYMENT_ORDER_STATUS = Object.freeze({
  CREATED: "created",
  PROCESSING: "processing",
  PAID: "paid",
  EXPIRED: "expired",
  FAILED: "failed",
  REFUNDED: "refunded",
});

/** Dispute lifecycle mirrored from Razorpay payment.dispute.* webhooks */
const PAYMENT_DISPUTE_STATUS = Object.freeze({
  OPEN: "open",
  UNDER_REVIEW: "under_review",
  ACTION_REQUIRED: "action_required",
  WON: "won",
  LOST: "lost",
  CLOSED: "closed",
});

/** How long a customer has to complete checkout after order creation. */
const PAYMENT_ORDER_TTL_MINUTES = 15;

/** Re-claim a stuck processing lock after this duration. */
const PAYMENT_PROCESSING_STALE_MS = 3 * 60 * 1000;

/** Minimum charge in paise (₹1). */
const MIN_AMOUNT_PAISE = 100;

module.exports = {
  PAYMENT_ORDER_STATUS,
  PAYMENT_DISPUTE_STATUS,
  PAYMENT_ORDER_TTL_MINUTES,
  PAYMENT_PROCESSING_STALE_MS,
  MIN_AMOUNT_PAISE,
};
