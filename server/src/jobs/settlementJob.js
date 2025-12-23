const cron = require('node-cron');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Settlement = require('../models/Settlement');
const Shop = require('../models/Shop');
const { startOfWeek, format } = require('date-fns');

// --- Helper: Round to 2 decimals ---
const roundMoney = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// --- The Core Logic ---
const runSettlementJob = async (manualAdminId = null) => {
  console.log('--- STARTING SETTLEMENT JOB ---');
  let settlementCount = 0;

  // Use a transaction for safety
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1. Define the "Cutoff Date"
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
    const cutoffDateStr = format(currentWeekStart, 'yyyy-MM-dd');

    console.log(`Searching for unsettled completed bookings before: ${cutoffDateStr}`);

    // 2. Aggregation: Group by Shop and Calculate Net Balance
    // This scales to millions of records by letting MongoDB do the heavy lifting
    const settlementGroups = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          $or: [
              { settlementStatus: 'PENDING' },
              { settlementStatus: { $exists: false } }
          ],
          date: { $lt: cutoffDateStr }
        }
      },
      {
        $group: {
          _id: '$shopId',
          bookings: { $push: '$_id' },
          minDate: { $min: '$date' },
          maxDate: { $max: '$date' },
          totalAdminNet: {
            $sum: {
              $cond: [
                { $or: [{ $eq: ['$paymentMethod', 'CASH'] }, { $eq: ['$paymentMethod', 'cash'] }] },
                '$adminNetRevenue', // If Cash, Shop owes Admin
                0
              ]
            }
          },
          totalBarberNet: {
            $sum: {
              $cond: [
                { $not: { $or: [{ $eq: ['$paymentMethod', 'CASH'] }, { $eq: ['$paymentMethod', 'cash'] }] } },
                '$barberNetRevenue', // If Online, Admin owes Shop
                0
              ]
            }
          }
        }
      }
    ]).session(session);

    if (settlementGroups.length === 0) {
        console.log("No pending bookings found for settlement.");
        await session.abortTransaction();
        return { message: "No pending bookings found.", count: 0 };
    }

    console.log(`Found ${settlementGroups.length} shops with pending settlements.`);

    // 3. Process Each Group
    for (const group of settlementGroups) {
        const shopId = group._id;
        const bookingIds = group.bookings;

        // Calculate Net
        const rawNet = group.totalBarberNet - group.totalAdminNet;
        const netAmount = roundMoney(rawNet);

        let type = 'PAYOUT';
        let finalAmount = netAmount;

        if (netAmount < 0) {
            type = 'COLLECTION';
            finalAmount = Math.abs(netAmount);
        }

        // Create Settlement
        const [settlement] = await Settlement.create([{
            shopId,
            adminId: manualAdminId,
            type,
            amount: finalAmount,
            status: type === 'PAYOUT' ? 'PENDING_PAYOUT' : 'PENDING_COLLECTION',
            bookings: bookingIds,
            dateRange: {
                start: new Date(group.minDate),
                end: new Date(group.maxDate)
            },
            notes: `Auto-generated settlement for ${bookingIds.length} bookings via Aggregation.`
        }], { session });

        // Update Bookings
        await Booking.updateMany(
            { _id: { $in: bookingIds } },
            {
                $set: {
                    settlementStatus: 'SETTLED',
                    settlementId: settlement._id
                }
            },
            { session }
        );

        settlementCount++;
    }

    await session.commitTransaction();
    console.log(`--- SETTLEMENT JOB COMPLETE: Processed ${settlementCount} shops ---`);
    return { message: "Settlement job complete.", count: settlementCount };

  } catch (err) {
    console.error("Error in Settlement Job:", err);
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// --- Initialization ---
const initializeCron = () => {
  // Schedule: Daily at 00:00 (Midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('Running Scheduled Settlement Job...');
    await runSettlementJob();
  });

  console.log("📅 Settlement Cron Job Scheduled (Daily at Midnight)");
};

module.exports = {
    runSettlementJob,
    initializeCron
};
