const Booking = require('../models/Booking');
const Barber = require('../models/Barber');
const Shop = require('../models/Shop');
const SystemConfig = require('../models/SystemConfig');
const { addMinutes, parse, format, differenceInDays, subDays, startOfMonth, endOfMonth } = require('date-fns');
const { getISTTime } = require('../utils/dateUtils');
const { timeToMinutes, getBarberScheduleForDate } = require('../utils/scheduleUtils');
const { calculateDistance } = require('../utils/geoUtils');

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

// --- Helper: Availability Check ---
const checkAvailability = async (barber, date, startStr, duration, bufferTime = 0, isHomeService = false, homeServiceConfig = {}) => {
  let start = timeToMinutes(startStr);
  let end = start + duration + bufferTime;

  // Apply Home Service Buffers
  if (isHomeService) {
      const travelTime = (homeServiceConfig && homeServiceConfig.travelTimeMin) ? homeServiceConfig.travelTimeMin : 30;
      // Barber needs to travel BEFORE the start time and AFTER the service (plus buffer)
      start -= travelTime;
      end += travelTime;
      // Note: bufferTime usually pads the end. We added travelTime to end.
      // So Block = [Start - Travel] to [Start + Duration + Buffer + Travel].
  }

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

    // Home Service Validations
    let finalTravelFee = 0;
    if (req.body.isHomeService) {
        // 1. Check Shop Eligibility
        if (!shop.homeService || !shop.homeService.isAvailable) {
            return res.status(400).json({ message: "This shop does not offer home services." });
        }

        // 2. Check Barber Eligibility (if specific barber selected)
        if (barberId && barberId !== 'any') {
            const b = await Barber.findById(barberId);
            if (!b) return res.status(404).json({ message: "Barber not found" });
            if (!b.isHomeServiceAvailable) {
                return res.status(400).json({ message: "Selected barber does not provide home services." });
            }
        }
    } else {
        // Shop Booking Validation
        // Check if barber allows shop services
        if (barberId && barberId !== 'any') {
            const b = await Barber.findById(barberId);
            if (!b) return res.status(404).json({ message: "Barber not found" });
            if (b.isShopServiceAvailable === false) { // Default is true, explicit check for false
                return res.status(400).json({ message: "Selected barber does not provide in-shop services." });
            }
        }

        // 3. Check Minimum Order Value
        if (shop.homeService.minOrderValue && parsedPrice < shop.homeService.minOrderValue) {
            return res.status(400).json({ message: `Minimum order value for home service is ${shop.homeService.minOrderValue}.` });
        }

        // 4. Check Payment Method Preference
        if (shop.homeService.paymentPreference === 'ONLINE_ONLY') {
            if (paymentMethod === 'cash' || paymentMethod === 'CASH' || paymentMethod === 'PAY_AT_VENUE') {
                return res.status(400).json({ message: "This shop only accepts online payment for home services." });
            }
        }

        // 5. Radius Check (if coordinates provided)
        // Note: The frontend should theoretically validate this, but backend validation is safer.
        // We need user coordinates from the request body.
        const { deliveryAddress } = req.body;
        if (!deliveryAddress || !deliveryAddress.coordinates) {
             return res.status(400).json({ message: "Delivery address coordinates are required." });
        }

        if (shop.coordinates && shop.coordinates.lat && deliveryAddress.coordinates.lat) {
             const dist = calculateDistance(
                 deliveryAddress.coordinates.lat,
                 deliveryAddress.coordinates.lng,
                 shop.coordinates.lat,
                 shop.coordinates.lng
             );
             if (dist > (shop.homeService.radiusKm || 5)) {
                 return res.status(400).json({ message: "Your location is outside the shop's service area." });
             }
        }

        finalTravelFee = shop.homeService.travelFee || 0;
    }

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

      // Determine effective duration with Travel Time for Home Services
      let effectiveDuration = durationInt;
      let effectiveStartTime = startTime;
      // `checkAvailability` takes string start time.
      // If we need to buffer travel time, we should adjust the passed parameters or modify `checkAvailability`.
      // Since `checkAvailability` logic is internal, let's keep it simple here.
      // BUT `checkAvailability` does NOT know about travel time unless we pass a modified duration/start.
      // Or we can pass `bufferTime` to `checkAvailability`.
      // If Home Service, bufferTime should include travelTime * 2 (roughly) to pad the slot.

      let effectiveBuffer = bufferTime;
      if (req.body.isHomeService) {
          const travelTime = (shop.homeService && shop.homeService.travelTimeMin) ? shop.homeService.travelTimeMin : 30;
          // As discussed in ShopController, we pad the service block.
          // Since `checkAvailability` checks strict overlap: `start < existing.end && end > existing.start`.
          // We want to ensure [T-Travel] to [T+Duration+Travel] is free.
          // `checkAvailability` calculates `start = timeToMinutes(startStr)` and `end = start + duration + bufferTime`.
          // To cover Pre-Travel, we can pretend the start time is earlier.
          // BUT `startTime` is passed as "HH:mm". Shifting it is messy with string parsing here.
          // Better: Increase `bufferTime` by `2 * travelTime` AND shift `startTime` back by `travelTime`? No.
          // Logic: The *Barber* is busy for `Duration + 2*Travel`.
          // If we pass `bufferTime += 2 * travelTime`. The block becomes `Start` to `Start + Duration + 2*Travel`.
          // This covers `Start -> End + Travel` (Post-travel) but implies Pre-travel happens *during* the service time? No.
          // It implies the "Busy Block" starts at "Start Time".
          // If "Start Time" is Customer Appointment time, the Barber is busy starting at "Start Time - Travel".
          // This "shift back" is critical to avoid clash with a prior booking ending at 9:55 if Appt is 10:00.

          // Since `checkAvailability` is a local helper in this file, I should modify `checkAvailability` signature or logic
          // to accept `travelTime` or similar. But `checkAvailability` is outside `exports`.
          // I will modify `checkAvailability` to accept an `extraPadding` object or similar if I can edit it.
          // I will edit `checkAvailability` in the next step. For now, I will prepare the call.
          // Let's pass `travelTime` as an argument if I modify the definition.
          // I will modify `checkAvailability` to accept `travelTime` buffer logic.
      }

      for (const barber of allBarbers) {
        // For Home Service, skip barbers who don't do home visits
        if (req.body.isHomeService && !barber.isHomeServiceAvailable) continue;
        // For Shop Service, skip barbers who don't do shop visits
        if (!req.body.isHomeService && barber.isShopServiceAvailable === false) continue;

        // Note: I will update checkAvailability signature below to accept isHomeService and shop config
        if (await checkAvailability(barber, date, startTime, durationInt, bufferTime, req.body.isHomeService, shop.homeService)) {
          availableBarbers.push(barber);
        }
      }

      if (availableBarbers.length === 0) return res.status(409).json({ message: "Slot no longer available." });
      
      const randomIndex = Math.floor(Math.random() * availableBarbers.length);
      assignedBarberId = availableBarbers[randomIndex]._id;
    } else {
      const barber = await Barber.findById(barberId);
      if (!barber) return res.status(404).json({ message: "Barber not found" });
      if (!(await checkAvailability(barber, date, startTime, durationInt, bufferTime, req.body.isHomeService, shop.homeService))) {
        return res.status(409).json({ message: "Barber unavailable." });
      }
    }

    const startObj = parse(startTime, 'HH:mm', new Date());
    const endObj = addMinutes(startObj, durationInt);
    const endTime = format(endObj, 'HH:mm');

    let status = 'upcoming';
    if (type === 'blocked') {
        status = 'blocked';
    } else if (req.body.isHomeService) {
        status = 'pending'; // Always pending for home services
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

    // --- FINANCIAL CALCULATIONS ------------------------------------------------------------------
    // 1. Get Global Rates (or defaults)
    const adminRate = (config && typeof config.adminCommissionRate === 'number') ? config.adminCommissionRate : 10;
    const discountRate = (config && typeof config.userDiscountRate === 'number') ? config.userDiscountRate : 0;

    const originalPrice = parsedPrice;

    // Add Travel Fee to Base Price for Commission calculation?
    // Requirement: "always take set percentage on overall cost."
    // So Commission Base = Service Price + Travel Fee
    const commissionBase = originalPrice + finalTravelFee;

    // 2. Calculate Discount (Subsidized by Admin usually, but here it reduces the final price)
    const discountAmount = roundMoney(originalPrice * (discountRate / 100));
    const finalPrice = roundMoney(originalPrice + finalTravelFee - discountAmount);

    // 3. Admin Commission (Gross) - Calculated on the TOTAL price
    const adminCommission = roundMoney(commissionBase * (adminRate / 100));

    // 4. Net Revenues
    // Admin Net = Commission - Discount (Admin absorbs the discount cost)
    const adminNetRevenue = roundMoney(adminCommission - discountAmount);

    // Barber Net = Total (Base+Fee) - Commission
    const barberNetRevenue = roundMoney(commissionBase - adminCommission);

    // 5. Determine who holds the cash right now?
    // - If Online/UPI: Admin has it.
    // - If Cash: Barber/Shop has it.
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

      isHomeService: req.body.isHomeService || false,
      deliveryAddress: req.body.deliveryAddress,
      travelFee: finalTravelFee,

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
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // Home Service Cancellation Logic
    if (booking.isHomeService) {
        // Calculate hours until booking
        const bookingDateTime = parse(`${booking.date} ${booking.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
        const now = new Date();
        const diffHours = (bookingDateTime - now) / 36e5;

        let refundAmount = booking.finalPrice; // Default full refund

        // "if booking cancel before 2 hours then 100% refund else make it customising..."
        if (diffHours < 2) {
             const shop = await Shop.findById(booking.shopId);
             if (shop && shop.homeService && shop.homeService.lateCancellationFeePercent > 0) {
                 const feePercent = shop.homeService.lateCancellationFeePercent;
                 const penalty = roundMoney(booking.finalPrice * (feePercent / 100));
                 refundAmount = roundMoney(booking.finalPrice - penalty);

                 // TODO: Process Partial Refund via Payment Gateway if paid online
                 // For now, we just log/store the penalty logic.
                 // Ideally we should update the booking to indicate a penalty was charged.
                 // We'll update the notes to reflect this.
                 booking.notes = (booking.notes || "") + ` | Late Cancellation Fee: ${penalty}. Refund: ${refundAmount}.`;
             }
        }

        // If shop cancels (we need to know who is cancelling), refund is 100%.
        // Assuming this endpoint is called by User. If Admin/Shop calls, we might need a flag.
        // For MVP, applying the logic based on time.
    }

    booking.status = 'cancelled';
    await booking.save();
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
