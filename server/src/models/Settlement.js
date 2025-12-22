const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // The admin who processed it

  type: {
    type: String,
    enum: ['PAYOUT', 'COLLECTION'],
    required: true
  },
  // PAYOUT = Admin pays Shop
  // COLLECTION = Shop pays Admin

  amount: { type: Number, required: true }, // The net amount settled

  status: {
    type: String,
    enum: ['COMPLETED', 'PENDING', 'FAILED'],
    default: 'COMPLETED'
  },

  bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],

  dateRange: {
    start: Date,
    end: Date
  },

  notes: String
}, { timestamps: true });

module.exports = mongoose.model('Settlement', settlementSchema);
