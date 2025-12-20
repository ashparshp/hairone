// server/src/utils/scheduleUtils.js

// Helper: Convert "HH:mm" to minutes
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper: Convert minutes to "HH:mm"
const minutesToTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
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
  // 1. Check Special Hours
  if (barber.specialHours && barber.specialHours.length > 0) {
    const special = barber.specialHours.find(h => h.date === dateStr);
    if (special) {
      return {
        isOpen: special.isOpen,
        start: timeToMinutes(special.startHour),
        end: timeToMinutes(special.endHour),
        breaks: []
      };
    }
  }

  // 2. Check Weekly Schedule
  const dayName = getDayOfWeek(dateStr);
  if (barber.weeklySchedule && barber.weeklySchedule.length > 0) {
    const weekly = barber.weeklySchedule.find(w => w.day === dayName);
    if (weekly) {
      const weeklyBreaks = (weekly.breaks || []).map(b => ({
        start: timeToMinutes(b.startTime),
        end: timeToMinutes(b.endTime)
      }));
      return {
        isOpen: weekly.isOpen,
        start: timeToMinutes(weekly.startHour),
        end: timeToMinutes(weekly.endHour),
        breaks: weeklyBreaks
      };
    }
  }

  // 3. Default
  const defaultBreaks = (barber.breaks || []).map(b => ({
    start: timeToMinutes(b.startTime),
    end: timeToMinutes(b.endTime)
  }));

  return {
    isOpen: barber.isAvailable,
    start: timeToMinutes(barber.startHour),
    end: timeToMinutes(barber.endHour),
    breaks: defaultBreaks
  };
};

module.exports = {
  timeToMinutes,
  minutesToTime,
  getBarberScheduleForDate
};
