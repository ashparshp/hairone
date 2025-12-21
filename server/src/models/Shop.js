const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  coordinates: { lat: Number, lng: Number },
  image: String,
  type: { type: String, enum: ['male', 'female', 'unisex'], default: 'unisex' },
  rating: { type: Number, default: 0 },
  services: [{
    name: String,
    price: Number,
    duration: Number, // minutes
    isAvailable: { type: Boolean, default: true }
  }],
  // Scheduling Settings
  bufferTime: { type: Number, default: 0 }, // Minutes between bookings
  minBookingNotice: { type: Number, default: 60 }, // Minutes before booking
  maxBookingNotice: { type: Number, default: 30 }, // Days in advance
  autoApproveBookings: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Shop', shopSchema);