
const mongoose = require('mongoose');
const Shop = require('./server/src/models/Shop');

async function testShopUpdateAndSearch() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hairone_test';

  try {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGO_URI);
    }

    // 1. Create a dummy user for owner (skipped, assuming existing or just mocking req)
    // 2. Create a dummy shop
    const shop = await Shop.create({
        ownerId: new mongoose.Types.ObjectId(),
        name: "Home Service Test Shop",
        address: "123 Test St",
        coordinates: { lat: 10, lng: 10 },
        homeService: {
            isAvailable: true,
            radiusKm: 10,
            travelFee: 50,
            minOrderValue: 100
        }
    });

    console.log("Shop Created:", shop.homeService);

    // 3. Simulate Search Logic (simplified from controller)
    const userLat = 10.05; // ~5.5km away
    const userLng = 10.05;

    const dist = calculateDistance(userLat, userLng, shop.coordinates.lat, shop.coordinates.lng);
    console.log("Distance:", dist.toFixed(2), "km");

    if (shop.homeService.isAvailable && dist <= shop.homeService.radiusKm) {
        console.log("PASS: Shop found within radius.");
    } else {
        console.log("FAIL: Shop should be found.");
    }

    // 4. Test Update Logic (Simulate Controller Logic)
    const updates = {};
    const reqBodyHomeService = { radiusKm: 20, travelFee: 60 };
    for (const [key, value] of Object.entries(reqBodyHomeService)) {
        updates[`homeService.${key}`] = value;
    }

    const updatedShop = await Shop.findByIdAndUpdate(shop._id, updates, { new: true });
    console.log("Updated Shop:", updatedShop.homeService);

    if (updatedShop.homeService.radiusKm === 20 && updatedShop.homeService.travelFee === 60) {
        console.log("PASS: Update worked.");
    } else {
        console.log("FAIL: Update failed.");
    }

    await Shop.findByIdAndDelete(shop._id);
    await mongoose.disconnect();

  } catch (e) {
    console.error(e);
  }
}

// Helper
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

testShopUpdateAndSearch();
