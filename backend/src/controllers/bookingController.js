const Booking = require("../models/Booking");
const Barber = require("../models/Barber");
const Shop = require("../models/Shop");
const User = require("../models/User");
const SystemConfig = require("../models/SystemConfig");
const mongoose = require("mongoose");
const {
  addMinutes,
  parse,
  format,
  differenceInDays,
  subDays,
  startOfMonth,
  endOfMonth,
} = require("date-fns");
const {
  getISTTime,
  buildBookingWindowUTC,
  daysBetweenDateStrings,
  getMonthBoundsFromDateStr,
} = require("../utils/dateUtils");
const {
  incrementCancellationCount,
  incrementNoShowCount,
} = require("../utils/incidentUtils");
const {
  BookingServiceError,
  createBookingForUser,
} = require("../services/bookingService");
const {
  timeToMinutes,
  getBarberScheduleForDate,
} = require("../utils/scheduleUtils");

/**
 * =================================================================================================
 * BOOKING CONTROLLER
 * =================================================================================================
 *
 * Purpose:
 * This is the heart of the scheduling engine. It handles:
 * 1. Creating new bookings (with availability checks).
 * 2. Calculating the financial split (Commission, Discount, Net Revenue).
 * 3. Managing booking status transitions (Pending -> Confirmed -> Completed).
 *
 * Key Logic:
 * - "Availability Check": Complex logic to ensure slots don't overlap, considering Buffer Times and
 *   overnight shifts (spillover).
 * - "Financials": Calculated *at the time of booking* and stored permanently to ensure historical accuracy
 *   even if commission rates change later.
 * =================================================================================================
 */

// --- Helper: Round Money ---
const roundMoney = (amount) => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

const buildCashBookingCountQuery = (userId, monthStart, monthEnd) => ({
  userId,
  $or: [{ paymentMethod: "cash" }, { paymentMethod: "CASH" }],
  status: { $ne: "cancelled" },
  date: { $gte: monthStart, $lte: monthEnd },
});

const matchComboByName = (shop, rawName) => {
  for (const combo of shop.combos || []) {
    if (combo.isAvailable === false) continue;
    if (rawName === combo.name || rawName.startsWith(`${combo.name} (`)) {
      return combo;
    }
  }
  return null;
};

const resolveBookingServices = (shop, serviceNames) => {
  if (!Array.isArray(serviceNames) || serviceNames.length === 0) {
    return { error: "At least one service is required." };
  }

  let totalPrice = 0;
  let totalDuration = 0;
  const resolved = [];

  for (const rawName of serviceNames) {
    const combo = matchComboByName(shop, rawName);
    if (combo) {
      totalPrice += combo.price;
      totalDuration += combo.duration;
      resolved.push(rawName);
      continue;
    }

    const service = (shop.services || []).find(
      (s) => s.name === rawName && s.isAvailable !== false,
    );
    if (service) {
      totalPrice += service.price;
      totalDuration += service.duration;
      resolved.push(rawName);
      continue;
    }

    return { error: `Invalid or unavailable service: ${rawName}` };
  }

  return {
    serviceNames: resolved,
    totalPrice: roundMoney(totalPrice),
    totalDuration,
  };
};

const isAdmin = (user) => user && user.role === "admin";

const isOwnerOfShop = (user, shopId) => {
  if (!user || !user.myShopId) return false;
  return user.myShopId.toString() === shopId.toString();
};

const checkInAttempts = new Map();
const CHECKIN_MAX_ATTEMPTS = 5;
const CHECKIN_WINDOW_MS = 15 * 60 * 1000;

