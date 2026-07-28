const Booking = require("../models/Booking");
const Settlement = require("../models/Settlement");

const roundMoney = (amount) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

const pendingSettlementMatch = (cutoffDateStr) => {
  const query = {
    status: "completed",
    $and: [
      {
        $or: [
          { settlementStatus: "PENDING" },
          { settlementStatus: { $exists: false } },
        ],
      },
      {
        $or: [{ settlementId: { $exists: false } }, { settlementId: null }],
      },
    ],
  };

  if (cutoffDateStr) {
    query.date = { $lt: cutoffDateStr };
  }

  return query;
};

const settlementGroupStage = {
  $group: {
    _id: "$shopId",
    bookings: { $push: "$_id" },
    minDate: { $min: "$date" },
    maxDate: { $max: "$date" },
    totalAdminNet: {
      $sum: {
        $cond: [
          { $eq: ["$amountCollectedBy", "BARBER"] },
          "$adminNetRevenue",
          0,
        ],
      },
    },
    totalBarberNet: {
      $sum: {
        $cond: [
          { $eq: ["$amountCollectedBy", "ADMIN"] },
          "$barberNetRevenue",
          0,
        ],
      },
    },
  },
};

const calculateNetFromBookings = (bookings) => {
  let adminOwesShop = 0;
  let shopOwesAdmin = 0;

  bookings.forEach((booking) => {
    if (booking.amountCollectedBy === "ADMIN") {
      adminOwesShop += booking.barberNetRevenue || 0;
    } else if (booking.amountCollectedBy === "BARBER") {
      shopOwesAdmin += booking.adminNetRevenue || 0;
    }
  });

  const net = roundMoney(adminOwesShop - shopOwesAdmin);
  return {
    net,
    adminOwesShop: roundMoney(adminOwesShop),
    shopOwesAdmin: roundMoney(shopOwesAdmin),
  };
};

const claimableBookingFilter = (bookingId) => ({
  _id: bookingId,
  status: "completed",
  $and: [
    {
      $or: [
        { settlementStatus: "PENDING" },
        { settlementStatus: { $exists: false } },
      ],
    },
    {
      $or: [{ settlementId: { $exists: false } }, { settlementId: null }],
    },
  ],
});

const claimBookingsForSettlement = async (bookingIds, session) => {
  const claimed = [];

  for (const bookingId of bookingIds) {
    const booking = await Booking.findOneAndUpdate(
      claimableBookingFilter(bookingId),
      { $set: { settlementStatus: "SETTLING" } },
      { session, new: true },
    );

    if (booking) claimed.push(booking);
  }

  return claimed;
};

class SettlementRaceError extends Error {
  constructor(message = "No bookings available for settlement.") {
    super(message);
    this.name = "SettlementRaceError";
  }
}

const createSettlementFromBookings = async ({
  shopId,
  bookings,
  adminId = null,
  settlementRecordStatus = null,
  notes = null,
  session,
}) => {
  if (bookings.length === 0) {
    throw new SettlementRaceError();
  }

  const { net } = calculateNetFromBookings(bookings);
  const type = net >= 0 ? "PAYOUT" : "COLLECTION";
  const amount = Math.abs(net);
  const dates = bookings.map((booking) => new Date(booking.date));
  const status =
    settlementRecordStatus ||
    (type === "PAYOUT" ? "PENDING_PAYOUT" : "PENDING_COLLECTION");

  const [settlement] = await Settlement.create(
    [
      {
        shopId,
        adminId,
        type,
        amount,
        status,
        bookings: bookings.map((booking) => booking._id),
        dateRange: {
          start: new Date(Math.min(...dates)),
          end: new Date(Math.max(...dates)),
        },
        notes:
          notes ||
          `Settlement for ${bookings.length} booking(s).`,
      },
    ],
    { session },
  );

  const finalizeResult = await Booking.updateMany(
    {
      _id: { $in: bookings.map((booking) => booking._id) },
      settlementStatus: "SETTLING",
    },
    {
      $set: {
        settlementStatus: "SETTLED",
        settlementId: settlement._id,
      },
    },
    { session },
  );

  if (finalizeResult.modifiedCount !== bookings.length) {
    throw new SettlementRaceError(
      "Settlement claim lost while finalizing bookings.",
    );
  }

  return settlement;
};

const settleShopBookings = async ({
  shopId,
  bookingIds = null,
  cutoffDateStr = null,
  adminId = null,
  settlementRecordStatus = null,
  notes = null,
  session,
}) => {
  const query = pendingSettlementMatch(cutoffDateStr);
  query.shopId = shopId;

  if (bookingIds?.length) {
    query._id = { $in: bookingIds };
  }

  const pendingBookings = await Booking.find(query).session(session);
  const claimed = await claimBookingsForSettlement(
    pendingBookings.map((booking) => booking._id),
    session,
  );

  if (claimed.length === 0) return null;

  return createSettlementFromBookings({
    shopId,
    bookings: claimed,
    adminId,
    settlementRecordStatus,
    notes,
    session,
  });
};

let settlementJobInFlight = false;

const acquireSettlementJobLock = () => {
  if (settlementJobInFlight) return false;
  settlementJobInFlight = true;
  return true;
};

const releaseSettlementJobLock = () => {
  settlementJobInFlight = false;
};

module.exports = {
  SettlementRaceError,
  pendingSettlementMatch,
  settlementGroupStage,
  calculateNetFromBookings,
  claimBookingsForSettlement,
  createSettlementFromBookings,
  settleShopBookings,
  acquireSettlementJobLock,
  releaseSettlementJobLock,
};
