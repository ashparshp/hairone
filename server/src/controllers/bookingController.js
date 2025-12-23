const Booking = require('../models/Booking');
const Barber = require('../models/Barber');
const Shop = require('../models/Shop');
const SystemConfig = require('../models/SystemConfig');
const { addMinutes, parse, format, differenceInDays, subDays, startOfMonth, endOfMonth } = require('date-fns');
const { getISTTime } = require('../utils/dateUtils');
const { timeToMinutes, getBarberScheduleForDate } = require('../utils/scheduleUtils');

// --- Helper: Round Money ---
const roundMoney = (amount) => {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
};

// --- Helper: Availability Check ---
const checkAvailability = async (barber, date, startStr, duration, bufferTime = 0) => {
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
      const prevDate = format(prevDateObj, 'yyyy-MM-dd');
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
    status: { $ne: 'cancelled' },
  });

  for (const b of conflictsToday) {
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime) + bufferTime;
    if (start < bEnd && end > bStart) return false;
  }

  const prevDateObj = subDays(new Date(date), 1);
  const prevDate = format(prevDateObj, 'yyyy-MM-dd');

  const conflictsYesterday = await Booking.find({
      barberId: barber._id,
      date: prevDate,
      status: { $ne: 'cancelled' }
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
exports.createBooking = async (req, res) => {
  const { 
    userId, shopId, barberId, serviceNames, 
    totalPrice, totalDuration, date, startTime,
    paymentMethod, type, notes
  } = req.body;

  try {
    if (!startTime || !totalDuration || !date) {
      return res.status(400).json({ message: "Missing required booking details." });
    }

    // Validate totalPrice
    const parsedPrice = parseFloat(totalPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ message: "Invalid total price." });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const bufferTime = shop.bufferTime || 0;
    const minNotice = shop.minBookingNotice || 0; // minutes
    const maxNotice = shop.maxBookingNotice || 30; // days
    const autoApprove = shop.autoApproveBookings !== false;

    // Validate Past Time & Notice
    const { date: istDate, minutes: istMinutes } = getISTTime();
    const isSpecialType = type === 'walk-in' || type === 'blocked';

    if (!isSpecialType) {
      const daysDiff = differenceInDays(new Date(date), new Date(istDate));
      if (daysDiff > maxNotice) {
        return res.status(400).json({ message: `Cannot book more than ${maxNotice} days in advance.` });
      }

      const bookingStartMinutes = timeToMinutes(startTime);
      if (date < istDate) {
        return res.status(400).json({ message: "Cannot book for a past date." });
      }
      if (date === istDate) {
        // Relax validation slightly to account for time taken to fill the form (Grace Period)
        const GRACE_PERIOD = 2;

        if (bookingStartMinutes < istMinutes - GRACE_PERIOD) {
          return res.status(400).json({ message: "Cannot book for a past time." });
        }
        if (bookingStartMinutes < istMinutes + minNotice - GRACE_PERIOD) {
          return res.status(400).json({ message: `Must book at least ${minNotice} minutes in advance.` });
        }
      }
    }

    let assignedBarberId = barberId;
    const durationInt = parseInt(totalDuration);

    // Auto-Assign ("Any")
    if (!barberId || barberId === 'any') {
      const allBarbers = await Barber.find({ shopId, isAvailable: true });
      const availableBarbers = [];
      for (const barber of allBarbers) {
        if (await checkAvailability(barber, date, startTime, durationInt, bufferTime)) {
          availableBarbers.push(barber);
        }
      }

      if (availableBarbers.length === 0) return res.status(409).json({ message: "Slot no longer available." });
      
      const randomIndex = Math.floor(Math.random() * availableBarbers.length);
      assignedBarberId = availableBarbers[randomIndex]._id;
    } else {
      const barber = await Barber.findById(barberId);
      if (!barber) return res.status(404).json({ message: "Barber not found" });
      if (!(await checkAvailability(barber, date, startTime, durationInt, bufferTime))) {
        return res.status(409).json({ message: "Barber unavailable." });
      }
    }

    const startObj = parse(startTime, 'HH:mm', new Date());
    const endObj = addMinutes(startObj, durationInt);
    const endTime = format(endObj, 'HH:mm');

    let status = 'upcoming';
    if (type === 'blocked') {
        status = 'blocked';
    } else if (!autoApprove && type !== 'walk-in') {
        status = 'pending';
    }

    if (!userId && type !== 'blocked' && type !== 'walk-in') {
        return res.status(400).json({ message: "User ID required for online bookings." });
    }

    const config = await SystemConfig.findOne({ key: 'global' });

    // Check Max Cash Bookings Limit
    if (userId && (paymentMethod === 'cash' || paymentMethod === 'CASH')) {
         const maxCash = (config && config.maxCashBookingsPerMonth) ? config.maxCashBookingsPerMonth : 5;

         // Use the booking date, not the current server date
         const bookingDateObj = new Date(date);
         const monthStart = format(startOfMonth(bookingDateObj), 'yyyy-MM-dd');
         const monthEnd = format(endOfMonth(bookingDateObj), 'yyyy-MM-dd');

         const cashCount = await Booking.countDocuments({
             userId,
             status: { $ne: 'cancelled' },
             $or: [{ paymentMethod: 'cash' }, { paymentMethod: 'CASH' }],
             date: { $gte: monthStart, $lte: monthEnd }
         });

         if (cashCount >= maxCash) {
             return res.status(400).json({ message: `You have reached the limit of ${maxCash} cash bookings per month. Please pay online.` });
         }
    }

    // --- FINANCIAL CALCULATIONS ---
    const adminRate = (config && typeof config.adminCommissionRate === 'number') ? config.adminCommissionRate : 10;
    const discountRate = (config && typeof config.userDiscountRate === 'number') ? config.userDiscountRate : 0;

    // Base Price logic:
    // parsedPrice (req.body.totalPrice) is what the user *sees* before Global Discount.
    // commissionBasePrice (req.body.commissionBasePrice) is the original sum of services (if combo used).
    // If commissionBasePrice is provided, Admin Commission is calculated on THAT, not the discounted combo price.
    const originalPrice = parsedPrice;
    const commissionBase = (req.body.commissionBasePrice && !isNaN(parseFloat(req.body.commissionBasePrice)))
                           ? parseFloat(req.body.commissionBasePrice)
                           : originalPrice;

    // Calculate Global Discount (Applied on the price the user sees)
    const discountAmount = roundMoney(originalPrice * (discountRate / 100));
    const finalPrice = roundMoney(originalPrice - discountAmount);

    // Admin Commission (Gross) calculated on commissionBase (Original Sum of Services)
    const adminCommission = roundMoney(commissionBase * (adminRate / 100));

    // Net Revenues
    // Admin Net = Commission - Global Discount (Admin absorbs Global discount)
    const adminNetRevenue = roundMoney(adminCommission - discountAmount);

    // Barber Net = Final Price (User Paid) - Admin Net Revenue
    // OR: Barber Net = (Original Combo Price - Global Discount) - (Commission - Global Discount)
    //                = Original Combo Price - Commission
    // Wait, let's verify logic:
    // Admin Keeps: adminCommission - globalDiscount.
    // User Pays: finalPrice.
    // Barber Keeps: finalPrice - AdminKeeps.
    const barberNetRevenue = roundMoney(finalPrice - adminNetRevenue);

    const collectedBy = (paymentMethod === 'UPI' || paymentMethod === 'ONLINE') ? 'ADMIN' : 'BARBER';

    const bookingData = {
      userId, shopId, barberId: assignedBarberId, serviceNames,
      totalPrice: finalPrice,

      originalPrice,
      discountAmount,
      finalPrice,

      adminCommission,
      adminNetRevenue,
      barberNetRevenue,

      amountCollectedBy: collectedBy,
      settlementStatus: 'PENDING',

      totalDuration: durationInt, date, startTime, endTime, 
      paymentMethod: paymentMethod || 'cash', 
      status,
      type: type || 'online',
      notes,
      bookingKey: Math.floor(1000 + Math.random() * 9000).toString()
    };

    const booking = await Booking.create(bookingData);

    res.status(201).json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Booking failed on server" });
  }
};

// --- 2. Get User Bookings ---
exports.getMyBookings = async (req, res) => {
  try {
    const { userId } = req.params;
    const bookings = await Booking.find({ userId })
      .populate('barberId', 'name')
      .populate({
        path: 'shopId',
        select: 'name address image coordinates ownerId',
        populate: {
          path: 'ownerId',
          select: 'phone'
        }
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
    const booking = await Booking.findByIdAndUpdate(id, { status: 'cancelled' }, { new: true });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json(booking);
  } catch (e) {
    res.status(500).json({ message: "Failed to cancel booking" });
  }
};

// --- 4. Get Shop Bookings (Owner View) ---
exports.getShopBookings = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { date, startDate, endDate } = req.query;

    const query = { shopId, status: { $ne: 'cancelled' } };

    if (date) {
        query.date = date;
    } else if (startDate && endDate) {
        query.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
        query.date = { $gte: startDate };
    }

    const bookings = await Booking.find(query)
      .populate('userId', 'name phone')
      .populate('barberId', 'name')
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

        const validStatuses = ['upcoming', 'cancelled', 'completed', 'no-show', 'checked-in'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const booking = await Booking.findById(id);
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        if (status === 'checked-in') {
             if (!bookingKey) {
                 return res.status(400).json({ message: "Customer PIN required for check-in." });
             }
             if (bookingKey !== booking.bookingKey) {
                 return res.status(403).json({ message: "Invalid PIN." });
             }
        }

        booking.status = status;
        await booking.save();

        res.json(booking);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to update booking status" });
    }
}