const isCheckInRateLimited = (bookingId) => {
  const now = Date.now();
  const key = bookingId.toString();
  const entry = checkInAttempts.get(key);

  if (!entry || now > entry.resetAt) {
    checkInAttempts.set(key, { count: 1, resetAt: now + CHECKIN_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > CHECKIN_MAX_ATTEMPTS;
};

const generateUniqueBookingKey = async (session) => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const key = Math.floor(1000 + Math.random() * 9000).toString();
    const exists = await Booking.exists({ bookingKey: key }).session(session);
    if (!exists) return key;
  }
  throw new Error("Failed to generate unique booking key");
};

// --- Helper: Availability Check ---
const checkAvailability = async (
  barber,
  date,
  startStr,
  duration,
  bufferTime = 0,
  session = null,
) => {
  const start = timeToMinutes(startStr);
  const end = start + duration + bufferTime;

  // 1. Check Today's Schedule
  const scheduleToday = getBarberScheduleForDate(barber, date);
  let fitsToday = false;

  if (scheduleToday.isOpen) {
    if (start >= scheduleToday.start && end <= scheduleToday.end) {
      let inBreak = false;
      if (scheduleToday.breaks) {
        for (const br of scheduleToday.breaks) {
          if (start < br.end && end > br.start) {
            inBreak = true;
            break;
          }
        }
      }
      if (!inBreak) fitsToday = true;
    }
  }

  // 2. Check Yesterday's Schedule (Overnight Spillover)
  let fitsYesterday = false;
  if (!fitsToday) {
    const prevDateObj = subDays(new Date(date), 1);
    const prevDate = format(prevDateObj, "yyyy-MM-dd");
    const scheduleYesterday = getBarberScheduleForDate(barber, prevDate);

    if (scheduleYesterday.isOpen && scheduleYesterday.end > 1440) {
      const startY = start + 1440;
      const endY = end + 1440;

      if (startY >= scheduleYesterday.start && endY <= scheduleYesterday.end) {
        let inBreak = false;
        if (scheduleYesterday.breaks) {
          for (const br of scheduleYesterday.breaks) {
            if (startY < br.end && endY > br.start) {
              inBreak = true;
              break;
            }
          }
        }
        if (!inBreak) fitsYesterday = true;
      }
    }
  }

  if (!fitsToday && !fitsYesterday) return false;

  const conflictQuery = (filter) => {
    let q = Booking.find(filter);
    if (session) q = q.session(session);
    return q;
  };

  // 3. Check Conflicts with Existing Bookings
  const conflictsToday = await conflictQuery({
    barberId: barber._id,
    date: date,
    activeBooking: true,
  });

  for (const b of conflictsToday) {
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime) + bufferTime;
    if (start < bEnd && end > bStart) return false;
  }

  const prevDateObj = subDays(new Date(date), 1);
  const prevDate = format(prevDateObj, "yyyy-MM-dd");

  const conflictsYesterday = await conflictQuery({
    barberId: barber._id,
    date: prevDate,
    activeBooking: true,
  });

  for (const b of conflictsYesterday) {
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime) + bufferTime;
    const bStartToday = bStart - 1440;
    const bEndToday = bEnd - 1440;

    if (start < bEndToday && end > bStartToday) return false;
  }

  return true;
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
        .json({ message: "Slot already booked. Please choose another time." });
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
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const canCancel =
      isAdmin(req.user) ||
      (booking.userId &&
        booking.userId.toString() === req.user._id.toString()) ||
      isOwnerOfShop(req.user, booking.shopId);

    if (!canCancel) {
      return res
        .status(403)
        .json({ message: "Not authorized to cancel this booking" });
    }

    if (booking.status === "cancelled") {
      return res.json(booking);
    }

    // Cancel the booking
    booking.status = "cancelled";
    booking.activeBooking = false;
    await booking.save();

    // Increment cancellation count for User
    if (booking.userId) {
      await incrementCancellationCount(booking.userId);
    }

    res.json(booking);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to cancel booking" });
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
  try {
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
      return res.status(400).json({ message: "Invalid status" });
    }

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (!isAdmin(req.user) && !isOwnerOfShop(req.user, booking.shopId)) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this booking" });
    }

    const previousStatus = booking.status;
    if (previousStatus === status) {
      return res.json(booking);
    }

    if (status === "checked-in") {
      if (isCheckInRateLimited(booking._id)) {
        return res.status(429).json({
          message: "Too many check-in attempts. Please try again later.",
        });
      }
      if (!bookingKey) {
        return res
          .status(400)
          .json({ message: "Customer PIN required for check-in." });
      }
      if (bookingKey !== booking.bookingKey) {
        return res.status(403).json({ message: "Invalid PIN." });
      }
    }

    booking.status = status;
    booking.activeBooking = ![
      "cancelled",
      "completed",
      "no-show",
      "missed",
    ].includes(status);
    await booking.save();

    if (
      status === "no-show" &&
      booking.userId &&
      previousStatus !== "no-show" &&
      previousStatus !== "missed"
    ) {
      await incrementNoShowCount(booking.userId);
    }

    res.json(booking);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update booking status" });
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
