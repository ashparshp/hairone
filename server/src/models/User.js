const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String },
  role: { type: String, enum: ['user', 'admin', 'owner'], default: 'user' },
  myShopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }, // If owner
  
  isPremium: { type: Boolean, default: false },
  
  applicationStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);