const cron = require('node-cron');
const { performBackup } = require('../services/backupService');

const initializeBackupJob = () => {
  // Schedule the backup to run at 2:00 AM every day
  // Cron syntax: 0 2 * * * (minute hour day-of-month month day-of-week)
  cron.schedule('0 2 * * *', async () => {
    console.log('Running scheduled daily database backup...');
    await performBackup();
  });

  console.log('📅 Database backup job scheduled for 02:00 AM daily.');
};

module.exports = { initializeBackupJob };
