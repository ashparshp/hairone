const cron = require("node-cron");
const { expireStalePaymentOrders } = require("../services/paymentService");
const { logger } = require("../utils/logger");

/**
 * Expire abandoned PaymentOrders past expiresAt.
 * Runs every 5 minutes so fingerprint slots free quickly after the 15m TTL.
 */
const initializePaymentOrderExpiryJob = () => {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const result = await expireStalePaymentOrders();
      if (result.total > 0) {
        logger.info("payment_order_expiry_sweeper", result);
      } else {
        logger.debug("payment_order_expiry_sweeper", result);
      }
    } catch (error) {
      logger.error("payment_order_expiry_sweeper_failed", { err: error });
    }
  });
};

module.exports = { initializePaymentOrderExpiryJob };
