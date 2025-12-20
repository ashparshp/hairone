// server/src/utils/dateUtils.js

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

module.exports = { getISTTime };
