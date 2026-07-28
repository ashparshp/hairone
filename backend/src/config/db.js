const mongoose = require('mongoose');
const { syncBookingSlotIndexes } = require('../services/bookingSlotMigration');
const { warn, info, error } = require('../utils/logger');

const connectDB = async () => {
  mongoose.connection.on('disconnected', () => {
    warn('MongoDB disconnected — attempting to reconnect');
  });

  mongoose.connection.on('reconnected', () => {
    info('MongoDB reconnected');
  });

  mongoose.connection.on('error', (err) => {
    error('MongoDB connection error', err);
  });

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hairone');
    await syncBookingSlotIndexes();
    return conn.connection.host;
  } catch (err) {
    error('Database connection failed', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
