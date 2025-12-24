const Shop = require('../models/Shop');
const Barber = require('../models/Barber');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { getISTTime } = require('../utils/dateUtils');
const { timeToMinutes, minutesToTime, getBarberScheduleForDate } = require('../utils/scheduleUtils');
const { subDays, format, startOfWeek, startOfMonth, startOfYear, parseISO, endOfDay } = require('date-fns');

/**
 * =================================================================================================
 * SHOP CONTROLLER
 * =================================================================================================
 *
 * Purpose:
 * This controller handles everything related to a Shop's lifecycle and data.
 *
 * Key Responsibilities:
 * 1. Creation & Updates: Creating shops (with image uploads) and managing profile data.
 * 2. Geo-Location: Finding "Shops Nearby" using Haversine distance calculations.
 * 3. Slot Generation: The complex logic of finding available 15-minute slots for booking.
 * 4. Service Menu: Adding/Editing Services and Combos.
 * =================================================================================================
 */

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
// Handles the Multipart form submission for creating a shop.
// It also instantly promotes the user to 'owner' role.
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
      bufferTime: bufferTime !== undefined ? parseInt(bufferTime) : 0,
      minBookingNotice: minBookingNotice !== undefined ? parseInt(minBookingNotice) : 60,
      maxBookingNotice: maxBookingNotice !== undefined ? parseInt(maxBookingNotice) : 30,
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

// --- 3. Get All Shops (Geospatial Search) ---
// Returns a list of shops, potentially filtered by:
// - Distance (Haversine formula using `lat`, `lng`, `radius`)
// - Availability (`minTime` logic)
exports.getAllShops = async (req, res) => {
  try {
    const { minTime, type, lat, lng, radius } = req.query;

    const query = { isDisabled: { $ne: true } };
    if (type && type !== 'all') {
        query.type = type.toLowerCase();
    }

    let shops = await Shop.find(query).lean();

    // 1. Distance Calculation & Filtering
    if (lat && lng) {
        const userLat = parseFloat(lat);
        const userLng = parseFloat(lng);
        const searchRadius = radius ? parseFloat(radius) : null;

        shops = shops.map(shop => {
            if (shop.coordinates && shop.coordinates.lat !== undefined && shop.coordinates.lng !== undefined) {
                const dist = calculateDistance(userLat, userLng, shop.coordinates.lat, shop.coordinates.lng);
                return { ...shop, distance: dist };
            }
            return { ...shop, distance: null };
        });

        if (searchRadius) {
            shops = shops.filter(s => s.distance !== null && s.distance <= searchRadius);
        }

        // Sort by distance ascending
        shops.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    }

    const shopsWithSlots = await Promise.all(shops.map(async (shop) => {
      const nextSlot = await findEarliestSlotForShop(shop, minTime);
      return { ...shop, nextAvailableSlot: nextSlot };
    }));

    // Filter out shops with no slots if filtering by time
    const filteredShops = minTime
        ? shopsWithSlots.filter(s => s.nextAvailableSlot !== null)
        : shopsWithSlots;

    // If NOT sorting by distance (i.e. no location provided), sort by slot availability
    if (!lat || !lng) {
        filteredShops.sort((a, b) => {
            if (!a.nextAvailableSlot) return 1;
            if (!b.nextAvailableSlot) return -1;
            return timeToMinutes(a.nextAvailableSlot) - timeToMinutes(b.nextAvailableSlot);
        });
    }

    res.json(filteredShops);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server Error" });
  }
};

// Haversine Formula (km)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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
// Returns available time slots for a given Date and Duration.
// Handles complex checks: Buffer Time, Overnight Spillover (Yesterday's late shift), etc.
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

    // Helper to check availability at a specific time
    const checkAvailabilityAt = (time) => {
      for (const barber of barbersToCheck) {
        const { today, yesterday } = barberSchedules[barber._id];
        const bBookings = bookingsMap[barber._id];

        // 1. Check if it fits in Today's Schedule
        let fitsToday = false;
        if (today.isOpen) {
          const busyToday = [
            ...bBookings.today,
            ...bBookings.yesterday.map(r => ({ start: r.start - 1440, end: r.end - 1440 }))
          ];
          if (isBarberFree(today, time, serviceDuration + bufferTime, busyToday)) {
            fitsToday = true;
          }
        }

        // 2. Check if it fits in Yesterday's Schedule (Spillover)
        let fitsYesterday = false;
        if (!fitsToday && yesterday.isOpen && yesterday.end > 1440) {
          const timeInYesterday = time + 1440;
          const busyYesterday = [
            ...bBookings.yesterday,
            ...bBookings.today.map(r => ({ start: r.start + 1440, end: r.end + 1440 }))
          ];
          if (isBarberFree(yesterday, timeInYesterday, serviceDuration + bufferTime, busyYesterday)) {
            fitsYesterday = true;
          }
        }

        if (fitsToday || fitsYesterday) return true;
      }
      return false;
    };

    // Loop through all potential minutes
    while (current + serviceDuration <= maxEnd) {
      if (checkAvailabilityAt(current)) {
        slots.push(minutesToTime(current));
      } else {
        // Recovery Slots: If exact grid slot is blocked, check next 14 mins for exact availability
        // This ensures if buffer is 2 mins, we show a slot at Grid+2 (e.g. 10:32)
        for (let offset = 1; offset < 15; offset++) {
           const recoveryTime = current + offset;
           if (recoveryTime + serviceDuration > maxEnd) break;

           if (checkAvailabilityAt(recoveryTime)) {
             slots.push(minutesToTime(recoveryTime));
             break; // Found the earliest recovery slot, stop looking in this block
           }
        }
      }
      
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
  const { name, price, duration, isAvailable } = req.body;

  try {
    // Construct updates object dynamically
    const updateQuery = {};
    if (name) updateQuery["services.$.name"] = name;
    if (price !== undefined) updateQuery["services.$.price"] = parseInt(price);
    if (duration !== undefined) updateQuery["services.$.duration"] = parseInt(duration);
    if (isAvailable !== undefined) updateQuery["services.$.isAvailable"] = isAvailable;

    const shop = await Shop.findOneAndUpdate(
      { _id: id, "services._id": serviceId },
      { $set: updateQuery },
      { new: true }
    );

    if (!shop) return res.status(404).json({ message: "Shop or Service not found" });
    res.json(shop);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update service" });
  }
};

