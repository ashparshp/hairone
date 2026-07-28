const { getWalletHistory, WalletServiceError } = require("../services/walletService");

exports.getMyWallet = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const data = await getWalletHistory(req.user._id, { page, limit });
    res.json(data);
  } catch (error) {
    if (error instanceof WalletServiceError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: "Failed to fetch wallet" });
  }
};
