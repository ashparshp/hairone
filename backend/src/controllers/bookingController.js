const Booking = require("../models/Booking");
const SystemConfig = require("../models/SystemConfig");
const mongoose = require("mongoose");
const {
  getISTTime,
  getMonthBoundsFromDateStr,
} = require("../utils/dateUtils");
const {
  incrementCancellationCount,
  incrementNoShowCount,
} = require("../utils/incidentUtils");
const { cancelBookingRecord } = require("../services/bookingCancellationService");
const {
  getTransitionError,
  isInactiveBookingStatus,
} = require("../utils/bookingStatusUtils");
const { checkRateLimit } = require("../utils/rateLimitUtils");
const {
  BookingServiceError,
  createBookingForUser,
} = require("../services/bookingService");

/**
 * =================================================================================================
 * BOOKING CONTROLLER
 * =================================================================================================
 *
 * Route handlers for bookings. Core create/availability/financial logic lives in bookingService.
 * =================================================================================================
 */

const buildCashBookingCountQuery = (userId, monthStart, monthEnd) => ({
  userId,
  $or: [{ paymentMethod: "cash" }, { paymentMethod: "CASH" }],
  status: { $ne: "cancelled" },
  date: { $gte: monthStart, $lte: monthEnd },
});

const NON_CANCELLABLE_STATUSES = [
  "completed",
  "cancelled",
  "no-show",
  "missed",
  "blocked",
];

const isAdmin = (user) => user && user.role === "admin";

const isOwnerOfShop = (user, shopId) => {
  if (!user || !user.myShopId) return false;
  return user.myShopId.toString() === shopId.toString();
};

const CHECKIN_MAX_ATTEMPTS = 5;
const CHECKIN_WINDOW_MS = 15 * 60 * 1000;

const checkInRateLimitKey = (bookingId) => `checkin:${bookingId}`;

const isCheckInRateLimited = async (bookingId) => {
  const allowed = await checkRateLimit(
    checkInRateLimitKey(bookingId),
    CHECKIN_MAX_ATTEMPTS,
    CHECKIN_WINDOW_MS,
  );
  return !allowed;
};

// --- 1. Create Booking ---
/**
 * CREATE BOOKING
 * This function handles the complex logic of:
 * 1. Validating input (Time, Price, Date).
 * 2. Checking constraints (Max Notice, Min Booking Time, Past Time).
 * 3. Assigning a Barber (Specific vs. "Any").
 * 4. Calculating the Money Split (Commission vs Revenue).
 */
exports.createBooking = async (req, res) => {
  const { paymentMethod, type } = req.body;
  const normalizedPayment = (paymentMethod || "cash").toUpperCase();
  const isSpecialType = type === "walk-in" || type === "blocked";

  if (
    !isSpecialType &&
    (normalizedPayment === "ONLINE" || normalizedPayment === "UPI")
  ) {
    return res.status(400).json({
      message:
        "Online bookings require payment. Use the Razorpay checkout flow.",
    });
  }

  try {
    const booking = await createBookingForUser(req.user, req.body);
    res.status(201).json(booking);
  } catch (error) {
    if (error instanceof BookingServiceError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error(error);
    if (error && error.code === 11000) {
      return res
        .status(409)
        .json({ message: "Slot no longer available." });
    }
    res.status(500).json({ message: "Booking failed on server" });
  }
};

// --- 2. Get User Bookings ---
exports.getMyBookings = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isAdmin(req.user) && req.user._id.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to view these bookings" });
    }

    const bookings = await Booking.find({ userId })
      .populate("barberId", "name")
      .populate({
        path: "shopId",
        select: "name address image coordinates ownerId",
        populate: {
          path: "ownerId",
          select: "phone",
        },
      })
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
};

// --- 3. Cancel Booking ---
exports.cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { id } = req.params;
    const booking = await Booking.findById(id).session(session);
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Booking not found" });
    }

    const canCancel =
      isAdmin(req.user) ||
      (booking.userId &&
        booking.userId.toString() === req.user._id.toString()) ||
      isOwnerOfShop(req.user, booking.shopId);

    if (!canCancel) {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "Not authorized to cancel this booking" });
    }

    if (booking.status === "cancelled") {
      await session.abortTransaction();
      return res.json({
        ...booking.toObject(),
        walletCreditIssued: booking.cancelWalletCreditAmount || 0,
      });
    }

    if (NON_CANCELLABLE_STATUSES.includes(booking.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Completed bookings cannot be cancelled.",
      });
    }

    const { walletCreditIssued } = await cancelBookingRecord(booking, {
      session,
    });

    const isCustomerSelfCancel =
      booking.userId &&
      req.user._id.toString() === booking.userId.toString() &&
      !isAdmin(req.user);

    if (isCustomerSelfCancel) {
      await incrementCancellationCount(booking.userId, session);
    }

    await session.commitTransaction();

    const response = booking.toObject();
    response.walletCreditIssued = walletCreditIssued;
    if (walletCreditIssued > 0) {
      response.walletCreditMessage = `₹${walletCreditIssued} credited to your account`;
    }

    res.json(response);
  } catch (e) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error(e);
    if (e.status) {
      return res.status(e.status).json({ message: e.message });
    }
    res.status(500).json({ message: "Failed to cancel booking" });
  } finally {
    session.endSession();
  }
};

