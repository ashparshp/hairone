const cron = require("node-cron");
const Booking = require("../models/Booking");
const { getISTTime } = require("../utils/dateUtils");
const { buildBookingWindowUTC } = require("../utils/dateUtils");
const { incrementNoShowCount } = require("../utils/incidentUtils");

/**
 * AUTO CANCEL / MISSED BOOKING JOB
 * Runs every 30 minutes to check for bookings that have passed their end time
 * without being completed.
 */
const runAutoCancelJob = () => {
  // Schedule: Every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    console.log("--- RUNNING AUTO-MISSED BOOKING JOB ---");
    try {
      const { date: istDate } = getISTTime();

      const bookings = await Booking.find({
        status: { $in: ["upcoming", "pending"] },
        date: { $lte: istDate },
      });

      let count = 0;
      for (const b of bookings) {
        let isMissed = false;

        let bookingEndAt = b.endAt;
        if (!bookingEndAt && b.date && b.startTime && b.endTime) {
          const { endAt } = buildBookingWindowUTC(
            b.date,
            b.startTime,
            b.endTime,
          );
          bookingEndAt = endAt;
        }

        if (bookingEndAt) {
          isMissed = new Date() > bookingEndAt;
        } else if (b.date < istDate) {
          isMissed = true;
        }

        if (isMissed) {
          b.status = "missed";
          b.activeBooking = false;
          await b.save();
          count++;

          if (b.userId) {
            await incrementNoShowCount(b.userId);
          }
        }
      }

      if (count > 0) {
        console.log(`Auto-Missed Job: Marked ${count} bookings as missed.`);
      }
    } catch (error) {
      console.error("Error in Auto-Missed Job:", error);
    }
  });
};

module.exports = runAutoCancelJob;
