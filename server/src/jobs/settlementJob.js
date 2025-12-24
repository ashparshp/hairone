const cron = require('node-cron');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Settlement = require('../models/Settlement');
const Shop = require('../models/Shop');
const { startOfWeek, format } = require('date-fns');

/**
 * =================================================================================================
 * SETTLEMENT JOB (CRON)
 * =================================================================================================
 *
 * Purpose:
 * This file handles the automated reconciliation of finances between the Admin and the Shops.
 * Since bookings happen continuously, we need a periodic process to "close the books" for past dates.
 *
 * How it works:
 * 1. Scheduled to run daily at Midnight (00:00).
 * 2. It looks for "Completed" bookings that have NOT yet been settled.
 * 3. It enforces a "Cutoff Date" (currently set to the start of the current week) to ensure we don't
 *    settle bookings that might still be in dispute or active.
 * 4. It groups these bookings by Shop ID and calculates the Net Balance:
 *    - IF Cash Booking: The Shop collected the money -> Shop owes Admin the commission.
 *    - IF Online Booking: The Admin collected the money -> Admin owes Shop the net revenue.
 * 5. The result is a single "Settlement" record per shop, which is either a PAYOUT (Admin -> Shop)
 *    or a COLLECTION (Shop -> Admin).
 *
 * =================================================================================================
 */

// --- Helper: Round to 2 decimals ---
const roundMoney = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// --- The Core Logic ---
const runSettlementJob = async (manualAdminId = null) => {
  console.log('--- STARTING SETTLEMENT JOB ---');
  let settlementCount = 0;

  // Use a transaction for safety to ensure Booking updates and Settlement creation happen together.
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1. Define the "Cutoff Date"
    // We only settle bookings from *before* the current week started (Monday).
    // This provides a buffer period for cancellations/disputes.
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
    const cutoffDateStr = format(currentWeekStart, 'yyyy-MM-dd');

    console.log(`Searching for unsettled completed bookings before: ${cutoffDateStr}`);

    // 2. Aggregation: Group by Shop and Calculate Net Balance
    // Instead of fetching all bookings into memory (slow), we use MongoDB Aggregation.
    // This efficiently sums up the 'adminNetRevenue' and 'barberNetRevenue' fields.
    const settlementGroups = await Booking.aggregate([
      {
        $match: {
          status: 'completed', // Only settled completed jobs
          $or: [
              { settlementStatus: 'PENDING' }, // Explicitly pending
              { settlementStatus: { $exists: false } } // Or legacy records missing the status
          ],
          date: { $lt: cutoffDateStr } // Strict date cutoff
        }
      },
      {
        $group: {
          _id: '$shopId',
          bookings: { $push: '$_id' }, // Keep track of which booking IDs are included
          minDate: { $min: '$date' },
          maxDate: { $max: '$date' },
          // Calculate what Shop Owes Admin (Commission from Cash)
          totalAdminNet: {
            $sum: {
              $cond: [
                { $or: [{ $eq: ['$paymentMethod', 'CASH'] }, { $eq: ['$paymentMethod', 'cash'] }] },
                '$adminNetRevenue',
                0
              ]
            }
          },
          // Calculate what Admin Owes Shop (Revenue from Online)
          totalBarberNet: {
            $sum: {
              $cond: [
                { $not: { $or: [{ $eq: ['$paymentMethod', 'CASH'] }, { $eq: ['$paymentMethod', 'cash'] }] } },
                '$barberNetRevenue',
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

    // 3. Process Each Group (Create Settlement Records)
    for (const group of settlementGroups) {
        const shopId = group._id;
        const bookingIds = group.bookings;

        // Calculate Net: (What Admin Owes) - (What Shop Owes)
        const rawNet = group.totalBarberNet - group.totalAdminNet;
        const netAmount = roundMoney(rawNet);

        let type = 'PAYOUT';
        let finalAmount = netAmount;

        // If Net is negative, the Shop owes the Admin more than the Admin owes the Shop.
        if (netAmount < 0) {
            type = 'COLLECTION';
            finalAmount = Math.abs(netAmount);
        }

        // Create the Settlement Record
        const [settlement] = await Settlement.create([{
            shopId,
            adminId: manualAdminId, // If triggered manually via API
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

        // Update the original Bookings to mark them as SETTLED
        // This prevents them from being picked up by the next Cron job.
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
