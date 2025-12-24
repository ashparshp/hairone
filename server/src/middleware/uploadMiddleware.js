const multer = require('multer');
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

// 1. DigitalOcean Spaces Configuration from ENV (re-using existing env vars)
const s3 = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: "blr1", // Using region from existing code
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET,
    }
});

// 2. Multer Configuration (Memory Storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // Limit to 10MB input
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload an image.'), false);
        }
    }
});

// Helper function to process and upload a single file
const processFile = async (file, folder = 'shops') => {
    // Sanitize filename and enforce .jpeg extension
    // Strip original extension and replace with .jpeg
    const nameWithoutExt = path.parse(file.originalname).name;
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9.-]/g, '-');
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const filename = `${folder}/${timestamp}-${random}-${sanitizedName}.jpeg`;

    // Compress image
    const compressedBuffer = await sharp(file.buffer)
        .resize(1200, 1200, { // Max dimensions, maintain aspect ratio
            fit: sharp.fit.inside,
            withoutEnlargement: true
        })
        .jpeg({ quality: 80, mozjpeg: true }) // Convert to JPEG, 80% quality
        .toBuffer();

    // Upload to S3
    const command = new PutObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: filename,
        Body: compressedBuffer,
        ACL: 'public-read',
        ContentType: 'image/jpeg'
    });

    await s3.send(command);

    // Construct Public URL
    const endpointUrl = new URL(process.env.DO_SPACES_ENDPOINT);
    const fileUrl = `https://${process.env.DO_SPACES_BUCKET}.${endpointUrl.hostname}/${filename}`;

    // Return the properties expected by the controller
    return {
        ...file,
        location: fileUrl,
        key: filename,
        bucket: process.env.DO_SPACES_BUCKET
    };
};

// 3. Compression and Upload Middleware
const compressAndUpload = async (req, res, next) => {
    try {
        const folder = req.uploadFolder || 'shops';

        if (req.file) {
            // Single file case
            const processed = await processFile(req.file, folder);
            req.file = processed;
        } else if (req.files && req.files.length > 0) {
            // Multiple files case
            // Use Promise.all to process in parallel
            const processedFiles = await Promise.all(req.files.map(file => processFile(file, folder)));
            req.files = processedFiles;
        }
        next();
    } catch (error) {
        console.error('Image upload failed:', error);
        return res.status(500).json({ message: 'Image upload failed', error: error.message });
    }
};

module.exports = {
    upload,
    compressAndUpload
};
