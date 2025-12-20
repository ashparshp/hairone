const Booking = require('../models/Booking');
const Barber = require('../models/Barber');
const Shop = require('../models/Shop');
const { addMinutes, parse, format } = require('date-fns');
const { getISTTime, timeToMinutes, getBarberSchedule } = require('../utils/dateUtils');

// --- Helper: Availability Check ---
const checkAvailability = async (barber, date, startStr, duration, bufferTime = 0) => {
  const start = timeToMinutes(startStr);
  const serviceEnd = start + duration;
  const slotEndWithBuffer = serviceEnd + bufferTime;

  const schedule = getBarberSchedule(barber, date);

  if (schedule.isOff) return false;

  // Service must end by closing time
  if (start < schedule.start || serviceEnd > schedule.end) return false;

  if (barber.breaks) {
    for (const br of barber.breaks) {
      const brStart = timeToMinutes(br.startTime);
      const brEnd = timeToMinutes(br.endTime);
      // Conflict if Overlap with service
      if (start < brEnd && serviceEnd > brStart) return false;
    }
  }

  const conflicts = await Booking.find({
    barberId: barber._id,
    date: date,
    status: { $ne: 'cancelled' },
  });

  for (const b of conflicts) {
    // Conflict check with buffer
    // Existing bookings should also have buffer.
    // However, existing bookings in DB only store start/end (service duration).
    // We need to assume the buffer is applied AFTER the existing booking.
    // So existing booking effectively occupies [b.start, b.end + buffer].
    // Our new slot occupies [start, slotEndWithBuffer].

    // BUT we don't store buffer in booking, it's on Shop.
    // For now we assume bufferTime passed in is the shop's buffer.
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime) + bufferTime;

    if (start < bEnd && slotEndWithBuffer > bStart) return false;
  }
  return true;
};

// --- 1. Create Booking ---
exports.createBooking = async (req, res) => {
  const { 
    userId, shopId, barberId, serviceNames, 
    totalPrice, totalDuration, date, startTime,
    paymentMethod 
  } = req.body;

  try {
    if (!startTime || !totalDuration || !date) {
      return res.status(400).json({ message: "Missing required booking details." });
    }

    // Validate Past Time
    const { date: istDate, minutes: istMinutes } = getISTTime();
    if (date < istDate) {
      return res.status(400).json({ message: "Cannot book for a past date." });
    }

    // Fetch Shop Settings for Constraints
    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    // Min Booking Notice Check
    if (date === istDate) {
      if (timeToMinutes(startTime) < istMinutes) {
        return res.status(400).json({ message: "Cannot book for a past time." });
      }
      if (timeToMinutes(startTime) < istMinutes + shop.minBookingNotice) {
        return res.status(400).json({ message: `Must book at least ${shop.minBookingNotice} minutes in advance.` });
      }
    }

    // Max Booking Notice Check
    const requestDate = parse(date, 'yyyy-MM-dd', new Date());
    const currentDate = parse(istDate, 'yyyy-MM-dd', new Date());
    const diffTime = requestDate - currentDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > shop.maxBookingNotice) {
      return res.status(400).json({ message: `Cannot book more than ${shop.maxBookingNotice} days in advance.` });
    }

    let assignedBarberId = barberId;
    const durationInt = parseInt(totalDuration);

    // Auto-Assign ("Any")
    if (!barberId || barberId === 'any') {
      const allBarbers = await Barber.find({ shopId, isAvailable: true });
      const availableBarbers = [];
      for (const barber of allBarbers) {
        if (await checkAvailability(barber, date, startTime, durationInt, shop.bufferTime)) {
          availableBarbers.push(barber);
        }
      }

      if (availableBarbers.length === 0) return res.status(409).json({ message: "Slot no longer available." });
      
      // Randomly pick one to balance load
      const randomIndex = Math.floor(Math.random() * availableBarbers.length);
      assignedBarberId = availableBarbers[randomIndex]._id;
    } else {
      const barber = await Barber.findById(barberId);
      if (!barber) return res.status(404).json({ message: "Barber not found" });
      if (!(await checkAvailability(barber, date, startTime, durationInt, shop.bufferTime))) {
        return res.status(409).json({ message: "Barber unavailable." });
      }
    }

    const startObj = parse(startTime, 'HH:mm', new Date());
    const endObj = addMinutes(startObj, durationInt);
    const endTime = format(endObj, 'HH:mm');

    const status = shop.autoApproveBookings ? 'upcoming' : 'pending';

    const booking = await Booking.create({
      userId, shopId, barberId: assignedBarberId, serviceNames, totalPrice, 
      totalDuration: durationInt, date, startTime, endTime, 
      paymentMethod: paymentMethod || 'cash', 
      status: status,
      bookingKey: Math.floor(1000 + Math.random() * 9000).toString()
    });

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
      // --- START CHANGE ---
      .populate({
        path: 'shopId',
        // 1. Fetch 'coordinates' and 'ownerId' alongside basic info
        select: 'name address image coordinates ownerId',
        // 2. Populate the 'ownerId' to get the phone number from the User model
        populate: {
          path: 'ownerId',
          select: 'phone'
        }
      })
      // --- END CHANGE ---
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error(error); // Log error for debugging
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

// --- 4. Get Shop Bookings (Owner View) - ADDED THIS ---
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
};// --- 5. Block Slot (Walk-in / Owner Block) ---
exports.blockSlot = async (req, res) => {
  const { shopId, barberId, date, startTime, duration, reason } = req.body;

  try {
    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    // Blocked slots bypass minBookingNotice/maxBookingNotice because the owner does it.

    const durationInt = parseInt(duration || 30);
    const barber = await Barber.findById(barberId);
    if (!barber) return res.status(404).json({ message: "Barber not found" });

    // Enforce availability check to prevent double booking.
    if (!(await checkAvailability(barber, date, startTime, durationInt, shop.bufferTime))) {
       return res.status(409).json({ message: "Slot is already booked or unavailable." });
    }

    const startObj = parse(startTime, 'HH:mm', new Date());
    const endObj = addMinutes(startObj, durationInt);
    const endTime = format(endObj, 'HH:mm');

    const booking = await Booking.create({
      userId: req.user.id, // Owner
      shopId,
      barberId,
      serviceNames: [reason || 'Blocked Slot'],
      totalPrice: 0,
      totalDuration: durationInt,
      date,
      startTime,
      endTime,
      type: 'blocked',
      status: 'upcoming',
      bookingKey: 'BLOCK-' + Math.floor(1000 + Math.random() * 9000).toString()
    });

    res.status(201).json(booking);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to block slot" });
  }
};

// --- 6. Approve Booking ---
exports.approveBooking = async (req, res) => {
  const { id } = req.params;
  try {
    const booking = await Booking.findByIdAndUpdate(id, { status: 'upcoming' }, { new: true });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json(booking);
  } catch (e) {
    res.status(500).json({ message: "Failed to approve booking" });
  }
};
