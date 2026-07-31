const RateLimit = require("../models/RateLimit");

const checkRateLimit = async (key, maxAttempts, windowMs) => {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  const active = await RateLimit.findOneAndUpdate(
    { key, resetAt: { $gt: now } },
    { $inc: { count: 1 } },
    { returnDocument: 'after' },
  );

  if (active) {
    return active.count <= maxAttempts;
  }

  await RateLimit.findOneAndUpdate(
    { key },
    { $set: { count: 1, resetAt } },
    { upsert: true },
  );

  return true;
};

module.exports = {
  checkRateLimit,
};
