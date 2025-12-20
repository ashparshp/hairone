const Shop = require('../models/Shop');
const Barber = require('../models/Barber');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { getISTTime } = require('../utils/dateUtils');
const { timeToMinutes, minutesToTime, getBarberScheduleForDate } = require('../utils/scheduleUtils');

// --- HELPER: Check strict availability based on resolved schedule ---
// Modified to accept duration INCLUDING buffer for the check
const isBarberFree = (schedule, startMinutes, totalDurationWithBuffer, busyRanges) => {
  const endMinutes = startMinutes + totalDurationWithBuffer;

  // 0. Check if open
  if (!schedule.isOpen) return false;

  // 1. Shift Check
  // Note: If the buffer pushes the "end" past the shift end, we might want to allow it
  // IF the buffer is just for cleanup. But usually cleanup is paid time for the barber.
  // We'll enforce that cleanup must happen within shift hours.
  if (startMinutes < schedule.start || endMinutes > schedule.end) return false;

  // 2. Break Check
  if (schedule.breaks) {
    for (const br of schedule.breaks) {
      // Conflict if Overlap
      if (startMinutes < br.end && endMinutes > br.start) {
        return false;
      }
    }
  }

  // 3. Busy Ranges (Bookings) Check
  // busyRanges already include the buffer of previous bookings on their 'end'
  const hasConflict = busyRanges.some(range => {
    // Check overlap:
    // New (start, end) vs Existing (range.start, range.end)
    return startMinutes < range.end && endMinutes > range.start;
  });

  return !hasConflict;
};

// --- 1. Create Shop (Fixed Role Update) ---
exports.createShop = async (req, res) => {
  try {
    const {
      name, address, lat, lng,
      bufferTime, minBookingNotice, maxBookingNotice, autoApproveBookings
    } = req.body;
    const ownerId = req.user.id;

    let imageUrl = req.file
      ? req.file.location 
      : 'https://via.placeholder.com/150';

    const shopData = {
      ownerId, 
      name, 
      address, 
      image: imageUrl, 
      services: [],
      rating: 5.0,
      type: 'unisex',
      bufferTime: bufferTime ? parseInt(bufferTime) : 0,
      minBookingNotice: minBookingNotice ? parseInt(minBookingNotice) : 60,
      maxBookingNotice: maxBookingNotice ? parseInt(maxBookingNotice) : 30,
      autoApproveBookings: autoApproveBookings !== undefined ? autoApproveBookings : true
    };

    if (lat !== undefined && lng !== undefined) {
      shopData.coordinates = { lat: parseFloat(lat), lng: parseFloat(lng) };
    }

    const shop = await Shop.create(shopData);
    
    // Update Role to 'owner' immediately
    await User.findByIdAndUpdate(ownerId, { myShopId: shop._id, role: 'owner' });

    res.status(201).json(shop);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to create shop" });
  }
};

// --- 2. Update Shop ---
exports.updateShop = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, address, type, lat, lng,
      bufferTime, minBookingNotice, maxBookingNotice, autoApproveBookings
    } = req.body;

    const updates = { address, type };
    if (name) updates.name = name;
    if (bufferTime !== undefined) updates.bufferTime = parseInt(bufferTime);
    if (minBookingNotice !== undefined) updates.minBookingNotice = parseInt(minBookingNotice);
    if (maxBookingNotice !== undefined) updates.maxBookingNotice = parseInt(maxBookingNotice);
    if (autoApproveBookings !== undefined) updates.autoApproveBookings = autoApproveBookings;

    if (lat !== undefined && lng !== undefined) {
      updates.coordinates = { lat: parseFloat(lat), lng: parseFloat(lng) };
    }
    if (req.file) {
      updates.image = req.file.location;
    }

    const shop = await Shop.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    );

    if (!shop) return res.status(404).json({ message: "Shop not found" });

    res.json(shop);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Update failed" });
  }
};

