const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for blocked slots
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  barberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Barber', required: true },
  serviceNames: [String],
  totalPrice: Number,
  totalDuration: Number,
  
  date: { type: String, required: true }, // "YYYY-MM-DD"
  startTime: { type: String, required: true }, // "14:30"
  endTime: { type: String, required: true },
  
  status: { type: String, enum: ['upcoming', 'completed', 'cancelled', 'pending', 'blocked', 'no-show', 'checked-in'], default: 'upcoming' },
  type: { type: String, enum: ['online', 'walk-in', 'blocked'], default: 'online' },
  paymentMethod: { type: String, default: 'PAY_AT_VENUE' },
  bookingKey: String,
  notes: String, // For blocking reason or special requests

  // Financials
  originalPrice: Number,      // Base Price (Sum of services)
  discountAmount: Number,     // Discount given to user
  finalPrice: Number,         // What user actually pays

  adminCommission: Number,    // Gross commission (e.g. 10% of original)
  adminNetRevenue: Number,    // Commission - Discount
  barberNetRevenue: Number,   // Original - Commission

  amountCollectedBy: { type: String, enum: ['BARBER', 'ADMIN'], default: 'BARBER' },
  settlementStatus: { type: String, enum: ['PENDING', 'SETTLED', 'PARTIAL'], default: 'PENDING' }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);