const { S3Client } = require('@aws-sdk/client-s3');

const isStorageConfigured = () =>
  Boolean(
    process.env.DO_SPACES_BUCKET &&
      process.env.DO_SPACES_KEY &&
      process.env.DO_SPACES_SECRET &&
      process.env.DO_SPACES_KEY !== 'your_spaces_access_key',
  );

const buildS3ClientConfig = () => {
  const region = process.env.DO_SPACES_REGION || 'us-east-1';
  const config = {
    region,
    credentials: {
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    },
  };

  const endpoint = process.env.DO_SPACES_ENDPOINT;
  if (endpoint?.includes('digitaloceanspaces.com')) {
    config.endpoint = endpoint;
  }

  return config;
};

const s3 = new S3Client(buildS3ClientConfig());

module.exports = {
  s3,
  isStorageConfigured,
};
