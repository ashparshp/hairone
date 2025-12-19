const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');

const { 
  createShop, 
  getAllShops, 
  getShopDetails, 
  addBarber, 
  updateBarber, 
  getShopSlots,
  addShopService
} = require('../controllers/shopController'); 

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, 'uploads/'); },
  filename: function (req, file, cb) { cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });

router.get('/', getAllShops);
router.get('/:id', getShopDetails);
router.post('/', protect, upload.single('image'), createShop);
router.post('/barbers', protect, addBarber);
router.put('/barbers/:id', protect, updateBarber);
router.post('/slots', getShopSlots);
router.post('/:id/services', protect, addShopService);

module.exports = router;