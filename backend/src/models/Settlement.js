const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // The admin who processed/triggered it

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
    enum: ['GENERATED', 'PENDING_PAYOUT', 'PENDING_COLLECTION', 'COMPLETED', 'FAILED'],
    default: 'GENERATED'
  },

  bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],

  dateRange: {
    start: Date,
    end: Date
  },

  generatedAt: { type: Date, default: Date.now },
  paymentLink: String, // For Collections
  transactionId: String, // For manual record keeping

  notes: String
}, { timestamps: true });

module.exports = mongoose.model('Settlement', settlementSchema);
