const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

const { protect } = require('../middleware/authMiddleware'); 

router.post('/', protect, reviewController.createReview);
router.get('/shop/:shopId', reviewController.getShopReviews);

module.exports = router;
