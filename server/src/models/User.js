const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String },
  email: { type: String },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }],
  
  role: { type: String, enum: ['user', 'admin', 'owner'], default: 'user' },
  myShopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }, // If owner
  
  isPremium: { type: Boolean, default: false },
  
  businessName: { type: String },
  applicationStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);