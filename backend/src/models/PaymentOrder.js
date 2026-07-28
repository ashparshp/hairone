const mongoose = require("mongoose");
const { PAYMENT_ORDER_STATUS } = require("../constants/paymentStatus");

const pricingSnapshotSchema = new mongoose.Schema(
  {
    originalPrice: Number,
    discountAmount: Number,
    finalPrice: Number,
    walletCreditApplied: Number,
    amountDue: Number,
    adminCommission: Number,
    adminNetRevenue: Number,
    barberNetRevenue: Number,
    collectedBy: String,
  },
  { _id: false },
);

const paymentOrderSchema = new mongoose.Schema(
  {
    referenceId: {
      type: String,
      required: true,
      unique: true,
      maxlength: 40,
    },
    fingerprint: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
    },
    amountPaise: { type: Number, required: true },
    currency: { type: String, default: "INR", enum: ["INR"] },
    status: {
      type: String,
      enum: Object.values(PAYMENT_ORDER_STATUS),
      default: PAYMENT_ORDER_STATUS.CREATED,
      index: true,
    },
    bookingDraft: { type: mongoose.Schema.Types.Mixed, required: true },
    pricing: { type: pricingSnapshotSchema, required: true },
    razorpayPaymentId: { type: String, sparse: true, unique: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    expiresAt: { type: Date, required: true, index: true },
    processingAt: Date,
    paidAt: Date,
    failedAt: Date,
    failureReason: String,
    walletCreditedAt: Date,
    walletCreditedAmount: Number,
    fulfilledVia: {
      type: String,
      enum: ["client_verify", "webhook"],
    },
  },
  { timestamps: true },
);

paymentOrderSchema.index(
  { userId: 1, fingerprint: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: PAYMENT_ORDER_STATUS.CREATED },
  },
);

module.exports = mongoose.model("PaymentOrder", paymentOrderSchema);
