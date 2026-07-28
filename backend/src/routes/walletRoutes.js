const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getMyWallet } = require("../controllers/walletController");

router.get("/", protect, getMyWallet);

module.exports = router;
