const express = require('express');
const router = express.Router();
const { protect, blockSuspendedOwner } = require('../middleware/authMiddleware');
const { upload, compressAndUpload } = require('../middleware/uploadMiddleware');

const { 
  createShop, 
  getAllShops, 
  getShopDetails, 
  addBarber, 
  updateBarber, 
  getShopSlots,
  addShopService,
  updateShop,
  getUserFavorites,
  deleteShopService,
  updateShopService,
  getShopRevenue,
  getPublicConfig,
  addShopCombo,
  deleteShopCombo,
  updateShopCombo,
  addGalleryImage,
  deleteGalleryImage
} = require('../controllers/shopController'); 

const financeController = require('../controllers/financeController');

router.get('/config', getPublicConfig);
router.get('/', getAllShops);
router.get('/favorites', protect, getUserFavorites);
router.get('/:id', getShopDetails);
router.post('/', protect, blockSuspendedOwner, upload.single('image'), compressAndUpload, createShop);
router.post('/barbers', protect, blockSuspendedOwner, addBarber);
router.put('/barbers/:id', protect, blockSuspendedOwner, updateBarber);
router.post('/slots', getShopSlots);
router.post('/:id/services', protect, blockSuspendedOwner, addShopService);
router.delete('/:id/services/:serviceId', protect, blockSuspendedOwner, deleteShopService);
router.put('/:id/services/:serviceId', protect, blockSuspendedOwner, updateShopService);
router.post('/:id/combos', protect, blockSuspendedOwner, addShopCombo);
router.delete('/:id/combos/:comboId', protect, blockSuspendedOwner, deleteShopCombo);
router.put('/:id/combos/:comboId', protect, blockSuspendedOwner, updateShopCombo);
router.put('/:id', protect, blockSuspendedOwner, upload.single('image'), compressAndUpload, updateShop);
router.get('/:id/revenue', protect, blockSuspendedOwner, getShopRevenue);

// GALLERY ROUTES
router.post('/:id/gallery', protect, blockSuspendedOwner, upload.single('image'), compressAndUpload, addGalleryImage);
router.delete('/:id/gallery', protect, blockSuspendedOwner, deleteGalleryImage);

// NEW FINANCE ROUTES
router.get('/:shopId/finance/summary', protect, blockSuspendedOwner, financeController.getShopFinanceSummary);
router.get('/:shopId/finance/settlements', protect, blockSuspendedOwner, financeController.getShopSettlements);
router.get('/:shopId/finance/pending', protect, blockSuspendedOwner, financeController.getMyShopPendingDetails);

module.exports = router;
