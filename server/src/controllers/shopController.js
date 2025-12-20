const Shop = require('../models/Shop');
const Barber = require('../models/Barber');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { getISTTime, timeToMinutes, minutesToTime, getBarberSchedule } = require('../utils/dateUtils');
const { parse } = require('date-fns');

// --- HELPER: Check strict availability ---
const isBarberFree = (barber, startMinutes, duration, busyRanges, daySchedule, bufferTime = 0) => {
  const serviceEnd = startMinutes + duration;
  const slotEndWithBuffer = serviceEnd + bufferTime;

  // 1. Shift Check (using daySchedule)
  if (daySchedule.isOff) return false;
  
  // Service must end by closing time.
  if (startMinutes < daySchedule.start || serviceEnd > daySchedule.end) return false;

  // 2. Break Check
  if (barber.breaks) {
    for (const br of barber.breaks) {
      const brStart = timeToMinutes(br.startTime);
      const brEnd = timeToMinutes(br.endTime);
      // Conflict if Overlap with service time
      // Check if [start, serviceEnd] overlaps [brStart, brEnd]
      if (startMinutes < brEnd && serviceEnd > brStart) {
        return false;
      }
    }
  }

  // 3. Busy Ranges (Bookings) Check
  // busyRanges already include buffer of previous bookings if processed correctly.
  // We need to check if OUR [start, slotEndWithBuffer] overlaps any busyRange.
  // Note: busyRanges should be [start, end+buffer].
  const hasConflict = busyRanges.some(range => {
    return startMinutes < range.end && slotEndWithBuffer > range.start;
  });

  return !hasConflict;
};

// --- 1. Create Shop (Fixed Role Update) ---
exports.createShop = async (req, res) => {
  try {
    const { name, address, lat, lng, bufferTime, minBookingNotice, maxBookingNotice, autoApproveBookings } = req.body;
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
      bufferTime: bufferTime || 0,
      minBookingNotice: minBookingNotice || 60,
      maxBookingNotice: maxBookingNotice || 30,
      autoApproveBookings: autoApproveBookings !== undefined ? autoApproveBookings : true
    };

    if (lat !== undefined && lng !== undefined) {
      shopData.coordinates = { lat: parseFloat(lat), lng: parseFloat(lng) };
    }

    // REMOVED DEFAULT SERVICES
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
    const { name, address, type, lat, lng, bufferTime, minBookingNotice, maxBookingNotice, autoApproveBookings } = req.body;

    const updates = { address, type };
    if (name) updates.name = name;
    if (bufferTime !== undefined) updates.bufferTime = bufferTime;
    if (minBookingNotice !== undefined) updates.minBookingNotice = minBookingNotice;
    if (maxBookingNotice !== undefined) updates.maxBookingNotice = maxBookingNotice;
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
      const nextSlot = await findEarliestSlotForShop(shop._id, minTime);
      return { ...shop, nextAvailableSlot: nextSlot };
    }));

    shopsWithSlots.sort((a, b) => {
      if (!a.nextAvailableSlot) return 1;
      if (!b.nextAvailableSlot) return -1;
      return timeToMinutes(a.nextAvailableSlot) - timeToMinutes(b.nextAvailableSlot);
    });

    res.json(shopsWithSlots);
  } catch (e) {
    res.status(500).json({ message: "Server Error" });
  }
};

// Helper for Home Screen Card Slot
const findEarliestSlotForShop = async (shopId, minTimeStr = "00:00") => {
  const { date, minutes: currentISTMinutes } = getISTTime();
  const serviceDuration = 30;

  const barbers = await Barber.find({ shopId, isAvailable: true });
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
      end: timeToMinutes(b.endTime)
    });
  });

  let minStart = 24 * 60;
  let maxEnd = 0;
  barbers.forEach(b => {
    const s = timeToMinutes(b.startHour);
    const e = timeToMinutes(b.endHour);
    if (s < minStart) minStart = s;
    if (e > maxEnd) maxEnd = e;
  });
  if (minStart >= maxEnd) { minStart = 9 * 60; maxEnd = 20 * 60; }

  const minFilter = timeToMinutes(minTimeStr);
  let current = Math.max(minStart, minFilter);

  // Filter out past times
  current = Math.max(current, currentISTMinutes);

  while (current + serviceDuration <= maxEnd) {
    for (const barber of barbers) {
      if (isBarberFree(barber, current, serviceDuration, bookingsMap[barber._id] || [])) {
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
    const updates = { startHour, endHour, breaks, isAvailable };
    if (weeklySchedule) updates.weeklySchedule = weeklySchedule;
    if (specialHours) updates.specialHours = specialHours;

    const barber = await Barber.findByIdAndUpdate(id, updates, { new: true });
    res.json(barber);
  } catch (e) {
    res.status(500).json({ message: "Update failed" });
  }
};

// --- 7. Get Slots ---
exports.getShopSlots = async (req, res) => {
  const { shopId, barberId, date, duration } = req.body; 

  try {
    const serviceDuration = duration ? parseInt(duration) : 30;

    // Fetch Shop Settings
    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    // Check Max Booking Notice
    const { date: istDate, minutes: istMinutes } = getISTTime();

    // Simple date comparison (string comparison works for YYYY-MM-DD if formats match)
    // Actually, better to parse date.
    // maxBookingNotice is in days.
    const requestDate = parse(date, 'yyyy-MM-dd', new Date());
    const currentDate = parse(istDate, 'yyyy-MM-dd', new Date());
    const diffTime = requestDate - currentDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > shop.maxBookingNotice) {
      return res.json([]); // Too far in future
    }
    if (date < istDate) return res.json([]); // Past date

    // Min Booking Notice (minutes)
    // If date is today, we add notice to current time.
    let minAllowedMinutes = 0;
    if (date === istDate) {
      minAllowedMinutes = istMinutes + shop.minBookingNotice;
    }

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
        end: timeToMinutes(b.endTime) + shop.bufferTime // Add shop buffer to busy range
      });
    });

    // Calculate effective minStart and maxEnd for the group (or single barber)
    // based on the SCHEDULE for that specific day.
    let groupMinStart = 24 * 60;
    let groupMaxEnd = 0;

    const barberSchedules = {};

    barbersToCheck.forEach(b => {
      const schedule = getBarberSchedule(b, date);
      barberSchedules[b._id] = schedule;

      if (!schedule.isOff) {
        if (schedule.start < groupMinStart) groupMinStart = schedule.start;
        if (schedule.end > groupMaxEnd) groupMaxEnd = schedule.end;
      }
    });

    if (groupMinStart >= groupMaxEnd) {
        // Everyone is off
        return res.json([]);
    }

    const slots = [];
    let current = groupMinStart;

    // Filter past times / notice period
    if (date === istDate) {
      current = Math.max(current, minAllowedMinutes);
    }

    while (current + serviceDuration <= groupMaxEnd) {
      let isSlotAvailable = false;
      for (const barber of barbersToCheck) {
        const busyRanges = bookingsMap[barber._id] || [];
        const schedule = barberSchedules[barber._id];

        if (isBarberFree(barber, current, serviceDuration, busyRanges, schedule, shop.bufferTime)) {
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

// --- 9. NEW: Delete Service ---
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

// --- 10. NEW: Update Service (Toggle Availability) ---
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

// --- 11. NEW: Get User Favorites ---
exports.getUserFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('favorites');
    res.json(user.favorites || []);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch favorites" });
  }
};
