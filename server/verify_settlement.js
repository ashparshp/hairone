const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { runSettlementJob } = require('./src/jobs/settlementJob');
const Booking = require('./src/models/Booking');
const Shop = require('./src/models/Shop');
const Barber = require('./src/models/Barber');
const { subWeeks, format } = require('date-fns');

let replSet;

const verify = async () => {
    try {
        // Start In-Memory Replica Set (Required for Transactions)
        replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
        const uri = replSet.getUri();

        await mongoose.connect(uri);
        console.log("Connected to In-Memory DB (Replica Set)");

        // 1. Create Mock Data
        const shop = await Shop.create({
             name: "Test Shop",
             address: "123 Test St",
             coordinates: { lat: 0, lng: 0 },
             type: 'unisex',
             ownerId: new mongoose.Types.ObjectId()
        });

        const barber = await Barber.create({
             shopId: shop._id,
             name: "Test Barber",
             userId: new mongoose.Types.ObjectId()
        });

        // 2. Create a "Past" Booking that needs settlement
        const pastDate = format(subWeeks(new Date(), 2), 'yyyy-MM-dd');

        console.log(`Creating mock booking for date: ${pastDate}`);

        const mockBooking = await Booking.create({
            shopId: shop._id,
            barberId: barber._id,
            serviceNames: ['Test Service'],
            totalPrice: 100,
            totalDuration: 30,
            date: pastDate,
            startTime: '10:00',
            endTime: '10:30',
            status: 'completed',
            settlementStatus: 'PENDING',

            // Financials
            adminCommission: 10,
            adminNetRevenue: 10,  // Shop owes Admin 10
            barberNetRevenue: 90, // Admin owes Shop 90

            paymentMethod: 'CASH',
            amountCollectedBy: 'BARBER'
        });

        console.log(`Created Booking ID: ${mockBooking._id}`);

        // 3. Run the Job
        console.log(">>> Running Settlement Job...");
        const result = await runSettlementJob();
        console.log("Result:", result);

        // 4. Verify Settlement Created
        const settlement = await mongoose.model('Settlement').findOne({
            bookings: mockBooking._id
        });

        if (settlement) {
            console.log("✅ SUCCESS: Settlement created!");
            console.log(`   Type: ${settlement.type} (Expected: COLLECTION)`);
            console.log(`   Amount: ${settlement.amount} (Expected: 10)`);

            if (settlement.type === 'COLLECTION' && settlement.amount === 10) {
                 console.log("   --> Data Verified Correctly.");
            } else {
                 console.log("   --> ⚠️ Data Mismatch.");
            }
        } else {
            console.error("❌ FAILURE: No settlement found for the booking.");
        }

    } catch (e) {
        console.error("Verification Failed:", e);
    } finally {
        await mongoose.disconnect();
        if (replSet) await replSet.stop();
    }
};

verify();
