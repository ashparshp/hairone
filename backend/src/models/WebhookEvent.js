const mongoose = require("mongoose");

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    eventType: { type: String, required: true },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    processed: { type: Boolean, default: false },
    processedAt: Date,
    error: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("WebhookEvent", webhookEventSchema);
