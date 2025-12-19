const mongoose = require('mongoose');

const barberSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true },
  avatar: String,
  startHour: { type: String, default: "10:00" }, 
  endHour: { type: String, default: "20:00" },
  breaks: [{
    startTime: String, // "14:00"
    endTime: String,   // "15:00"
    title: String
  }],
  isAvailable: { type: Boolean, default: true }
});

module.exports = mongoose.model('Barber', barberSchema);