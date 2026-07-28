const cron = require("node-cron");
const Booking = require("../models/Booking");
const { getISTTime, buildBookingWindowUTC } = require("../utils/dateUtils");
const { incrementNoShowCount } = require("../utils/incidentUtils");

/**
 * AUTO CANCEL / MISSED BOOKING JOB
 * Runs every 30 minutes to check for bookings that have passed their end time
 * without being completed.
 */
const runAutoCancelJob = () => {
  cron.schedule("*/30 * * * *", async () => {
    console.log("--- RUNNING AUTO-MISSED BOOKING JOB ---");
    try {
      const { date: istDate } = getISTTime();

      const bookings = await Booking.find({
        status: { $in: ["upcoming", "pending"] },
        date: { $lte: istDate },
      });

      let count = 0;
      for (const booking of bookings) {
        let bookingEndAt = booking.endAt;
        if (!bookingEndAt && booking.date && booking.startTime && booking.endTime) {
          const { endAt } = buildBookingWindowUTC(
            booking.date,
            booking.startTime,
            booking.endTime,
          );
          bookingEndAt = endAt;
        }

        const isMissed =
          (bookingEndAt && new Date() > bookingEndAt) ||
          (!bookingEndAt && booking.date < istDate);

        if (!isMissed) continue;

        const claimed = await Booking.findOneAndUpdate(
          {
            _id: booking._id,
            status: { $in: ["upcoming", "pending"] },
            activeBooking: true,
          },
          { $set: { status: "no-show", activeBooking: false } },
          { new: true },
        );

        if (!claimed) continue;

        count += 1;
        if (claimed.userId) {
          await incrementNoShowCount(claimed.userId);
        }
      }

      if (count > 0) {
        console.log(`Auto-Missed Job: Marked ${count} bookings as no-show.`);
      }
    } catch (error) {
      console.error("Error in Auto-Missed Job:", error);
    }
  });
};

module.exports = runAutoCancelJob;
