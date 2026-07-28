const mongoose = require("mongoose");

const paymentOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    razorpayOrderId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["pending", "paid", "expired", "failed"],
      default: "pending",
    },
    bookingDraft: { type: mongoose.Schema.Types.Mixed, required: true },
    pricing: {
      originalPrice: Number,
      discountAmount: Number,
      finalPrice: Number,
    },
    razorpayPaymentId: String,
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

paymentOrderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PaymentOrder", paymentOrderSchema);
