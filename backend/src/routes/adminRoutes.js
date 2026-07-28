const express = require("express");
const router = express.Router();
const {
  submitApplication,
  getMyApplicationDraft,
  saveMyApplicationDraft,
  getApplications,
  processApplication,
  getAllShops,
  getSystemStats,
  suspendShop,
  reactivateShop,
  reapply,
  getShopBookings,
  getSystemConfig,
  updateSystemConfig,
} = require("../controllers/adminController");
const financeController = require("../controllers/financeController");
const { protect, admin } = require("../middleware/authMiddleware");

router.post("/apply", protect, submitApplication);
router.post("/reapply", protect, reapply);
router.get("/application-draft", protect, getMyApplicationDraft);
router.put("/application-draft", protect, saveMyApplicationDraft);

router.get("/applications", protect, admin, getApplications);
router.post("/process", protect, admin, processApplication);

// Analytics & Shops
router.get("/shops", protect, admin, getAllShops);
router.post("/shops/:shopId/suspend", protect, admin, suspendShop);
router.post("/shops/:shopId/activate", protect, admin, reactivateShop);
router.get("/shops/:shopId/bookings", protect, admin, getShopBookings);
router.get("/stats", protect, admin, getSystemStats);

// Config & Finance
router.get("/config", protect, admin, getSystemConfig);
router.put("/config", protect, admin, updateSystemConfig);

// Finance (New)
router.get("/finance", protect, admin, financeController.getPendingSettlements);
router.get(
  "/finance/pending/:shopId",
  protect,
  admin,
  financeController.getShopPendingDetails,
);
router.post(
  "/finance/settle",
  protect,
  admin,
  financeController.createSettlement,
);
router.get(
  "/finance/settlements",
  protect,
  admin,
  financeController.getSettlementHistory,
);
router.get(
  "/finance/settlements/:id",
  protect,
  admin,
  financeController.getSettlementDetails,
);

module.exports = router;
