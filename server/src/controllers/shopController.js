const Shop = require('../models/Shop');
const Barber = require('../models/Barber');
const User = require('../models/User');
const Booking = require('../models/Booking');

// --- HELPER: Convert "HH:mm" to minutes (e.g., "10:30" -> 630) ---
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// --- HELPER: Convert minutes back to "HH:mm" ---
const minutesToTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// --- HELPER: Check strict availability for a specific barber ---
// Checks if the barber is free from 'startMinutes' for 'duration' minutes
const isBarberFree = (barber, startMinutes, duration, busyRanges) => {
  const endMinutes = startMinutes + duration;

  // 1. Shift Check
  const shiftStart = timeToMinutes(barber.startHour);
  const shiftEnd = timeToMinutes(barber.endHour);
  
  // If the service starts before shift or ends after shift -> Not Free
  if (startMinutes < shiftStart || endMinutes > shiftEnd) return false;

  // 2. Break Check
  if (barber.breaks) {
    for (const br of barber.breaks) {
      const brStart = timeToMinutes(br.startTime);
      const brEnd = timeToMinutes(br.endTime);

      // Check Overlap:
      // A conflict exists if the service time overlaps the break time.
      // Logic: (Start < BreakEnd) AND (End > BreakStart)
      if (startMinutes < brEnd && endMinutes > brStart) {
        return false;
      }
    }
  }

  // 3. Existing Bookings Check (Busy Ranges)
  // busyRanges = array of { start, end } in minutes
  const hasConflict = busyRanges.some(range => {
    // Conflict if ranges overlap
    return startMinutes < range.end && endMinutes > range.start;
  });

  return !hasConflict;
};

// --- 1. Create Shop ---
exports.createShop = async (req, res) => {
  try {
    const { name, address } = req.body;
    const ownerId = req.user.id;

    // Handle Image Upload
    let imageUrl = '';
    if (req.file) {
      const protocol = req.protocol;
      const host = req.get('host');
      imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    } else {
      imageUrl = "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800";
    }

    const defaultServices = [
      { name: "Classic Haircut", price: 350, duration: 30 },
      { name: "Beard Trim", price: 150, duration: 20 },
      { name: "Skin Fade", price: 500, duration: 45 }
    ];

    const shop = await Shop.create({ 
      ownerId, 
      name, 
      address, 
      image: imageUrl, 
      services: defaultServices,
      rating: 5.0 
    });
    
    // Link shop to owner
    await User.findByIdAndUpdate(ownerId, { myShopId: shop._id });

    res.status(201).json(shop);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to create shop" });
  }
};

// --- HELPER: Find earliest slot for a shop ---
const findEarliestSlotForShop = async (shopId, minTimeStr = "00:00") => {
  const date = new Date().toISOString().split('T')[0]; // Today
  const serviceDuration = 30; // Default check duration

  // 1. Get Barbers
  const barbers = await Barber.find({ shopId, isAvailable: true });
  if (barbers.length === 0) return null;

  // 2. Get Bookings
  const barberIds = barbers.map(b => b._id);
  const bookings = await Booking.find({
    barberId: { $in: barberIds },
    date: date,
    status: { $ne: 'cancelled' }
  });

  // 3. Build Busy Map
  const bookingsMap = {};
  bookings.forEach(b => {
    if (!bookingsMap[b.barberId]) bookingsMap[b.barberId] = [];
    bookingsMap[b.barberId].push({
      start: timeToMinutes(b.startTime),
      end: timeToMinutes(b.endTime)
    });
  });

  // 4. Determine Search Window
  let minStart = 24 * 60;
  let maxEnd = 0;

  barbers.forEach(b => {
    const s = timeToMinutes(b.startHour);
    const e = timeToMinutes(b.endHour);
    if (s < minStart) minStart = s;
    if (e > maxEnd) maxEnd = e;
  });

  if (minStart >= maxEnd) {
     minStart = 9 * 60;
     maxEnd = 20 * 60;
  }

  // Apply minTime filter if provided
  const minTimeMinutes = timeToMinutes(minTimeStr);
  let current = Math.max(minStart, minTimeMinutes);

  // 5. Find First Slot
  while (current + serviceDuration <= maxEnd) {
    for (const barber of barbers) {
      const busyRanges = bookingsMap[barber._id] || [];
      if (isBarberFree(barber, current, serviceDuration, busyRanges)) {
        return minutesToTime(current);
      }
    }
    current += 30;
  }

  return null;
};

