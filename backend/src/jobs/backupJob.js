const cron = require("node-cron");
const { performBackup } = require("../services/backupService");
const { logger } = require("../utils/logger");

const initializeBackupJob = () => {
  // Daily at 02:00 server time
  cron.schedule("0 2 * * *", async () => {
    logger.info("backup_job_triggered");
    await performBackup();
  });
};

module.exports = { initializeBackupJob };
