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
  updateShopService
} = require('../controllers/shopController'); 

// 1. DigitalOcean Spaces Configuration from ENV
const s3 = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: "us-east-1", 
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
router.put('/:id', protect, updateShop);

module.exports = router;