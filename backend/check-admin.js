require('dotenv').config({ path: 'backend/.env' });
const mongoose = require('mongoose');
const User = require('./src/models/User');

const uri = process.env.MONGO_URI;

(async () => {
  try {
    console.log('Connecting to DB...');
    await mongoose.connect(uri);
    console.log('✅ Connected!');

    // 1. Delete the accidental "User" created by the login attempt
    const wrongUser = await User.findOne({ phone: "9999999999" });
    if (wrongUser) {
      if (wrongUser.role !== 'admin') {
        console.log(`🗑️  Found accidental user (${wrongUser._id}). Deleting...`);
        await User.findByIdAndDelete(wrongUser._id);
        console.log('   Deleted.');
      } else {
        console.log('ℹ️  User 9999999999 is already Admin. No delete needed.');
      }
    }

    // 2. Update the "Admin" to have the 10-digit phone number
    const adminUser = await User.findOne({ phone: "+919999999999" });
    if (adminUser) {
      console.log(`🔄 Found Admin with +91 format (${adminUser._id}). Updating...`);
      adminUser.phone = "9999999999"; // Remove +91 to match Frontend
      await adminUser.save();
      console.log('✅ Admin phone updated to 9999999999');
    } else {
      console.log('⚠️  Could not find Admin with +919999999999');
      // Check if they are already fixed
      const fixedAdmin = await User.findOne({ phone: "9999999999", role: "admin" });
      if (fixedAdmin) console.log("   Good news: Admin is already set correctly.");
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Connection closed.');
  }
})();