const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3, isStorageConfigured } = require('../config/s3');

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

const isPlaceholderUrl = (url) =>
  typeof url === 'string' && url.includes('placeholder.com');

const parseObjectUrl = (url) => {
  if (!url || typeof url !== 'string' || isPlaceholderUrl(url)) return null;

  try {
    const parsed = new URL(url);
    const keyFromPath = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (!keyFromPath) return null;

    // AWS virtual-hosted: bucket.s3.region.amazonaws.com
    const awsVirtual = parsed.hostname.match(/^(.+)\.s3[.-][a-z0-9-]+\.amazonaws\.com$/i);
    if (awsVirtual) {
      return { bucket: awsVirtual[1], key: keyFromPath };
    }

    // AWS legacy virtual-hosted: bucket.s3.amazonaws.com
    const awsLegacy = parsed.hostname.match(/^(.+)\.s3\.amazonaws\.com$/i);
    if (awsLegacy) {
      return { bucket: awsLegacy[1], key: keyFromPath };
    }

    // DigitalOcean Spaces virtual-hosted: bucket.region.digitaloceanspaces.com
    const doVirtual = parsed.hostname.match(/^(.+)\.[a-z0-9-]+\.digitaloceanspaces\.com$/i);
    if (doVirtual) {
      return { bucket: doVirtual[1], key: keyFromPath };
    }

    const configuredBucket = process.env.DO_SPACES_BUCKET;
    if (configuredBucket) {
      if (parsed.hostname.startsWith(`${configuredBucket}.`)) {
        return { bucket: configuredBucket, key: keyFromPath };
      }

      if (keyFromPath.startsWith(`${configuredBucket}/`)) {
        return {
          bucket: configuredBucket,
          key: keyFromPath.slice(configuredBucket.length + 1),
        };
      }
    }

    return null;
  } catch {
    return null;
  }
};

const signImageUrl = async (url) => {
  if (!url || isPlaceholderUrl(url)) return null;
  if (!isStorageConfigured()) return url;

  const location = parseObjectUrl(url);
  if (!location) return url;

  try {
    const command = new GetObjectCommand({
      Bucket: location.bucket,
      Key: location.key,
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
    data.gallery = (await Promise.all(data.gallery.map(signImageUrl))).filter(Boolean);
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
  parseObjectUrl,
  withSignedShopImages,
  withSignedUserAvatar,
};
