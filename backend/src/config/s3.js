const { S3Client } = require('@aws-sdk/client-s3');

const isStorageConfigured = () =>
  Boolean(
    process.env.DO_SPACES_BUCKET &&
      process.env.DO_SPACES_ENDPOINT &&
      process.env.DO_SPACES_KEY &&
      process.env.DO_SPACES_SECRET &&
      process.env.DO_SPACES_KEY !== 'your_spaces_access_key',
  );

const s3 = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT,
  region: process.env.DO_SPACES_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
});

module.exports = {
  s3,
  isStorageConfigured,
};
