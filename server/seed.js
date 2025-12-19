const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./src/models/User');

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hairone');
    console.log('Connected to DB...');

    const adminPhone = '8887666687';

    // 1. Check if the admin already exists
    const existingAdmin = await User.findOne({ phone: adminPhone });

    if (existingAdmin) {
      console.log('⚠️ Admin already exists. Updating details instead...');
      existingAdmin.role = 'admin';
      existingAdmin.name = 'Super Admin';
      await existingAdmin.save();
    } else {
      // 2. Create Admin if not exists
      await User.create({
          phone: adminPhone,
          role: 'admin',
          name: 'Super Admin'
      });
      console.log('✅ Admin user created!');
    }

    console.log('✅ Database Seeded!');
    console.log(`👉 Admin Login: ${adminPhone}`);
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedData();