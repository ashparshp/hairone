// server/src/utils/dateUtils.js
const { parse, getDay } = require('date-fns');

/**
 * Returns the current date and time in IST (Indian Standard Time).
 * IST is UTC + 5:30.
 *
 * This function calculates the IST time by shifting the current UTC time by +5.5 hours.
 * It returns the date in YYYY-MM-DD format and the current time in total minutes from midnight.
 *
 * @returns {Object} { date: string, minutes: number }
 */
const getISTTime = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
  const istDate = new Date(now.getTime() + istOffset);

  return {
    date: istDate.toISOString().split('T')[0], // YYYY-MM-DD based on the shifted time
    minutes: istDate.getUTCHours() * 60 + istDate.getUTCMinutes() // Hours and minutes from the shifted time
  };
};

// --- HELPER: Convert "HH:mm" to minutes ---
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

// --- HELPER: Get Effective Schedule for Barber on Date ---
const getBarberSchedule = (barber, dateStr) => {
  // 1. Check Special Hours
  if (barber.specialHours) {
    const special = barber.specialHours.find(h => h.date === dateStr);
    if (special) {
      if (special.isClosed) return { isOff: true };
      return {
        start: timeToMinutes(special.start),
        end: timeToMinutes(special.end),
        isOff: false
      };
    }
  }

  // 2. Check Weekly Schedule
  if (barber.weeklySchedule && barber.weeklySchedule.length > 0) {
    const dateObj = parse(dateStr, 'yyyy-MM-dd', new Date());
    const dayIndex = getDay(dateObj); // 0 = Sunday

    const weekly = barber.weeklySchedule.find(s => s.day === dayIndex);
    if (weekly) {
      if (weekly.isOff) return { isOff: true };
      return {
        start: timeToMinutes(weekly.start),
        end: timeToMinutes(weekly.end),
        isOff: false
      };
    }
  }

  // 3. Default
  return {
    start: timeToMinutes(barber.startHour),
    end: timeToMinutes(barber.endHour),
    isOff: false
  };
};

module.exports = { getISTTime, timeToMinutes, minutesToTime, getBarberSchedule };
