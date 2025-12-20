const Booking = require('../models/Booking');
const Barber = require('../models/Barber');
const { addMinutes, parse, format } = require('date-fns');
const { getISTTime } = require('../utils/dateUtils');

// --- Helper: Convert "HH:mm" to minutes ---
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// --- Helper: Availability Check ---
const checkAvailability = async (barber, date, startStr, duration) => {
  const start = timeToMinutes(startStr);
  const end = start + duration;

  if (start < timeToMinutes(barber.startHour) || end > timeToMinutes(barber.endHour)) return false;

  if (barber.breaks) {
    for (const br of barber.breaks) {
      if (start < timeToMinutes(br.endTime) && end > timeToMinutes(br.startTime)) return false;
    }
  }

  const conflicts = await Booking.find({
    barberId: barber._id,
    date: date,
    status: { $ne: 'cancelled' },
  });

  for (const b of conflicts) {
    if (start < timeToMinutes(b.endTime) && end > timeToMinutes(b.startTime)) return false;
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
    if (date === istDate) {
      if (timeToMinutes(startTime) < istMinutes) {
        return res.status(400).json({ message: "Cannot book for a past time." });
      }
    }

    let assignedBarberId = barberId;
    const durationInt = parseInt(totalDuration);

    // Auto-Assign ("Any")
    if (!barberId || barberId === 'any') {
      const allBarbers = await Barber.find({ shopId, isAvailable: true });
      const availableBarbers = [];
      for (const barber of allBarbers) {
        if (await checkAvailability(barber, date, startTime, durationInt)) {
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
      if (!(await checkAvailability(barber, date, startTime, durationInt))) {
        return res.status(409).json({ message: "Barber unavailable." });
      }
    }

    const startObj = parse(startTime, 'HH:mm', new Date());
    const endObj = addMinutes(startObj, durationInt);
    const endTime = format(endObj, 'HH:mm');

    const booking = await Booking.create({
      userId, shopId, barberId: assignedBarberId, serviceNames, totalPrice, 
      totalDuration: durationInt, date, startTime, endTime, 
      paymentMethod: paymentMethod || 'cash', 
      status: 'upcoming', bookingKey: Math.floor(1000 + Math.random() * 9000).toString()
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
};

// --- 5. Update Booking Status (Complete / No-Show) ---
exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['completed', 'no-show'].includes(status)) {
      return res.status(400).json({ message: "Invalid status update" });
    }

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.status !== 'upcoming') {
      return res.status(400).json({ message: `Cannot update booking that is already ${booking.status}` });
    }

    booking.status = status;
    await booking.save();

    res.json(booking);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update status" });
  }
};