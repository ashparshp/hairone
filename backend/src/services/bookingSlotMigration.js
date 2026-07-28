const Booking = require("../models/Booking");
const Shop = require("../models/Shop");
const { buildOccupiedSlotKeys } = require("../utils/scheduleUtils");

const backfillOccupiedSlotKeys = async () => {
  const bookings = await Booking.find({
    activeBooking: true,
    $or: [
      { occupiedSlotKeys: { $exists: false } },
      { occupiedSlotKeys: { $size: 0 } },
    ],
  }).select("_id shopId date startTime endTime");

  if (bookings.length === 0) return 0;

  const shopBufferCache = new Map();
  let updated = 0;

  for (const booking of bookings) {
    const shopKey = booking.shopId.toString();
    if (!shopBufferCache.has(shopKey)) {
      const shop = await Shop.findById(booking.shopId).select("bufferTime");
      shopBufferCache.set(shopKey, shop?.bufferTime || 0);
    }

    const occupiedSlotKeys = buildOccupiedSlotKeys(
      booking.date,
      booking.startTime,
      booking.endTime,
      shopBufferCache.get(shopKey),
    );

    try {
      await Booking.updateOne(
        { _id: booking._id },
        { $set: { occupiedSlotKeys } },
      );
      updated += 1;
    } catch (error) {
      if (error?.code === 11000) {
        console.warn(
          `Skipping occupiedSlotKeys backfill for booking ${booking._id}: overlaps an existing booking`,
        );
        continue;
      }
      throw error;
    }
  }

  return updated;
};

const syncBookingSlotIndexes = async () => {
  await Booking.syncIndexes();
  const backfilled = await backfillOccupiedSlotKeys();
  if (backfilled > 0) {
    console.log(`Backfilled occupiedSlotKeys for ${backfilled} active booking(s).`);
  }
};

module.exports = {
  backfillOccupiedSlotKeys,
  syncBookingSlotIndexes,
};
