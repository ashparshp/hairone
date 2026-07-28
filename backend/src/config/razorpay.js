const Razorpay = require("razorpay");

const getRazorpayKeyId = () => process.env.RAZORPAY_KEY_ID || "";

const getRazorpayKeySecret = () => process.env.RAZORPAY_KEY_SECRET || "";

const isRazorpayConfigured = () =>
  Boolean(getRazorpayKeyId() && getRazorpayKeySecret());

let razorpayClient = null;

const getRazorpayClient = () => {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured");
  }
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: getRazorpayKeyId(),
      key_secret: getRazorpayKeySecret(),
    });
  }
  return razorpayClient;
};

module.exports = {
  getRazorpayKeyId,
  getRazorpayKeySecret,
  isRazorpayConfigured,
  getRazorpayClient,
};
