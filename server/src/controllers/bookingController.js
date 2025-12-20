const Booking = require('../models/Booking');
const Barber = require('../models/Barber');
const Shop = require('../models/Shop');
const { addMinutes, parse, format, differenceInDays } = require('date-fns');
const { getISTTime } = require('../utils/dateUtils');
const { timeToMinutes, getBarberScheduleForDate } = require('../utils/scheduleUtils');

// --- Helper: Availability Check ---
// We pass (duration + bufferTime) as 'duration' to ensure the buffer is accounted for
// in the slot space required.
const checkAvailability = async (barber, date, startStr, duration, bufferTime = 0) => {
  const start = timeToMinutes(startStr);

  // The TOTAL slot needed is Duration + Buffer.
  // This ensures we don't start a booking if there isn't enough time for the buffer afterwards.
  const end = start + duration + bufferTime;

  // Resolve schedule
  const schedule = getBarberScheduleForDate(barber, date);

  if (!schedule.isOpen) return false;

  // Shift Check: The service + buffer must fit within the shift?
  // Usually buffer (cleanup) happens within working hours.
  if (start < schedule.start || end > schedule.end) return false;

  // Check breaks
  if (schedule.breaks) {
    for (const br of schedule.breaks) {
      // If the booking+buffer overlaps with a break
      if (start < br.end && end > br.start) return false;
    }
  }

  const conflicts = await Booking.find({
    barberId: barber._id,
    date: date,
    status: { $ne: 'cancelled' },
  });

  for (const b of conflicts) {
    const bStart = timeToMinutes(b.startTime);
    // Existing bookings ALSO have a buffer that makes them "busy" longer.
    // So busy range is [bStart, bEnd + bufferTime]
    const bEnd = timeToMinutes(b.endTime) + bufferTime;

    // Check overlap between [start, end] and [bStart, bEnd]
    // where 'end' is newBooking.end + buffer
    // and 'bEnd' is oldBooking.end + buffer
    if (start < bEnd && end > bStart) return false;
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

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const bufferTime = shop.bufferTime || 0;
    const minNotice = shop.minBookingNotice || 0; // minutes
    const maxNotice = shop.maxBookingNotice || 30; // days
    const autoApprove = shop.autoApproveBookings !== false;

    // Validate Past Time & Notice
    const { date: istDate, minutes: istMinutes } = getISTTime();

    // Check max notice (Skip for special types)
    const isSpecialType = type === 'walk-in' || type === 'blocked';

    if (!isSpecialType) {
      const daysDiff = differenceInDays(new Date(date), new Date(istDate));
      if (daysDiff > maxNotice) {
        return res.status(400).json({ message: `Cannot book more than ${maxNotice} days in advance.` });
      }

      // Check min notice
      const bookingStartMinutes = timeToMinutes(startTime);
      if (date < istDate) {
        return res.status(400).json({ message: "Cannot book for a past date." });
      }
      if (date === istDate) {
        if (bookingStartMinutes < istMinutes) {
          return res.status(400).json({ message: "Cannot book for a past time." });
        }
        if (bookingStartMinutes < istMinutes + minNotice) {
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

    // Determine status
    let status = 'upcoming';
    if (type === 'blocked') {
        status = 'blocked';
    } else if (!autoApprove && type !== 'walk-in') {
        status = 'pending';
    }

    // Allow walk-in or blocked without userId
    if (!userId && type !== 'blocked' && type !== 'walk-in') {
        return res.status(400).json({ message: "User ID required for online bookings." });
    }

    const bookingData = {
      userId, shopId, barberId: assignedBarberId, serviceNames, totalPrice, 
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
    const { date } = req.query;

    const query = { shopId, status: { $ne: 'cancelled' } };
    if (date) query.date = date;

    const bookings = await Booking.find(query)
      .populate('userId', 'name phone')
      .populate('barberId', 'name')
      .sort({ startTime: 1 });

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
        const { status } = req.body;

        const validStatuses = ['upcoming', 'cancelled', 'completed', 'no-show', 'checked-in'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const booking = await Booking.findByIdAndUpdate(id, { status }, { new: true });
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        res.json(booking);
    } catch (e) {
        res.status(500).json({ message: "Failed to update booking status" });
    }
}
