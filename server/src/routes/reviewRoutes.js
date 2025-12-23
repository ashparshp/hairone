const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.post('/', authenticateUser, reviewController.createReview);
router.get('/shop/:shopId', reviewController.getShopReviews);

module.exports = router;