// --- 3. Get All Shops ---
exports.getAllShops = async (req, res) => {
  try {
    const { minTime } = req.query; 
    const shops = await Shop.find().lean();

    const shopsWithSlots = await Promise.all(shops.map(async (shop) => {
      const nextSlot = await findEarliestSlotForShop(shop, minTime);
      return { ...shop, nextAvailableSlot: nextSlot };
    }));

    shopsWithSlots.sort((a, b) => {
      if (!a.nextAvailableSlot) return 1;
      if (!b.nextAvailableSlot) return -1;
      return timeToMinutes(a.nextAvailableSlot) - timeToMinutes(b.nextAvailableSlot);
    });

    res.json(shopsWithSlots);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server Error" });
  }
};

// Helper for Home Screen Card Slot
const findEarliestSlotForShop = async (shop, minTimeStr = "00:00") => {
  const { date, minutes: currentISTMinutes } = getISTTime();
  const serviceDuration = 30;
  const bufferTime = shop.bufferTime || 0;

  const barbers = await Barber.find({ shopId: shop._id, isAvailable: true });
  if (barbers.length === 0) return null;

  const bookings = await Booking.find({
    barberId: { $in: barbers.map(b => b._id) },
    date: date,
    status: { $ne: 'cancelled' }
  });

  const bookingsMap = {};
  bookings.forEach(b => {
    if (!bookingsMap[b.barberId]) bookingsMap[b.barberId] = [];
    bookingsMap[b.barberId].push({
      start: timeToMinutes(b.startTime),
      end: timeToMinutes(b.endTime) + bufferTime
    });
  });

  let minStart = 24 * 60;
  let maxEnd = 0;

  const barberSchedules = {};
  barbers.forEach(b => {
    const schedule = getBarberScheduleForDate(b, date);
    barberSchedules[b._id] = schedule;
    if (schedule.isOpen) {
      if (schedule.start < minStart) minStart = schedule.start;
      if (schedule.end > maxEnd) maxEnd = schedule.end;
    }
  });

  if (minStart >= maxEnd) return null;

  const minFilter = timeToMinutes(minTimeStr);
  let current = Math.max(minStart, minFilter);

  current = Math.max(current, currentISTMinutes);

  while (current + serviceDuration <= maxEnd) {
    for (const barber of barbers) {
      const schedule = barberSchedules[barber._id];
      // Check using Duration + Buffer
      if (isBarberFree(schedule, current, serviceDuration + bufferTime, bookingsMap[barber._id] || [])) {
        return minutesToTime(current);
      }
    }
    current += 15;
  }
  return null; 
};

// --- 4. Get Shop Details ---
exports.getShopDetails = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    const barbers = await Barber.find({ shopId: shop._id });
    res.json({ shop, barbers });
  } catch (e) {
    res.status(500).json({ message: "Server Error" });
  }
};

// --- 5. Add Barber ---
exports.addBarber = async (req, res) => {
  const { shopId, name, startHour, endHour, breaks, weeklySchedule, specialHours } = req.body;
  try {
    const barber = await Barber.create({
      shopId, name, startHour, endHour,
      breaks: breaks || [],
      weeklySchedule: weeklySchedule || [],
      specialHours: specialHours || []
    });
    res.status(201).json(barber);
  } catch (e) {
    res.status(500).json({ message: "Failed to add barber" });
  }
};

// --- 6. Update Barber ---
exports.updateBarber = async (req, res) => {
  const { id } = req.params;
  const { startHour, endHour, breaks, isAvailable, weeklySchedule, specialHours } = req.body;
  try {
    const barber = await Barber.findByIdAndUpdate(id, {
      startHour, endHour, breaks, isAvailable,
      weeklySchedule, specialHours
    }, { new: true });
    res.json(barber);
  } catch (e) {
    res.status(500).json({ message: "Update failed" });
  }
};

