const express = require('express');
const router = express.Router();
const multer = require('multer');
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');
const { protect } = require('../middleware/authMiddleware');

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
  updateShopCombo
} = require('../controllers/shopController'); 

const financeController = require('../controllers/financeController');

// 1. DigitalOcean Spaces Configuration from ENV
const s3 = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: "blr1", 
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET,
    }
});

// 2. Cloud Storage Engine
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.DO_SPACES_BUCKET,
        acl: "public-read",
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: function (req, file, cb) {
            cb(null, `shops/${Date.now()}-${file.originalname}`);
        }
    })
});

router.get('/config', getPublicConfig);
router.get('/', getAllShops);
router.get('/favorites', protect, getUserFavorites);
router.get('/:id', getShopDetails);
router.post('/', protect, upload.single('image'), createShop);
router.post('/barbers', protect, addBarber);
router.put('/barbers/:id', protect, updateBarber);
router.post('/slots', getShopSlots);
router.post('/:id/services', protect, addShopService);
router.delete('/:id/services/:serviceId', protect, deleteShopService);
router.put('/:id/services/:serviceId', protect, updateShopService);
router.post('/:id/combos', protect, addShopCombo);
router.delete('/:id/combos/:comboId', protect, deleteShopCombo);
router.put('/:id/combos/:comboId', protect, updateShopCombo);
router.put('/:id', protect, upload.single('image'), updateShop);
router.get('/:id/revenue', protect, getShopRevenue);

// NEW FINANCE ROUTES
router.get('/:shopId/finance/summary', protect, financeController.getShopFinanceSummary);
router.get('/:shopId/finance/settlements', protect, financeController.getShopSettlements);
router.get('/:shopId/finance/pending', protect, financeController.getMyShopPendingDetails);

module.exports = router;