// --- 4. Get Shop Bookings (Owner View) ---
exports.getShopBookings = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { date, startDate, endDate } = req.query;

    if (!isAdmin(req.user) && !isOwnerOfShop(req.user, shopId)) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this shop's bookings" });
    }

    const query = { shopId, status: { $ne: "cancelled" } };

    if (date) {
      query.date = date;
    } else if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.date = { $gte: startDate };
    }

    const bookings = await Booking.find(query)
      .select("-bookingKey")
      .populate("userId", "name phone")
      .populate("barberId", "name")
      .sort({ date: 1, startTime: 1 });

    res.json(bookings);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch shop bookings" });
  }
};

// --- 5. Update Booking Status (Approve/Reject/Complete/No-Show) ---
exports.updateBookingStatus = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { id } = req.params;
    const { status, bookingKey } = req.body;

    const validStatuses = [
      "upcoming",
      "cancelled",
      "completed",
      "no-show",
      "checked-in",
    ];
    if (!validStatuses.includes(status)) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid status" });
    }

    const booking = await Booking.findById(id).session(session);
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!isAdmin(req.user) && !isOwnerOfShop(req.user, booking.shopId)) {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "Not authorized to update this booking" });
    }

    const previousStatus = booking.status;
    if (previousStatus === status) {
      await session.abortTransaction();
      return res.json(booking);
    }

    if (booking.settlementStatus === "SETTLED") {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Settled bookings cannot be modified.",
      });
    }

    if (
      status === "cancelled" &&
      NON_CANCELLABLE_STATUSES.includes(previousStatus)
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Completed bookings cannot be cancelled.",
      });
    }

    const transitionError = getTransitionError(previousStatus, status);
    if (transitionError) {
      await session.abortTransaction();
      return res.status(400).json({ message: transitionError });
    }

    if (status === "checked-in") {
      if (await isCheckInRateLimited(booking._id)) {
        await session.abortTransaction();
        return res.status(429).json({
          message: "Too many check-in attempts. Please try again later.",
        });
      }
      if (!bookingKey) {
        await session.abortTransaction();
        return res
          .status(400)
          .json({ message: "Customer PIN required for check-in." });
      }
      if (bookingKey !== booking.bookingKey) {
        await session.abortTransaction();
        return res.status(403).json({ message: "Invalid PIN." });
      }
    }

    if (status === "cancelled") {
      const { booking: cancelledBooking, walletCreditIssued } =
        await cancelBookingRecord(booking, { session });
      await session.commitTransaction();
      const response = cancelledBooking.toObject();
      response.walletCreditIssued = walletCreditIssued;
      return res.json(response);
    }

    booking.status = status;
    booking.activeBooking = !isInactiveBookingStatus(status);
    await booking.save({ session });

    if (
      status === "no-show" &&
      booking.userId &&
      previousStatus !== "no-show" &&
      previousStatus !== "missed"
    ) {
      await incrementNoShowCount(booking.userId, session);
    }

    await session.commitTransaction();
    res.json(booking);
  } catch (e) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error(e);
    if (e.status) {
      return res.status(e.status).json({ message: e.message });
    }
    res.status(500).json({ message: "Failed to update booking status" });
  } finally {
    session.endSession();
  }
};

// --- 6. Get Booking Limits ---
exports.getBookingLimits = async (req, res) => {
  try {
    const userId = req.user._id;
    const config = await SystemConfig.findOne({ key: "global" });
    const maxCash =
      config && config.maxCashBookingsPerMonth
        ? config.maxCashBookingsPerMonth
        : 5;

    const { date: istDate } = getISTTime();
    const refDate =
      req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : istDate;
    const { monthStart, monthEnd } = getMonthBoundsFromDateStr(refDate);

    const cashCount = await Booking.countDocuments(
      buildCashBookingCountQuery(userId, monthStart, monthEnd),
    );

    res.json({
      limit: maxCash,
      used: cashCount,
      remaining: Math.max(0, maxCash - cashCount),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch booking limits" });
  }
};
