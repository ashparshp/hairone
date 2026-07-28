const mongoose = require("mongoose");

const rateLimitSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    resetAt: { type: Date, required: true },
  },
  { timestamps: true },
);

rateLimitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RateLimit", rateLimitSchema);
