const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
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
router.post('/', protect, upload.single('image'), compressAndUpload, createShop);
router.post('/barbers', protect, addBarber);
router.put('/barbers/:id', protect, updateBarber);
router.post('/slots', getShopSlots);
router.post('/:id/services', protect, addShopService);
router.delete('/:id/services/:serviceId', protect, deleteShopService);
router.put('/:id/services/:serviceId', protect, updateShopService);
router.post('/:id/combos', protect, addShopCombo);
router.delete('/:id/combos/:comboId', protect, deleteShopCombo);
router.put('/:id/combos/:comboId', protect, updateShopCombo);
router.put('/:id', protect, upload.single('image'), compressAndUpload, updateShop);
router.get('/:id/revenue', protect, getShopRevenue);

// GALLERY ROUTES
router.post('/:id/gallery', protect, upload.array('image', 10), compressAndUpload, addGalleryImage);
router.delete('/:id/gallery', protect, deleteGalleryImage);

// NEW FINANCE ROUTES
router.get('/:shopId/finance/summary', protect, financeController.getShopFinanceSummary);
router.get('/:shopId/finance/settlements', protect, financeController.getShopSettlements);
router.get('/:shopId/finance/pending', protect, financeController.getMyShopPendingDetails);

module.exports = router;
