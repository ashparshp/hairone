const Booking = require('../models/Booking');
const Barber = require('../models/Barber');
const { addMinutes, parse, format } = require('date-fns');

// --- Helper: Convert "HH:mm" to minutes ---
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// --- Helper: Strict Availability Check ---
// Returns true if the barber is free for the entire duration starting at startStr
const checkAvailability = async (barber, date, startStr, duration) => {
  const start = timeToMinutes(startStr);
  const end = start + duration;

  // 1. Shift Check
  // Service must start after shift start AND end before shift end
  if (start < timeToMinutes(barber.startHour) || end > timeToMinutes(barber.endHour)) {
    return false;
  }

  // 2. Break Check
  // Service cannot overlap with any break
  if (barber.breaks) {
    for (const br of barber.breaks) {
      const bStart = timeToMinutes(br.startTime);
      const bEnd = timeToMinutes(br.endTime);
      
      // Conflict if: Service Start < Break End AND Service End > Break Start
      if (start < bEnd && end > bStart) {
        return false;
      }
    }
  }

  // 3. Existing Bookings Check
  // Fetch only active bookings for this barber on this date
  const conflicts = await Booking.find({
    barberId: barber._id,
    date: date,
    status: { $ne: 'cancelled' },
  });

  for (const b of conflicts) {
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime);
    
    // Conflict if: Service Start < Booking End AND Service End > Booking Start
    if (start < bEnd && end > bStart) {
      return false;
    }
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
    // Basic Validation
    if (!startTime || !totalDuration || !date) {
      return res.status(400).json({ message: "Missing required booking details." });
    }

    let assignedBarberId = barberId;
    const durationInt = parseInt(totalDuration);

    // --- LOGIC A: Auto-Assign ("Any") ---
    if (!barberId || barberId === 'any') {
      // 1. Find all active barbers in this shop
      const allBarbers = await Barber.find({ shopId, isAvailable: true });
      
      // 2. Filter list: Keep only those free for this specific time slot
      const availableBarbers = [];
      for (const barber of allBarbers) {
        const isFree = await checkAvailability(barber, date, startTime, durationInt);
        if (isFree) {
          availableBarbers.push(barber);
        }
      }

      // 3. Handle no availability
      if (availableBarbers.length === 0) {
        return res.status(409).json({ message: "No barbers available for this slot." });
      }

      // 4. Random Assignment (Tie-breaker)
      const randomIndex = Math.floor(Math.random() * availableBarbers.length);
      assignedBarberId = availableBarbers[randomIndex]._id;
    } 
    // --- LOGIC B: Specific Barber ---
    else {
      const barber = await Barber.findById(barberId);
      if (!barber) return res.status(404).json({ message: "Barber not found" });
      
      const isFree = await checkAvailability(barber, date, startTime, durationInt);
      if (!isFree) {
        return res.status(409).json({ message: "Selected barber is no longer available." });
      }
    }

    // --- Calculate End Time String ---
    const startObj = parse(startTime, 'HH:mm', new Date());
    const endObj = addMinutes(startObj, durationInt);
    const endTime = format(endObj, 'HH:mm');

    // --- Save to Database ---
    const booking = await Booking.create({
      userId,
      shopId,
      barberId: assignedBarberId,
      serviceNames,
      totalPrice,
      totalDuration: durationInt,
      date,
      startTime,
      endTime,
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: 'pending', // Pending until fulfilled
      status: 'upcoming',
      bookingKey: Math.floor(1000 + Math.random() * 9000).toString()
    });

    res.status(201).json(booking);

  } catch (error) {
    console.error("Create Booking Error:", error);
    res.status(500).json({ message: "Booking failed on server" });
  }
};

// --- 2. Get User Bookings ---
exports.getMyBookings = async (req, res) => {
  try {
    const { userId } = req.params;
    const bookings = await Booking.find({ userId })
      .populate('barberId', 'name')
      .populate('shopId', 'name address image')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
};