// --- 7. Get Slots ---
exports.getShopSlots = async (req, res) => {
  const { shopId, barberId, date, duration } = req.body; 

  try {
    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const bufferTime = shop.bufferTime || 0;
    const serviceDuration = duration ? parseInt(duration) : 30;

    let barbersToCheck = [];
    if (barberId && barberId !== 'any') {
      const b = await Barber.findById(barberId);
      if (b) barbersToCheck = [b];
    } else {
      barbersToCheck = await Barber.find({ shopId, isAvailable: true });
    }

    if (barbersToCheck.length === 0) return res.json([]);

    const bookings = await Booking.find({
      barberId: { $in: barbersToCheck.map(b => b._id) },
      date: date,
      status: { $ne: 'cancelled' } 
    });

    const bookingsMap = {};
    bookings.forEach(b => {
      if (!bookingsMap[b.barberId]) bookingsMap[b.barberId] = [];
      bookingsMap[b.barberId].push({
        start: timeToMinutes(b.startTime),
        end: timeToMinutes(b.endTime) + bufferTime // Existing bookings occupy their duration + buffer
      });
    });

    // Resolve schedules
    const barberSchedules = {};
    let minStart = 24 * 60;
    let maxEnd = 0;

    barbersToCheck.forEach(b => {
      const schedule = getBarberScheduleForDate(b, date);
      barberSchedules[b._id] = schedule;
      if (schedule.isOpen) {
        if (schedule.start < minStart) minStart = schedule.start;
        if (schedule.end > maxEnd) maxEnd = schedule.end;
      }
    });

    if (minStart >= maxEnd) return res.json([]);

    const { date: istDate, minutes: istMinutes } = getISTTime();

    // If date is in the past, return empty
    if (date < istDate) return res.json([]);

    const slots = [];
    let current = minStart;

    let effectiveMinTime = -1;
    if (date === istDate) {
      effectiveMinTime = istMinutes + (shop.minBookingNotice || 0);
      current = Math.max(current, effectiveMinTime);
    }

    while (current + serviceDuration <= maxEnd) {
      let isSlotAvailable = false;
      for (const barber of barbersToCheck) {
        const schedule = barberSchedules[barber._id];
        const busyRanges = bookingsMap[barber._id] || [];
        // CHECK AVAILABILITY USING (DURATION + BUFFER)
        // This ensures the new slot has enough space for the service AND its buffer
        // before the next booked event or end of shift.
        if (isBarberFree(schedule, current, serviceDuration + bufferTime, busyRanges)) {
          isSlotAvailable = true;
          break; 
        }
      }

      if (isSlotAvailable) slots.push(minutesToTime(current));
      
      current += 15;
    }

    res.json(slots);

  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Could not fetch slots" });
  }
};

// --- 8. Add Service ---
exports.addShopService = async (req, res) => {
  const { id } = req.params;
  const { name, price, duration } = req.body;
  try {
    const shop = await Shop.findByIdAndUpdate(
      id,
      { $push: { services: { name, price, duration: parseInt(duration), isAvailable: true } } },
      { new: true }
    );
    res.json(shop);
  } catch (e) {
    res.status(500).json({ message: "Failed to add service" });
  }
};

// --- 9. Delete Service ---
exports.deleteShopService = async (req, res) => {
  const { id, serviceId } = req.params;
  try {
    const shop = await Shop.findByIdAndUpdate(
      id,
      { $pull: { services: { _id: serviceId } } },
      { new: true }
    );
    res.json(shop);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to delete service" });
  }
};

// --- 10. Update Service (Toggle Availability) ---
exports.updateShopService = async (req, res) => {
  const { id, serviceId } = req.params;
  const { isAvailable } = req.body;

  try {
    const shop = await Shop.findOneAndUpdate(
      { _id: id, "services._id": serviceId },
      { $set: { "services.$.isAvailable": isAvailable } },
      { new: true }
    );
    res.json(shop);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update service" });
  }
};

// --- 11. Get User Favorites ---
exports.getUserFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('favorites');
    res.json(user.favorites || []);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch favorites" });
  }
};
