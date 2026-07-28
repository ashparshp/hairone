const SystemConfig = require('../models/SystemConfig');

const initConfig = async () => {
  try {
    const config = await SystemConfig.findOne({ key: 'global' });
    if (!config) {
      await SystemConfig.create({
        key: 'global',
        adminCommissionRate: 10,
        userDiscountRate: 0,
        isPaymentTestMode: false
      });
      console.log('⚙️  System Config Initialized');
    }
  } catch (error) {
    console.error('Failed to init config:', error);
  }
};

module.exports = initConfig;
