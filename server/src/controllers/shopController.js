const Shop = require('../models/Shop');
const Barber = require('../models/Barber');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { getISTTime } = require('../utils/dateUtils');
const { timeToMinutes, minutesToTime, getBarberScheduleForDate } = require('../utils/scheduleUtils');
const { subDays, format } = require('date-fns');

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
    const { minTime, type } = req.query;

    const query = {};
    if (type && type !== 'all') {
        query.type = type.toLowerCase();
    }

    const shops = await Shop.find(query).lean();

    const shopsWithSlots = await Promise.all(shops.map(async (shop) => {
      const nextSlot = await findEarliestSlotForShop(shop, minTime);
      return { ...shop, nextAvailableSlot: nextSlot };
    }));

    // Filter out shops with no slots if filtering by time
    const filteredShops = minTime
        ? shopsWithSlots.filter(s => s.nextAvailableSlot !== null)
        : shopsWithSlots;

    filteredShops.sort((a, b) => {
      if (!a.nextAvailableSlot) return 1;
      if (!b.nextAvailableSlot) return -1;
      return timeToMinutes(a.nextAvailableSlot) - timeToMinutes(b.nextAvailableSlot);
    });

    res.json(filteredShops);
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

  // For home screen, we just check TODAY's slots roughly
  // This might need the same overnight logic, but for simplicity/performance
  // we might keep it simple or apply the same fix if needed.
  // Let's stick to simple logic for now, or the same logic as getShopSlots but simplified.

  // Actually, to avoid inconsistency, we should probably check overnight too.
  // But let's leave it for now to focus on the main booking flow.
  // ...

  // Reverting to simple logic for finding ANY slot today
  // ... Restoring original logic ...
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

    // Calculate Previous Date
    const prevDateObj = subDays(new Date(date), 1);
    const prevDate = format(prevDateObj, 'yyyy-MM-dd');

    // Fetch Bookings for Date AND PrevDate
    const bookings = await Booking.find({
      barberId: { $in: barbersToCheck.map(b => b._id) },
      date: { $in: [date, prevDate] },
      status: { $ne: 'cancelled' } 
    });

    // Map bookings: barberId -> { today: [], yesterday: [] }
    const bookingsMap = {};
    barbersToCheck.forEach(b => bookingsMap[b._id] = { today: [], yesterday: [] });

    bookings.forEach(b => {
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime) + bufferTime;
      const range = { start: bStart, end: bEnd };

      if (bookingsMap[b.barberId]) {
          if (b.date === date) bookingsMap[b.barberId].today.push(range);
          if (b.date === prevDate) bookingsMap[b.barberId].yesterday.push(range);
      }
    });

    // Resolve schedules
    const barberSchedules = {}; // { today: S, yesterday: S }
    let minStart = 24 * 60; // default high
    let maxEnd = 0;         // default low

    barbersToCheck.forEach(b => {
      const today = getBarberScheduleForDate(b, date);
      const yesterday = getBarberScheduleForDate(b, prevDate);

      barberSchedules[b._id] = { today, yesterday };

      if (today.isOpen) {
        // Today's shift contribution
        if (today.start < minStart) minStart = today.start;
        if (today.end > maxEnd) maxEnd = today.end;
      }

      if (yesterday.isOpen && yesterday.end > 1440) {
        // Yesterday's overnight shift contribution (00:00 to end-1440)
        // Since it starts at 00:00 (relative to today), minStart becomes 0
        minStart = 0;
        const spillOver = yesterday.end - 1440;
        if (spillOver > maxEnd) maxEnd = spillOver;
      }
    });

    if (minStart >= maxEnd && maxEnd === 0) return res.json([]);

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

    // Loop through all potential minutes
    while (current + serviceDuration <= maxEnd) {
      let isSlotAvailable = false;

      for (const barber of barbersToCheck) {
        const { today, yesterday } = barberSchedules[barber._id];
        const bBookings = bookingsMap[barber._id];

        // 1. Check if it fits in Today's Schedule
        //    (Busy ranges: Today's bookings AND Yesterday's bookings shifted -1440)
        let fitsToday = false;
        if (today.isOpen) {
            // Construct busy ranges for Today's reference frame
            // Today's bookings: [start, end]
            // Yesterday's bookings: [start - 1440, end - 1440] (shift back to see if they overlap start of today?)
            // Wait, Yesterday's bookings happen on Yesterday.
            // If Yesterday Booking was 23:00-24:00 (1380-1440). In Today's frame it is -60 to 0.
            // If Yesterday Booking was 25:00 (01:00 Today). Stored as date=Today, start=01:00.
            // So bookings stored on 'date' cover Today.
            // Bookings stored on 'prevDate' cover Yesterday.
            // Do bookings on 'prevDate' ever spill into Today?
            // Only if they go past 24:00?
            // But if they go past 24:00, the system logic for CREATION likely blocked it or stored it as next day?
            // If I created a booking yesterday 23:30 duration 60 -> ends 00:30 today.
            // Is it stored as date=Yesterday? Yes.
            // So it overlaps 00:00-00:30 on Today.
            // So we DO need to check Yesterday's bookings shifted by -1440.

            const busyToday = [
                ...bBookings.today,
                ...bBookings.yesterday.map(r => ({ start: r.start - 1440, end: r.end - 1440 }))
            ];

            if (isBarberFree(today, current, serviceDuration + bufferTime, busyToday)) {
                fitsToday = true;
            }
        }

        // 2. Check if it fits in Yesterday's Schedule (Spillover)
        //    We check in Yesterday's reference frame.
        //    Time 'current' on Today corresponds to 'current + 1440' on Yesterday.
        let fitsYesterday = false;
        if (!fitsToday && yesterday.isOpen && yesterday.end > 1440) {
            const timeInYesterday = current + 1440;

            // Construct busy ranges for Yesterday's reference frame
            // Yesterday's bookings: [start, end]
            // Today's bookings: [start + 1440, end + 1440]

            const busyYesterday = [
                ...bBookings.yesterday,
                ...bBookings.today.map(r => ({ start: r.start + 1440, end: r.end + 1440 }))
            ];

            if (isBarberFree(yesterday, timeInYesterday, serviceDuration + bufferTime, busyYesterday)) {
                fitsYesterday = true;
            }
        }

        if (fitsToday || fitsYesterday) {
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
