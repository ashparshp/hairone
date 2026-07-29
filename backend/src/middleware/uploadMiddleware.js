const multer = require('multer');
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

// 1. DigitalOcean Spaces Configuration from ENV (re-using existing env vars)
// DigitalOcean Spaces requires us-east-1 with the AWS SDK (not the DO region slug).
const s3 = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: process.env.DO_SPACES_REGION || 'us-east-1',
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

const compressAndUpload = (folder = 'shops') => async (req, res, next) => {
    if (!req.file) return next();

    if (!process.env.DO_SPACES_BUCKET) {
        return res.status(503).json({ message: 'File uploads are not configured (DO_SPACES_BUCKET missing)' });
    }

    try {
        // Sanitize filename
        // 1. Remove special chars
        // 2. Replace spaces with hyphens
        // 3. Ensure uniqueness with timestamp
        const originalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '-');
        const timestamp = Date.now();
        const filename = `${folder}/${timestamp}-${originalName}`;

        // Compress image
        const compressedBuffer = await sharp(req.file.buffer)
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
            ContentType: 'image/jpeg' // We converted to jpeg
        });

        await s3.send(command);

        // Construct Public URL
        // DigitalOcean Spaces URL format: https://<bucket>.<region>.digitaloceanspaces.com/<key>
        // Or if endpoint includes bucket?
        // Let's check how it was used before. usually endpoint is https://<region>.digitaloceanspaces.com
        // And bucket is subdomain.
        // But some configs use endpoint as full bucket URL.
        // Based on shopRoutes.js: endpoint: process.env.DO_SPACES_ENDPOINT

        // If endpoint is `https://nyc3.digitaloceanspaces.com` and bucket is `mybucket`
        // URL is `https://mybucket.nyc3.digitaloceanspaces.com/key`
        // OR `https://nyc3.digitaloceanspaces.com/mybucket/key`

        // multer-s3 usually constructs it automatically.
        // Let's rely on constructing it.

        // I will assume standard format: https://<bucket>.<endpoint_host>/<key>
        // Use URL object to parse endpoint.

        let fileUrl;
        const endpointUrl = new URL(process.env.DO_SPACES_ENDPOINT);
        // Assuming endpoint is like https://blr1.digitaloceanspaces.com

        fileUrl = `https://${process.env.DO_SPACES_BUCKET}.${endpointUrl.hostname}/${filename}`;

        // Attach location to req.file so controllers work as before
        req.file.location = fileUrl;
        req.file.key = filename;
        req.file.bucket = process.env.DO_SPACES_BUCKET;

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
