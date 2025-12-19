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
  }]
});

module.exports = mongoose.model('Shop', shopSchema);