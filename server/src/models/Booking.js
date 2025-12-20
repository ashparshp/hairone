const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  barberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Barber', required: true },
  serviceNames: [String],
  totalPrice: Number,
  totalDuration: Number,
  
  date: { type: String, required: true }, // "YYYY-MM-DD"
  startTime: { type: String, required: true }, // "14:30"
  endTime: { type: String, required: true },
  
  status: { type: String, enum: ['upcoming', 'completed', 'cancelled', 'no-show'], default: 'upcoming' },
  paymentMethod: { type: String, default: 'PAY_AT_VENUE' },
  bookingKey: String
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);