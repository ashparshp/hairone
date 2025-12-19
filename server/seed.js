const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Shop = require('./src/models/Shop'); 
const Barber = require('./src/models/Barber');
const User = require('./src/models/User');

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hairone');
    console.log('Connected to DB...');

    // 1. Create Owner
    const owner = await User.create({
        phone: '9999999999',
        role: 'owner',
        name: 'John Owner'
    });

    // 2. Create Admin (NEW)
    const admin = await User.create({
        phone: '8888888888',
        role: 'admin',
        name: 'Super Admin'
    });

    // 3. Create Shop
    const shop = await Shop.create({
      ownerId: owner._id,
      name: "Gentleman's Cut",
      address: "12 MG Road, Indiranagar, Bangalore",
      image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800",
      rating: 4.8,
      services: [
        { name: "Classic Haircut", price: 350, duration: 30 },
        { name: "Beard Trim", price: 150, duration: 20 },
        { name: "Skin Fade", price: 500, duration: 45 }
      ]
    });

    // 4. Create Barbers
    const barbers = [
      { name: "Sam", startHour: "10:00", endHour: "20:00", breaks: [{ startTime: "13:00", endTime: "14:00" }] },
      { name: "Rahul", startHour: "11:00", endHour: "21:00", breaks: [{ startTime: "15:00", endTime: "16:00" }] },
      { name: "Mike", startHour: "09:00", endHour: "18:00", breaks: [{ startTime: "12:00", endTime: "13:00" }] }
    ];

    for (const b of barbers) {
      await Barber.create({ ...b, shopId: shop._id });
    }

    await User.findByIdAndUpdate(owner._id, { myShopId: shop._id });

    console.log('✅ Database Seeded!');
    console.log('👉 Owner Login: 9999999999');
    console.log('👉 Admin Login: 8888888888');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedData();