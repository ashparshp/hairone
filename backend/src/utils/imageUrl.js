const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3, isStorageConfigured } = require('../config/s3');

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

const extractS3Key = (url) => {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);
    const bucket = process.env.DO_SPACES_BUCKET;
    if (!bucket) return null;

    const keyFromPath = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (!keyFromPath) return null;

    if (parsed.hostname.startsWith(`${bucket}.`)) {
      return keyFromPath;
    }

    if (keyFromPath.startsWith(`${bucket}/`)) {
      return keyFromPath.slice(bucket.length + 1);
    }

    return keyFromPath;
  } catch {
    return null;
  }
};

const signImageUrl = async (url) => {
  if (!url || !isStorageConfigured()) return url;

  const key = extractS3Key(url);
  if (!key) return url;

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: key,
    });

    return await getSignedUrl(s3, command, {
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
  } catch (error) {
    console.error('Failed to sign image URL:', error.message);
    return url;
  }
};

const withSignedShopImages = async (shop) => {
  if (!shop) return shop;

  const data = typeof shop.toObject === 'function' ? shop.toObject() : { ...shop };

  if (data.image) {
    data.image = await signImageUrl(data.image);
  }

  if (Array.isArray(data.gallery)) {
    data.gallery = await Promise.all(data.gallery.map(signImageUrl));
  }

  return data;
};

const withSignedUserAvatar = async (user) => {
  if (!user) return user;

  const data = typeof user.toObject === 'function' ? user.toObject() : { ...user };

  if (data.avatar) {
    data.avatar = await signImageUrl(data.avatar);
  }

  return data;
};

module.exports = {
  signImageUrl,
  withSignedShopImages,
  withSignedUserAvatar,
};
