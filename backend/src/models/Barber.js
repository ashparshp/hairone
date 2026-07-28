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
  // Weekly Schedule Overrides (Day specific)
  weeklySchedule: [{
    day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    isOpen: { type: Boolean, default: true },
    startHour: String,
    endHour: String,
    breaks: [{
      startTime: String,
      endTime: String
    }]
  }],
  // Special Holiday / Ad-hoc Hours
  specialHours: [{
    date: { type: String }, // "YYYY-MM-DD"
    isOpen: { type: Boolean, default: true },
    startHour: String,
    endHour: String,
    reason: String
  }],
  isAvailable: { type: Boolean, default: true }
});

module.exports = mongoose.model('Barber', barberSchema);