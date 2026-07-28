const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, enum: ["credit", "debit"], required: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    reason: {
      type: String,
      enum: [
        "unfulfilled_payment",
        "booking_payment",
        "booking_cancellation",
        "admin_adjustment",
      ],
      required: true,
    },
    referenceType: {
      type: String,
      enum: ["payment_order", "booking"],
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    note: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);
