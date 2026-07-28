const Booking = require("../models/Booking");
const Barber = require("../models/Barber");
const Shop = require("../models/Shop");
const User = require("../models/User");
const SystemConfig = require("../models/SystemConfig");
const {
  addMinutes,
  parse,
  format,
  differenceInDays,
  subDays,
  startOfMonth,
  endOfMonth,
} = require("date-fns");
const { getISTTime, buildBookingWindowUTC } = require("../utils/dateUtils");
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

const isAdmin = (user) => user && user.role === "admin";

const isOwnerOfShop = (user, shopId) => {
  if (!user || !user.myShopId) return false;
  return user.myShopId.toString() === shopId.toString();
};

// --- Helper: Availability Check ---
const checkAvailability = async (
  barber,
  date,
  startStr,
  duration,
  bufferTime = 0,
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

  // 3. Check Conflicts with Existing Bookings
  const conflictsToday = await Booking.find({
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

  const conflictsYesterday = await Booking.find({
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
  const {
    userId: requestedUserId,
    shopId,
    barberId,
    serviceNames,
    totalPrice,
    totalDuration,
    date,
    startTime,
    paymentMethod,
    type,
    notes,
  } = req.body;

  try {
    if (!startTime || !totalDuration || !date) {
      return res
        .status(400)
        .json({ message: "Missing required booking details." });
    }

    // Validate totalPrice
    const parsedPrice = parseFloat(totalPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ message: "Invalid total price." });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    if (shop.isDisabled) {
      return res
        .status(403)
        .json({ message: "This shop is currently unavailable for booking." });
    }

    const bufferTime = shop.bufferTime || 0;
    const minNotice = shop.minBookingNotice || 0; // minutes
    const maxNotice = shop.maxBookingNotice || 30; // days
    const autoApprove = shop.autoApproveBookings !== false;

    // Validate Past Time & Notice
    const { date: istDate, minutes: istMinutes } = getISTTime();
    const isSpecialType = type === "walk-in" || type === "blocked";

    if (
      isSpecialType &&
      !isAdmin(req.user) &&
      !isOwnerOfShop(req.user, shop._id)
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to create this booking type." });
    }

    const requesterId =
      req.user && req.user._id ? req.user._id.toString() : null;
    const resolvedUserId = isSpecialType
      ? isAdmin(req.user) && requestedUserId
        ? requestedUserId
        : undefined
      : requesterId;

    if (
      !isSpecialType &&
      requestedUserId &&
      requestedUserId.toString() !== requesterId &&
      !isAdmin(req.user)
    ) {
      return res
        .status(403)
        .json({ message: "Cannot create booking for another user." });
    }

    if (!isSpecialType) {
      const daysDiff = differenceInDays(new Date(date), new Date(istDate));
      if (daysDiff > maxNotice) {
        return res.status(400).json({
          message: `Cannot book more than ${maxNotice} days in advance.`,
        });
      }

      const bookingStartMinutes = timeToMinutes(startTime);
      if (date < istDate) {
        return res
          .status(400)
          .json({ message: "Cannot book for a past date." });
      }
      if (date === istDate) {
        // Relax validation slightly to account for time taken to fill the form (Grace Period)
        const GRACE_PERIOD = 2;

        if (bookingStartMinutes < istMinutes - GRACE_PERIOD) {
          return res
            .status(400)
            .json({ message: "Cannot book for a past time." });
        }
        if (bookingStartMinutes < istMinutes + minNotice - GRACE_PERIOD) {
          return res.status(400).json({
            message: `Must book at least ${minNotice} minutes in advance.`,
          });
        }
      }
    }

    let assignedBarberId = barberId;
    const durationInt = parseInt(totalDuration, 10);
    if (
      !Number.isInteger(durationInt) ||
      durationInt <= 0 ||
      durationInt > 8 * 60
    ) {
      return res.status(400).json({ message: "Invalid total duration." });
    }

    // Auto-Assign ("Any")
    if (!barberId || barberId === "any") {
      const allBarbers = await Barber.find({ shopId, isAvailable: true });
      const availableBarbers = [];
      for (const barber of allBarbers) {
        if (
          await checkAvailability(
            barber,
            date,
            startTime,
            durationInt,
            bufferTime,
          )
        ) {
          availableBarbers.push(barber);
        }
      }

      if (availableBarbers.length === 0)
        return res.status(409).json({ message: "Slot no longer available." });

      const randomIndex = Math.floor(Math.random() * availableBarbers.length);
      assignedBarberId = availableBarbers[randomIndex]._id;
    } else {
      const barber = await Barber.findById(barberId);
      if (!barber) return res.status(404).json({ message: "Barber not found" });
      if (barber.shopId.toString() !== shop._id.toString()) {
        return res
          .status(400)
          .json({ message: "Selected barber does not belong to this shop." });
      }
      if (
        !(await checkAvailability(
          barber,
          date,
          startTime,
          durationInt,
          bufferTime,
        ))
      ) {
        return res.status(409).json({ message: "Barber unavailable." });
      }
    }

    const startObj = parse(startTime, "HH:mm", new Date());
    const endObj = addMinutes(startObj, durationInt);
    const endTime = format(endObj, "HH:mm");
    const { startAt, endAt } = buildBookingWindowUTC(date, startTime, endTime);

    let status = "upcoming";
    if (type === "blocked") {
      status = "blocked";
    } else if (!autoApprove && type !== "walk-in") {
      status = "pending";
    }

    if (!resolvedUserId && type !== "blocked" && type !== "walk-in") {
      return res
        .status(400)
        .json({ message: "User ID required for online bookings." });
    }

    const config = await SystemConfig.findOne({ key: "global" });

    // Check Max Cash Bookings Limit
    if (
      resolvedUserId &&
      (paymentMethod === "cash" || paymentMethod === "CASH")
    ) {
      const maxCash =
        config && config.maxCashBookingsPerMonth
          ? config.maxCashBookingsPerMonth
          : 5;

      // Use the booking date, not the current server date
      const bookingDateObj = new Date(date);
      const monthStart = format(startOfMonth(bookingDateObj), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(bookingDateObj), "yyyy-MM-dd");

      const cashCount = await Booking.countDocuments({
        userId: resolvedUserId,
        // Removed status exclusion so cancelled bookings are also counted
        $or: [{ paymentMethod: "cash" }, { paymentMethod: "CASH" }],
        date: { $gte: monthStart, $lte: monthEnd },
      });

      if (cashCount >= maxCash) {
        return res.status(400).json({
          message: `You have reached the limit of ${maxCash} cash bookings per month (including cancellations). Please pay online.`,
        });
      }
    }

    // --- FINANCIAL CALCULATIONS ------------------------------------------------------------------
    // 1. Get Global Rates (or defaults)
    const adminRate =
      config && typeof config.adminCommissionRate === "number"
        ? config.adminCommissionRate
        : 10;
    const discountRate =
      config && typeof config.userDiscountRate === "number"
        ? config.userDiscountRate
        : 0;

    const originalPrice = parsedPrice;

    // 2. Calculate Discount (Subsidized by Admin usually, but here it reduces the final price)
    const discountAmount = roundMoney(originalPrice * (discountRate / 100));
    const finalPrice = roundMoney(originalPrice - discountAmount);

    // 3. Admin Commission (Gross) - Calculated on the ORIGINAL price
    const adminCommission = roundMoney(originalPrice * (adminRate / 100));

    // 4. Net Revenues
    // Admin Net = Commission - Discount (Admin absorbs the discount cost)
    const adminNetRevenue = roundMoney(adminCommission - discountAmount);

    // Barber Net = Original - Commission (Barber gets the rest)
    const barberNetRevenue = roundMoney(originalPrice - adminCommission);

    // 5. Determine who holds the cash right now?
    // - If Online/UPI: Admin has it.
    // - If Cash: Barber/Shop has it.
    const collectedBy =
      paymentMethod === "UPI" || paymentMethod === "ONLINE"
        ? "ADMIN"
        : "BARBER";

    const bookingData = {
      userId: resolvedUserId,
      shopId,
      barberId: assignedBarberId,
      serviceNames,
      totalPrice: finalPrice,

      originalPrice,
      discountAmount,
      finalPrice,

      adminCommission,
      adminNetRevenue,
      barberNetRevenue,

      amountCollectedBy: collectedBy,
      settlementStatus: "PENDING",
      activeBooking: true,
      startAt,
      endAt,

      totalDuration: durationInt,
      date,
      startTime,
      endTime,
      paymentMethod: paymentMethod || "cash",
      status,
      type: type || "online",
      notes,
      bookingKey: Math.floor(1000 + Math.random() * 9000).toString(),
    };

    const booking = await Booking.create(bookingData);

    res.status(201).json(booking);
  } catch (error) {
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

    // Cancel the booking
    booking.status = "cancelled";
    booking.activeBooking = false;
    await booking.save();

    // Increment cancellation count for User
    if (booking.userId) {
      // Fetch Limit dynamically
      const config = await SystemConfig.findOne({ key: "global" });
      const limit =
        config && config.yearlyCancellationLimit
          ? config.yearlyCancellationLimit
          : 12;

      const user = await User.findByIdAndUpdate(
        booking.userId,
        { $inc: { cancellationCount: 1 } },
        { new: true },
      );

      if (user) {
        // Check limits
        const totalIncidents = user.cancellationCount + (user.noShowCount || 0);
        if (totalIncidents > limit && !user.isFlagged) {
          await User.findByIdAndUpdate(user._id, { isFlagged: true });
          // We could return a warning here, but we'll just flag silently for now as per plan
        }
      }
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

    if (status === "checked-in") {
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

    const now = new Date();
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

    const cashCount = await Booking.countDocuments({
      userId,
      // Include cancelled bookings
      $or: [{ paymentMethod: "cash" }, { paymentMethod: "CASH" }],
      date: { $gte: monthStart, $lte: monthEnd },
    });

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
