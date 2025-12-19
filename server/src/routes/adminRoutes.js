const express = require('express');
const router = express.Router();
const { submitApplication, getApplications, processApplication } = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');

router.post('/apply', protect, submitApplication);

router.get('/applications', protect, getApplications);
router.post('/process', protect, processApplication);

module.exports = router;