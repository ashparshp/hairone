const {
  creditBookingCancellation,
} = require("./walletService");
const {
  isCancellableStatus,
} = require("../utils/bookingStatusUtils");

const cancelBookingRecord = async (
  booking,
  { session = null, reasonNote = null } = {},
) => {
  if (booking.status === "cancelled") {
    return {
      booking,
      walletCreditIssued: booking.cancelWalletCreditAmount || 0,
      alreadyCancelled: true,
    };
  }

  if (!isCancellableStatus(booking.status)) {
    const error = new Error("This booking cannot be cancelled.");
    error.status = 400;
    throw error;
  }

  const walletCreditIssued = await creditBookingCancellation(booking, session);

  booking.status = "cancelled";
  booking.activeBooking = false;
  if (reasonNote) {
    booking.notes = booking.notes
      ? `${booking.notes}\n${reasonNote}`
      : reasonNote;
  }
  await booking.save({ session });

  return { booking, walletCreditIssued, alreadyCancelled: false };
};

module.exports = {
  cancelBookingRecord,
};