// --- 10.1 Add Combo ---
exports.addShopCombo = async (req, res) => {
  const { id } = req.params;
  const { name, price, originalPrice, duration, items } = req.body;

  try {
    const shop = await Shop.findByIdAndUpdate(
      id,
      {
        $push: {
          combos: {
            name,
            price: parseInt(price),
            originalPrice: parseInt(originalPrice),
            duration: parseInt(duration),
            items: items || [], // array of service IDs
            isAvailable: true
          }
        }
      },
      { new: true }
    );
    res.json(shop);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to add combo" });
  }
};

// --- 10.2 Delete Combo ---
exports.deleteShopCombo = async (req, res) => {
  const { id, comboId } = req.params;
  try {
    const shop = await Shop.findByIdAndUpdate(
      id,
      { $pull: { combos: { _id: comboId } } },
      { new: true }
    );
    res.json(shop);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to delete combo" });
  }
};

// --- 10.3 Update Combo ---
exports.updateShopCombo = async (req, res) => {
  const { id, comboId } = req.params;
  const { name, price, originalPrice, duration, items, isAvailable } = req.body;

  try {
    // Construct updates object dynamically
    const updateQuery = {};
    if (name) updateQuery["combos.$.name"] = name;
    if (price !== undefined) updateQuery["combos.$.price"] = parseInt(price);
    if (originalPrice !== undefined) updateQuery["combos.$.originalPrice"] = parseInt(originalPrice);
    if (duration !== undefined) updateQuery["combos.$.duration"] = parseInt(duration);
    if (items) updateQuery["combos.$.items"] = items;
    if (isAvailable !== undefined) updateQuery["combos.$.isAvailable"] = isAvailable;

    const shop = await Shop.findOneAndUpdate(
      { _id: id, "combos._id": comboId },
      { $set: updateQuery },
      { new: true }
    );
    res.json(shop);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update combo" });
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

// --- 12. Get Shop Revenue Stats ---
exports.getShopRevenue = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const shop = await Shop.findById(id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    // Check permission: Owner or Admin
    if (req.user.role !== 'admin' && req.user.myShopId !== id) {
       // Also check if myShopId is an object or string, safe comparison:
       if (String(req.user.myShopId) !== String(id)) {
          // Additional check: req.user.myShopId might be undefined if not owner role
          // Let's assume protect middleware populates req.user correctly
          // But strict check:
          return res.status(403).json({ message: "Not authorized to view this shop's revenue" });
       }
    }

    // Use current time in server's timezone for "Weekly/Monthly/Yearly" buckets
    // Ideally this should use IST if the business is in India, but keeping it simple with server time or consistent UTC.
    // The previous code uses `getISTTime` for slots, but here `date-fns` uses local system time by default.
    // Let's stick to simple `new Date()` (UTC/Server Local) for date boundaries,
    // comparing against the Booking `date` string "YYYY-MM-DD".

    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    // Calculate start dates for buckets
    const startWeek = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'); // Monday start
    const startMonth = format(startOfMonth(now), 'yyyy-MM-dd');
    const startYear = format(startOfYear(now), 'yyyy-MM-dd');

    // Default Custom Range: Shop Creation -> Today
    // If shop.createdAt is undefined (old shops), use shop._id.getTimestamp() or a very old date.
    const shopCreatedDate = shop.createdAt ? new Date(shop.createdAt) : shop._id.getTimestamp();
    const defaultStart = format(shopCreatedDate, 'yyyy-MM-dd');

    const customStart = startDate || defaultStart;
    const customEnd = endDate || todayStr;

    // Aggregation
    // We match by ShopId and Status='completed'
    // Then we bucket the revenue.
    const stats = await Booking.aggregate([
      {
        $match: {
          shopId: shop._id,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          // REVENUE (Use barberNetRevenue if available, else fallback to totalPrice for legacy)
          weekly: {
            $sum: {
              $cond: [{ $gte: ["$date", startWeek] }, { $ifNull: ["$barberNetRevenue", "$totalPrice"] }, 0]
            }
          },
          monthly: {
            $sum: {
              $cond: [{ $gte: ["$date", startMonth] }, { $ifNull: ["$barberNetRevenue", "$totalPrice"] }, 0]
            }
          },
          yearly: {
            $sum: {
              $cond: [{ $gte: ["$date", startYear] }, { $ifNull: ["$barberNetRevenue", "$totalPrice"] }, 0]
            }
          },
          custom: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$date", customStart] },
                    { $lte: ["$date", customEnd] }
                  ]
                },
                { $ifNull: ["$barberNetRevenue", "$totalPrice"] },
                0
              ]
            }
          },

          // Net Settlement Balance for Pending Bookings
          // Only calculate for PENDING settlement status
          pendingSettlement: {
              $sum: {
                  $cond: [
                      { $eq: ["$settlementStatus", "PENDING"] },
                      {
                          $subtract: [
                              // Debit: What Barber owes Admin (Admin Net Revenue from Cash Sales)
                              {
                                  $cond: [
                                      { $eq: ["$amountCollectedBy", "BARBER"] },
                                      { $ifNull: ["$adminNetRevenue", 0] }, // Fallback 0 for old data
                                      0
                                  ]
                              },
                              // Credit: What Admin owes Barber (Barber Net Revenue from Online Sales)
                              {
                                  $cond: [
                                      { $eq: ["$amountCollectedBy", "ADMIN"] },
                                      { $ifNull: ["$barberNetRevenue", 0] },
                                      0
                                  ]
                              }
                          ]
                      },
                      0
                  ]
              }
          }
        }
      }
    ]);

    const result = stats[0] || { weekly: 0, monthly: 0, yearly: 0, custom: 0, pendingSettlement: 0 };

    res.json({
      weekly: result.weekly,
      monthly: result.monthly,
      yearly: result.yearly,
      custom: result.custom,
      pendingSettlement: result.pendingSettlement,
      customRange: { start: customStart, end: customEnd }
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to calculate revenue" });
  }
};
// Add to exports at the bottom
exports.getPublicConfig = async (req, res) => {
    try {
        const SystemConfig = require('../models/SystemConfig');
        const config = await SystemConfig.findOne({ key: 'global' });
        if (config) {
            res.json({
                userDiscountRate: config.userDiscountRate,
                isPaymentTestMode: config.isPaymentTestMode
            });
        } else {
            res.json({ userDiscountRate: 0, isPaymentTestMode: false });
        }
    } catch (e) {
        res.status(500).json({ message: "Config fetch failed" });
    }
};

