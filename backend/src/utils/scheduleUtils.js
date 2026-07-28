// server/src/utils/scheduleUtils.js

/**
 * =================================================================================================
 * SCHEDULE UTILITIES
 * =================================================================================================
 *
 * Purpose:
 * These helper functions form the backbone of the "Availability Engine".
 * They handle time conversion and, most importantly, determining "Is the Barber open today?".
 *
 * Key Concepts:
 * - Time is stored as "Minutes from Midnight" (0 - 1440) for easy math.
 * - Hierarchy: Special Hours (Holidays) > Weekly Schedule (Recurring) > Default Hours.
 * - Overnight Support: If a shift ends *after* it starts (numerically less, e.g., 2 AM < 10 PM),
 *   we add 1440 minutes to the end time to treat it as a continuous timeline.
 * =================================================================================================
 */

const SLOT_GRANULARITY_MINUTES = 15;

// Helper: Convert "HH:mm" to minutes
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper: Convert minutes to "HH:mm"
const minutesToTime = (totalMinutes) => {
  // Normalize to 0-23h range for display
  const normalized = totalMinutes % 1440;
  const hours = Math.floor(normalized / 60).toString().padStart(2, '0');
  const minutes = (normalized % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Helper: Get day of week safely from YYYY-MM-DD
const getDayOfWeek = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Create date using UTC to avoid timezone shifts
  const date = new Date(Date.UTC(year, month - 1, day));
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getUTCDay()];
};

/**
 * Resolves the effective schedule for a barber on a specific date.
 * Hierarchy: Special Hours > Weekly Schedule > Default
 */
const getBarberScheduleForDate = (barber, dateStr) => {
  let schedule = {
    isOpen: barber.isAvailable,
    start: 0,
    end: 0,
    breaks: []
  };

  // 1. Check Special Hours (Date Specific)
  // Used for Holidays or One-off changes.
  if (barber.specialHours && barber.specialHours.length > 0) {
    const special = barber.specialHours.find(h => h.date === dateStr);
    if (special) {
      schedule = {
        isOpen: special.isOpen,
        start: timeToMinutes(special.startHour),
        end: timeToMinutes(special.endHour),
        breaks: []
      };
      // Handle overnight: If End < Start (e.g. 02:00 < 22:00), it implies next day.
      if (schedule.end < schedule.start) schedule.end += 1440;
      return schedule;
    }
  }

  // 2. Check Weekly Schedule (Day Specific)
  // Used for regular shifts (e.g., "Mondays are closed", "Fridays open late").
  const dayName = getDayOfWeek(dateStr);
  if (barber.weeklySchedule && barber.weeklySchedule.length > 0) {
    const weekly = barber.weeklySchedule.find(w => w.day === dayName);
    if (weekly) {
      const weeklyBreaks = (weekly.breaks || []).map(b => ({
        start: timeToMinutes(b.startTime),
        end: timeToMinutes(b.endTime)
      }));
      schedule = {
        isOpen: weekly.isOpen,
        start: timeToMinutes(weekly.startHour),
        end: timeToMinutes(weekly.endHour),
        breaks: weeklyBreaks
      };
      // Handle overnight
      if (schedule.end < schedule.start) schedule.end += 1440;
      return schedule;
    }
  }

  // 3. Default (Fallback)
  // If no special rules apply, use the Barber's global default hours.
  const defaultBreaks = (barber.breaks || []).map(b => ({
    start: timeToMinutes(b.startTime),
    end: timeToMinutes(b.endTime)
  }));

  schedule = {
    isOpen: barber.isAvailable, // Global toggle
    start: timeToMinutes(barber.startHour),
    end: timeToMinutes(barber.endHour),
    breaks: defaultBreaks
  };

  // Handle overnight
  if (schedule.end < schedule.start) schedule.end += 1440;

  return schedule;
};

const getNextDateStr = (dateStr) => {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addSlotRange = (keys, dateStr, startMinutes, endMinutes, granularity) => {
  if (endMinutes <= startMinutes) return;

  const firstBucket = Math.floor(startMinutes / granularity) * granularity;
  const lastBucket =
    Math.floor((endMinutes - 1) / granularity) * granularity;

  for (let m = firstBucket; m <= lastBucket; m += granularity) {
    keys.add(`${dateStr}|${m}`);
  }
};

/**
 * Discrete slot keys for atomic overlap prevention (15-minute buckets).
 * Keys encode calendar date + minute-of-day, including spillover past midnight.
 */
const buildOccupiedSlotKeys = (
  date,
  startTime,
  endTime,
  bufferTime = 0,
  granularity = SLOT_GRANULARITY_MINUTES,
) => {
  const keys = new Set();
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime) + bufferTime;

  if (end > start) {
    addSlotRange(keys, date, start, end, granularity);
  } else {
    addSlotRange(keys, date, start, 1440, granularity);
    addSlotRange(keys, getNextDateStr(date), 0, end, granularity);
  }

  return [...keys];
};

module.exports = {
  SLOT_GRANULARITY_MINUTES,
  timeToMinutes,
  minutesToTime,
  getBarberScheduleForDate,
  buildOccupiedSlotKeys,
};
