const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'global' }, // Singleton
  adminCommissionRate: { type: Number, default: 10 }, // %
  userDiscountRate: { type: Number, default: 0 }, // %
  isPaymentTestMode: { type: Boolean, default: false },
  maxCashBookingsPerMonth: { type: Number, default: 5 }
}, { timestamps: true });

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