// --- 13. Add Gallery Image (Support Multi-Upload) ---
exports.addGalleryImage = async (req, res) => {
  try {
    const { id } = req.params;

    // Authorization Check
    if (req.user.role !== 'admin') {
        const myShopId = req.user.myShopId && req.user.myShopId._id ? req.user.myShopId._id.toString() : req.user.myShopId?.toString();
        if (myShopId !== id) {
            return res.status(403).json({ message: "Not authorized to manage this shop's gallery" });
        }
    }

    let imageUrls = [];

    // Handle single file (legacy/fallback)
    if (req.file && req.file.location) {
        imageUrls.push(req.file.location);
    }

    // Handle multiple files
    if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
            if (file.location) {
                imageUrls.push(file.location);
            }
        });
    }

    if (imageUrls.length === 0) return res.status(400).json({ message: "No images uploaded" });

    const shop = await Shop.findByIdAndUpdate(
      id,
      { $push: { gallery: { $each: imageUrls } } },
      { new: true }
    );

    if (!shop) return res.status(404).json({ message: "Shop not found" });

    res.json(shop);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to upload gallery images" });
  }
};

// --- 14. Delete Gallery Image ---
exports.deleteGalleryImage = async (req, res) => {
  try {
    const { id } = req.params;

    // Authorization Check
    if (req.user.role !== 'admin') {
        const myShopId = req.user.myShopId && req.user.myShopId._id ? req.user.myShopId._id.toString() : req.user.myShopId?.toString();
        if (myShopId !== id) {
            return res.status(403).json({ message: "Not authorized to manage this shop's gallery" });
        }
    }

    const { imageUrl } = req.body;

    if (!imageUrl) return res.status(400).json({ message: "Image URL is required" });

    const shop = await Shop.findByIdAndUpdate(
      id,
      { $pull: { gallery: imageUrl } },
      { new: true }
    );

    if (!shop) return res.status(404).json({ message: "Shop not found" });

    res.json(shop);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to delete gallery image" });
  }
};