// --- 2. Get All Shops ---
exports.getAllShops = async (req, res) => {
  try {
    const { minTime } = req.query; // e.g., "14:00"
    const shops = await Shop.find().lean(); // Use lean() to modify objects

    // Calculate next available slot for each shop
    const shopsWithSlots = await Promise.all(shops.map(async (shop) => {
      const nextSlot = await findEarliestSlotForShop(shop._id, minTime);
      return { ...shop, nextAvailableSlot: nextSlot };
    }));

    // Filter out shops with no availability if a filter was strictly requested?
    // The prompt says "show the shop which has earliest available after 2 in a order".
    // It implies we should still show them, just sorted. Or maybe filter them out if they are closed.
    // I'll keep them but sort them to the bottom if null.

    shopsWithSlots.sort((a, b) => {
      if (!a.nextAvailableSlot) return 1;
      if (!b.nextAvailableSlot) return -1;
      return timeToMinutes(a.nextAvailableSlot) - timeToMinutes(b.nextAvailableSlot);
    });

    res.json(shopsWithSlots);
  } catch (e) {
    console.error("Get All Shops Error:", e);
    res.status(500).json({ message: "Server Error" });
  }
};

// --- 3. Get Shop Details ---
exports.getShopDetails = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const barbers = await Barber.find({ shopId: shop._id });

    res.json({ shop, barbers });
  } catch (e) {
    console.error("Get Shop Details Error:", e);
    res.status(500).json({ message: "Server Error" });
  }
};

// --- 4. Add Barber ---
exports.addBarber = async (req, res) => {
  const { shopId, name, startHour, endHour, breaks } = req.body;
  try {
    const barber = await Barber.create({
      shopId,
      name,
      startHour,
      endHour,
      breaks: breaks || []
    });
    res.status(201).json(barber);
  } catch (e) {
    res.status(500).json({ message: "Failed to add barber" });
  }
};

// --- 5. Update Barber ---
exports.updateBarber = async (req, res) => {
  const { id } = req.params;
  const { startHour, endHour, breaks, isAvailable } = req.body;
  
  try {
    const barber = await Barber.findByIdAndUpdate(
      id, 
      { startHour, endHour, breaks, isAvailable },
      { new: true }
    );
    res.json(barber);
  } catch (e) {
    res.status(500).json({ message: "Update failed" });
  }
};

// --- 6. Get Available Slots (The Core Logic) ---
exports.getShopSlots = async (req, res) => {
  const { shopId, barberId, date, duration } = req.body; 

  try {
    // 1. Default Duration logic (fallback to 30 mins if not provided)
    const serviceDuration = duration ? parseInt(duration) : 30;

    // 2. Identify which barbers to check
    let barbersToCheck = [];
    if (barberId && barberId !== 'any') {
      // Specific Barber
      const b = await Barber.findById(barberId);
      if (b) barbersToCheck = [b];
    } else {
      // "Any" logic: Check ALL available barbers in the shop
      barbersToCheck = await Barber.find({ shopId, isAvailable: true });
    }

    if (barbersToCheck.length === 0) return res.json([]);

    // 3. Fetch Bookings for these barbers on the specific date
    const relevantBarberIds = barbersToCheck.map(b => b._id);
    const bookings = await Booking.find({
      barberId: { $in: relevantBarberIds },
      date: date,
      status: { $ne: 'cancelled' } 
    });

    // 4. Create a "Busy Map" for fast lookup
    // Format: { 'barberId_1': [{start: 600, end: 630}, ...], 'barberId_2': ... }
    const bookingsMap = {};
    bookings.forEach(b => {
      if (!bookingsMap[b.barberId]) bookingsMap[b.barberId] = [];
      bookingsMap[b.barberId].push({
        start: timeToMinutes(b.startTime),
        end: timeToMinutes(b.endTime)
      });
    });

    // 5. Determine the shop's operating window
    // We scan all barbers to find the earliest open time and latest close time.
    let minStart = 24 * 60;
    let maxEnd = 0;

    barbersToCheck.forEach(b => {
      const s = timeToMinutes(b.startHour);
      const e = timeToMinutes(b.endHour);
      if (s < minStart) minStart = s;
      if (e > maxEnd) maxEnd = e;
    });

    // Fallback if data is missing
    if (minStart >= maxEnd) {
       minStart = 9 * 60; // 09:00
       maxEnd = 20 * 60;  // 20:00
    }

    const slots = [];
    let current = minStart;

    // 6. Iterate through the day in 30-min increments
    while (current + serviceDuration <= maxEnd) {
      const slotStart = current;
      
      let isSlotAvailable = false;

      // Check if AT LEAST ONE barber is free for this slot + duration
      for (const barber of barbersToCheck) {
        const busyRanges = bookingsMap[barber._id] || [];
        
        // Pass the requested duration to the helper
        if (isBarberFree(barber, slotStart, serviceDuration, busyRanges)) {
          isSlotAvailable = true;
          break; // Found a match, no need to check other barbers for this time
        }
      }

      if (isSlotAvailable) {
        slots.push(minutesToTime(current));
      }

      current += 30; // Step forward by 30 mins
    }

    res.json(slots);

  } catch (e) {
    console.error("Slot Error:", e);
    res.status(500).json({ message: "Could not fetch slots" });
  }
};