const mongoose = require('mongoose');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);

// Re-use the S3 client configuration from uploadMiddleware or define a new one here
// Ideally we should share the client, but for now we'll instantiate it to keep this service self-contained
// assuming env vars are globally available.
const s3 = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: "blr1", // Using region from existing code
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET,
    }
});

const performBackup = async () => {
    console.log('Starting database backup...');
    try {
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Database not connected');
        }

        const collections = await mongoose.connection.db.listCollections().toArray();
        const backupData = {
            timestamp: new Date().toISOString(),
            data: {}
        };

        for (const collection of collections) {
            const name = collection.name;
            const data = await mongoose.connection.db.collection(name).find({}).toArray();
            backupData.data[name] = data;
            console.log(`Backup: Fetched ${data.length} documents from ${name}`);
        }

        const jsonString = JSON.stringify(backupData);
        const compressedData = await gzip(jsonString);

        // Filename includes timestamp to ensure unique files (keeps creating new backups)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backups/db-backup-${timestamp}.json.gz`;

        // Use a separate backup bucket if configured, otherwise use the main bucket
        const targetBucket = process.env.DO_BACKUP_BUCKET || process.env.DO_SPACES_BUCKET;

        const command = new PutObjectCommand({
            Bucket: targetBucket,
            Key: filename,
            Body: compressedData,
            ACL: 'private', // Backups should be private
            ContentType: 'application/gzip'
        });

        await s3.send(command);
        console.log(`Backup successful: Uploaded to ${targetBucket}/${filename}`);
        return true;

    } catch (error) {
        console.error('Backup failed:', error);
        return false;
    }
};

module.exports = { performBackup };
