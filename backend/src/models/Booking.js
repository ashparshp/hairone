const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Optional for blocked slots
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    barberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      required: true,
    },
    serviceNames: [String],
    totalPrice: Number,
    totalDuration: Number,

    date: { type: String, required: true }, // "YYYY-MM-DD"
    startTime: { type: String, required: true }, // "14:30"
    endTime: { type: String, required: true },
    startAt: { type: Date },
    endAt: { type: Date },
    activeBooking: { type: Boolean, default: true },
    occupiedSlotKeys: [String],

    status: {
      type: String,
      enum: [
        "upcoming",
        "completed",
        "cancelled",
        "pending",
        "blocked",
        "no-show",
        "checked-in",
        "missed",
      ],
      default: "upcoming",
    },
    type: {
      type: String,
      enum: ["online", "walk-in", "blocked"],
      default: "online",
    },
    paymentMethod: { type: String, default: "CASH" },
    paymentOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentOrder",
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    bookingKey: String,
    isRated: { type: Boolean, default: false },
    notes: String, // For blocking reason or special requests

    // Financials
    originalPrice: Number, // Base Price (Sum of services)
    discountAmount: Number, // Discount given to user
    finalPrice: Number, // What user actually pays
    walletCreditApplied: { type: Number, default: 0 },
    amountDue: Number,
    cancelWalletCreditedAt: Date,
    cancelWalletCreditAmount: Number,

    adminCommission: Number, // Gross commission (e.g. 10% of original)
    adminNetRevenue: Number, // Commission - Discount
    barberNetRevenue: Number, // Original - Commission

    amountCollectedBy: {
      type: String,
      enum: ["BARBER", "ADMIN"],
      default: "BARBER",
    },
    settlementStatus: {
      type: String,
      enum: ["PENDING", "SETTLING", "SETTLED", "PARTIAL"],
      default: "PENDING",
    },
    settlementId: { type: mongoose.Schema.Types.ObjectId, ref: "Settlement" },
  },
  { timestamps: true },
);

// Atomic overlap guard: any shared 15-minute bucket for the same barber conflicts.
bookingSchema.index(
  { barberId: 1, occupiedSlotKeys: 1 },
  {
    unique: true,
    partialFilterExpression: { activeBooking: true },
  },
);

bookingSchema.index(
  { paymentOrderId: 1 },
  { unique: true, sparse: true },
);

module.exports = mongoose.model("Booking", bookingSchema);
