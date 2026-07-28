// server/src/utils/dateUtils.js

/**
 * =================================================================================================
 * DATE UTILITIES
 * =================================================================================================
 *
 * Purpose:
 * Centralizes date conversions, specifically handling Indian Standard Time (IST).
 *
 * Why:
 * Servers often run in UTC. If a user in India asks "Is it 9 PM?", a UTC server might think it's 3:30 PM.
 * This file forces the server to calculate "Current Time" relative to the business's timezone (IST).
 * =================================================================================================
 */

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
    date: istDate.toISOString().split("T")[0], // YYYY-MM-DD based on the shifted time
    minutes: istDate.getUTCHours() * 60 + istDate.getUTCMinutes(), // Hours and minutes from the shifted time
  };
};

/**
 * Convert an IST local date/time pair (YYYY-MM-DD + HH:mm) into a UTC Date object.
 */
const parseISTDateTimeToUTC = (dateStr, timeStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);

  const utcMs =
    Date.UTC(year, month - 1, day, hours, minutes) - 5.5 * 60 * 60 * 1000;
  return new Date(utcMs);
};

/**
 * Build a safe booking start/end UTC pair from IST values.
 * If end appears earlier than start, it is treated as next-day overnight.
 */
const buildBookingWindowUTC = (dateStr, startTime, endTime) => {
  const startAt = parseISTDateTimeToUTC(dateStr, startTime);
  let endAt = parseISTDateTimeToUTC(dateStr, endTime);

  if (endAt <= startAt) {
    endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
  }

  return { startAt, endAt };
};

/**
 * Calendar-day difference between two YYYY-MM-DD strings (timezone-safe).
 */
const daysBetweenDateStrings = (laterDateStr, earlierDateStr) => {
  const toUtcMs = (dateStr) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.floor(
    (toUtcMs(laterDateStr) - toUtcMs(earlierDateStr)) / (24 * 60 * 60 * 1000),
  );
};

const getMonthBoundsFromDateStr = (dateStr) => {
  const [year, month] = dateStr.split("-").map(Number);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { monthStart, monthEnd };
};

module.exports = {
  getISTTime,
  parseISTDateTimeToUTC,
  buildBookingWindowUTC,
  daysBetweenDateStrings,
  getMonthBoundsFromDateStr,
};
