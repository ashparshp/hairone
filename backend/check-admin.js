require('dotenv').config({ path: 'backend/.env' });
const mongoose = require('mongoose');
const User = require('./src/models/User');
const {
  normalizeIndianPhone,
  phoneLookupVariants,
} = require('./src/utils/phoneUtils');

const uri = process.env.MONGO_URI;
const TARGET = normalizeIndianPhone('9999999999');

(async () => {
  try {
    console.log('Connecting to DB...');
    await mongoose.connect(uri);
    console.log('Connected');

    const variants = phoneLookupVariants(TARGET);
    const matches = await User.find({ phone: { $in: variants } });

    if (matches.length === 0) {
      console.log('No users found for target phone variants');
      return;
    }

    const admin =
      matches.find((u) => u.role === 'admin') ||
      matches.sort((a, b) => a.createdAt - b.createdAt)[0];

    for (const user of matches) {
      if (user._id.equals(admin._id)) continue;
      console.log(`Deleting duplicate user ${user._id} phone=${user.phone}`);
      await User.findByIdAndDelete(user._id);
    }

    if (admin.phone !== TARGET || admin.role !== 'admin') {
      admin.phone = TARGET;
      admin.role = 'admin';
      await admin.save();
      console.log(`Canonicalized admin ${admin._id} → ${TARGET}`);
    } else {
      console.log(`Admin already canonical: ${TARGET}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Connection closed.');
  }
})();