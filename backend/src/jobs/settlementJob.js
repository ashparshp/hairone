const cron = require("node-cron");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const { startOfWeek, format } = require("date-fns");
const {
  pendingSettlementMatch,
  settleShopBookings,
  acquireSettlementJobLock,
  releaseSettlementJobLock,
} = require("../services/settlementService");

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

const runSettlementJob = async (manualAdminId = null) => {
  if (!acquireSettlementJobLock()) {
    console.log("Settlement job already running. Skipping duplicate trigger.");
    return { message: "Settlement job already running.", count: 0 };
  }

  console.log("--- STARTING SETTLEMENT JOB ---");
  let settlementCount = 0;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const cutoffDateStr = format(currentWeekStart, "yyyy-MM-dd");

    console.log(
      `Searching for unsettled completed bookings before: ${cutoffDateStr}`,
    );

    const shopIds = await Booking.distinct("shopId", pendingSettlementMatch(cutoffDateStr)).session(
      session,
    );

    if (shopIds.length === 0) {
      console.log("No pending bookings found for settlement.");
      await session.abortTransaction();
      return { message: "No pending bookings found.", count: 0 };
    }

    console.log(`Found ${shopIds.length} shops with pending settlements.`);

    for (const shopId of shopIds) {
      const settlement = await settleShopBookings({
        shopId,
        cutoffDateStr,
        adminId: manualAdminId,
        notes: "Auto-generated settlement via scheduled job.",
        session,
      });

      if (settlement) settlementCount += 1;
    }

    await session.commitTransaction();
    console.log(
      `--- SETTLEMENT JOB COMPLETE: Processed ${settlementCount} shops ---`,
    );
    return { message: "Settlement job complete.", count: settlementCount };
  } catch (err) {
    console.error("Error in Settlement Job:", err);
    if (session.inTransaction()) await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
    releaseSettlementJobLock();
  }
};

const initializeCron = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log("Running Scheduled Settlement Job...");
    try {
      await runSettlementJob();
    } catch (error) {
      console.error("Scheduled settlement job failed:", error);
    }
  });

  console.log("📅 Settlement Cron Job Scheduled (Daily at Midnight)");
};

module.exports = {
  runSettlementJob,
  initializeCron,
};
