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
  subDays,
} = require("date-fns");
const {
  getISTTime,
  buildBookingWindowUTC,
  daysBetweenDateStrings,
  getMonthBoundsFromDateStr,
} = require("../utils/dateUtils");
const {
  timeToMinutes,
  getBarberScheduleForDate,
} = require("../utils/scheduleUtils");

const roundMoney = (amount) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

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

const generateUniqueBookingKey = async (session) => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const key = Math.floor(1000 + Math.random() * 9000).toString();
    const exists = await Booking.exists({ bookingKey: key }).session(session);
    if (!exists) return key;
  }
  throw new Error("Failed to generate unique booking key");
};

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

  const conflictsToday = await conflictQuery({
    barberId: barber._id,
    date,
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

class BookingServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const prepareBooking = async (user, body) => {
  const {
    userId: requestedUserId,
    shopId,
    barberId,
    serviceNames,
    totalDuration,
    totalPrice,
    date,
    startTime,
    paymentMethod,
    type,
    notes,
    bookingMode,
  } = body;

  if (!startTime || !date) {
    throw new BookingServiceError(400, "Missing required booking details.");
  }

  const shop = await Shop.findById(shopId);
  if (!shop) throw new BookingServiceError(404, "Shop not found");
  if (shop.isDisabled) {
    throw new BookingServiceError(
      403,
      "This shop is currently unavailable for booking.",
    );
  }

  const isSpecialType = type === "walk-in" || type === "blocked";
  const mode = bookingMode || "schedule";

  if (shop.blockCustomBookings && !isSpecialType && mode !== "earliest") {
    throw new BookingServiceError(
      403,
      "This shop only accepts earliest-available bookings.",
    );
  }

  const requesterId = user && user._id ? user._id.toString() : null;

  if (!isSpecialType && requesterId) {
    const bookingUser = await User.findById(requesterId);
    if (bookingUser?.isFlagged) {
      throw new BookingServiceError(
        403,
        "Your account is restricted from making new bookings.",
      );
    }
  }

  let resolvedServiceNames = serviceNames;
  let durationInt;
  let serverPrice;

  if (isSpecialType) {
    durationInt = parseInt(totalDuration, 10);
    serverPrice = parseFloat(totalPrice);
    if (isNaN(serverPrice) || serverPrice < 0) {
      throw new BookingServiceError(400, "Invalid total price.");
    }
  } else {
    const resolved = resolveBookingServices(shop, serviceNames);
    if (resolved.error) {
      throw new BookingServiceError(400, resolved.error);
    }
    resolvedServiceNames = resolved.serviceNames;
    durationInt = resolved.totalDuration;
    serverPrice = resolved.totalPrice;
  }

  if (
    !Number.isInteger(durationInt) ||
    durationInt <= 0 ||
    durationInt > 8 * 60
  ) {
    throw new BookingServiceError(400, "Invalid total duration.");
  }

  const bufferTime = shop.bufferTime || 0;
  const minNotice = shop.minBookingNotice || 0;
  const maxNotice = shop.maxBookingNotice || 30;
  const autoApprove = shop.autoApproveBookings !== false;
  const { date: istDate, minutes: istMinutes } = getISTTime();

  if (isSpecialType && !isAdmin(user) && !isOwnerOfShop(user, shop._id)) {
    throw new BookingServiceError(
      403,
      "Not authorized to create this booking type.",
    );
  }

  const resolvedUserId = isSpecialType
    ? isAdmin(user) && requestedUserId
      ? requestedUserId
      : undefined
    : requesterId;

  if (
    !isSpecialType &&
    requestedUserId &&
    requestedUserId.toString() !== requesterId &&
    !isAdmin(user)
  ) {
    throw new BookingServiceError(
      403,
      "Cannot create booking for another user.",
    );
  }

  if (!isSpecialType) {
    const daysDiff = daysBetweenDateStrings(date, istDate);
    if (daysDiff > maxNotice) {
      throw new BookingServiceError(
        400,
        `Cannot book more than ${maxNotice} days in advance.`,
      );
    }

    const bookingStartMinutes = timeToMinutes(startTime);
    if (date < istDate) {
      throw new BookingServiceError(400, "Cannot book for a past date.");
    }
    if (date === istDate) {
      const GRACE_PERIOD = 2;
      if (bookingStartMinutes < istMinutes - GRACE_PERIOD) {
        throw new BookingServiceError(400, "Cannot book for a past time.");
      }
      if (bookingStartMinutes < istMinutes + minNotice - GRACE_PERIOD) {
        throw new BookingServiceError(
          400,
          `Must book at least ${minNotice} minutes in advance.`,
        );
      }
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
    throw new BookingServiceError(
      400,
      "User ID required for online bookings.",
    );
  }

  const config = await SystemConfig.findOne({ key: "global" });
  const normalizedPayment = (paymentMethod || "cash").toUpperCase();
  const isCash =
    normalizedPayment === "CASH" || normalizedPayment === "PAY_AT_VENUE";
  const isOnline =
    normalizedPayment === "ONLINE" || normalizedPayment === "UPI";

  if (resolvedUserId && isCash) {
    const maxCash =
      config && config.maxCashBookingsPerMonth
        ? config.maxCashBookingsPerMonth
        : 5;
    const { monthStart, monthEnd } = getMonthBoundsFromDateStr(date);
    const cashCount = await Booking.countDocuments(
      buildCashBookingCountQuery(resolvedUserId, monthStart, monthEnd),
    );
    if (cashCount >= maxCash) {
      throw new BookingServiceError(
        400,
        `You have reached the limit of ${maxCash} cash bookings per month. Please pay online.`,
      );
    }
  }

  const adminRate =
    config && typeof config.adminCommissionRate === "number"
      ? config.adminCommissionRate
      : 10;
  const discountRate =
    config && typeof config.userDiscountRate === "number"
      ? config.userDiscountRate
      : 0;

  const originalPrice = serverPrice;
  const discountAmount = roundMoney(originalPrice * (discountRate / 100));
  const finalPrice = roundMoney(originalPrice - discountAmount);
  const adminCommission = roundMoney(originalPrice * (adminRate / 100));
  const adminNetRevenue = roundMoney(adminCommission - discountAmount);
  const barberNetRevenue = roundMoney(originalPrice - adminCommission);
  const collectedBy = isOnline ? "ADMIN" : "BARBER";

  return {
    shop,
    shopId,
    barberId,
    resolvedServiceNames,
    durationInt,
    bufferTime,
    date,
    startTime,
    endTime,
    startAt,
    endAt,
    status,
    type: type || "online",
    notes,
    resolvedUserId,
    paymentMethod: isOnline ? "ONLINE" : "CASH",
    pricing: {
      originalPrice,
      discountAmount,
      finalPrice,
      adminCommission,
      adminNetRevenue,
      barberNetRevenue,
      collectedBy,
    },
  };
};

const createBookingFromPrepared = async (prepared, paymentMeta = {}) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    let assignedBarberId = prepared.barberId;

    if (!prepared.barberId || prepared.barberId === "any") {
      const allBarbers = await Barber.find({
        shopId: prepared.shopId,
        isAvailable: true,
      });
      const availableBarbers = [];
      for (const barber of allBarbers) {
        if (
          await checkAvailability(
            barber,
            prepared.date,
            prepared.startTime,
            prepared.durationInt,
            prepared.bufferTime,
            session,
          )
        ) {
          availableBarbers.push(barber);
        }
      }

      if (availableBarbers.length === 0) {
        throw new BookingServiceError(409, "Slot no longer available.");
      }

      const randomIndex = Math.floor(Math.random() * availableBarbers.length);
      assignedBarberId = availableBarbers[randomIndex]._id;
    } else {
      const barber = await Barber.findById(prepared.barberId).session(session);
      if (!barber) {
        throw new BookingServiceError(404, "Barber not found");
      }
      if (barber.shopId.toString() !== prepared.shop._id.toString()) {
        throw new BookingServiceError(
          400,
          "Selected barber does not belong to this shop.",
        );
      }
      if (
        !(await checkAvailability(
          barber,
          prepared.date,
          prepared.startTime,
          prepared.durationInt,
          prepared.bufferTime,
          session,
        ))
      ) {
        throw new BookingServiceError(409, "Barber unavailable.");
      }
    }

    const finalBarber = await Barber.findById(assignedBarberId).session(session);
    if (
      !finalBarber ||
      !(await checkAvailability(
        finalBarber,
        prepared.date,
        prepared.startTime,
        prepared.durationInt,
        prepared.bufferTime,
        session,
      ))
    ) {
      throw new BookingServiceError(409, "Slot no longer available.");
    }

    const bookingData = {
      userId: prepared.resolvedUserId,
      shopId: prepared.shopId,
      barberId: assignedBarberId,
      serviceNames: prepared.resolvedServiceNames,
      totalPrice: prepared.pricing.finalPrice,
      originalPrice: prepared.pricing.originalPrice,
      discountAmount: prepared.pricing.discountAmount,
      finalPrice: prepared.pricing.finalPrice,
      adminCommission: prepared.pricing.adminCommission,
      adminNetRevenue: prepared.pricing.adminNetRevenue,
      barberNetRevenue: prepared.pricing.barberNetRevenue,
      amountCollectedBy: prepared.pricing.collectedBy,
      settlementStatus: "PENDING",
      activeBooking: true,
      startAt: prepared.startAt,
      endAt: prepared.endAt,
      totalDuration: prepared.durationInt,
      date: prepared.date,
      startTime: prepared.startTime,
      endTime: prepared.endTime,
      paymentMethod: prepared.paymentMethod,
      status: prepared.status,
      type: prepared.type,
      notes: prepared.notes,
      bookingKey: await generateUniqueBookingKey(session),
      paymentOrderId: paymentMeta.paymentOrderId,
      razorpayOrderId: paymentMeta.razorpayOrderId,
      razorpayPaymentId: paymentMeta.razorpayPaymentId,
    };

    const [booking] = await Booking.create([bookingData], { session });
    await session.commitTransaction();
    return booking;
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const createBookingForUser = async (user, body, paymentMeta = {}) => {
  const prepared = await prepareBooking(user, body);
  try {
    return await createBookingFromPrepared(prepared, paymentMeta);
  } catch (error) {
    if (error && error.code === 11000) {
      throw new BookingServiceError(
        409,
        "Slot already booked. Please choose another time.",
      );
    }
    throw error;
  }
};

module.exports = {
  BookingServiceError,
  prepareBooking,
  createBookingForUser,
  createBookingFromPrepared,
};
