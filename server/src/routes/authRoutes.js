const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, updateProfile, toggleFavorite, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

// Configure S3 (Reusing similar config as shopRoutes, ideally should be a utility)
const s3 = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: "blr1",
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET,
    }
});

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.DO_SPACES_BUCKET,
        acl: "public-read",
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: function (req, file, cb) {
            cb(null, `avatars/${Date.now()}-${file.originalname}`);
        }
    })
});

router.post('/otp', sendOTP);
router.post('/verify', verifyOTP);
router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.post('/favorites', protect, toggleFavorite);
router.get('/me', protect, getMe);

module.exports = router;