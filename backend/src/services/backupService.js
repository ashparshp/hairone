const mongoose = require("mongoose");
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require("@aws-sdk/client-s3");
const zlib = require("zlib");
const { logger } = require("../utils/logger");

const getS3Client = () =>
  new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: process.env.DO_SPACES_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    },
  });

const getBackupBucket = () =>
  process.env.DO_BACKUP_BUCKET || process.env.DO_SPACES_BUCKET;

const getRetentionDays = () => {
  const parsed = Number(process.env.BACKUP_RETENTION_DAYS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 14;
  return Math.min(Math.floor(parsed), 365);
};

/**
 * Stream one collection as NDJSON into a gzip buffer without loading the full
 * collection into a single in-memory array/object.
 */
const backupCollectionToGzipBuffer = async (collectionName) => {
  const collection = mongoose.connection.db.collection(collectionName);
  const cursor = collection.find({}).batchSize(200);
  const gzip = zlib.createGzip({ level: 6 });
  const chunks = [];

  gzip.on("data", (chunk) => chunks.push(chunk));

  const gzipDone = new Promise((resolve, reject) => {
    gzip.on("end", resolve);
    gzip.on("error", reject);
  });

  let count = 0;
  for await (const doc of cursor) {
    const line = `${JSON.stringify(doc)}\n`;
    if (!gzip.write(line)) {
      await new Promise((resolve) => gzip.once("drain", resolve));
    }
    count += 1;
  }

  gzip.end();
  await gzipDone;

  return {
    count,
    body: Buffer.concat(chunks),
  };
};

const uploadBuffer = async (s3, bucket, key, body, contentType) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
};

const pruneOldBackups = async (s3, bucket, retentionDays) => {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const prefix = "backups/";
  let continuationToken;
  let deleted = 0;

  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const stale = (listed.Contents || []).filter(
      (obj) => obj.LastModified && obj.LastModified.getTime() < cutoff,
    );

    for (let i = 0; i < stale.length; i += 1000) {
      const batch = stale.slice(i, i + 1000);
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: batch.map((obj) => ({ Key: obj.Key })),
            Quiet: true,
          },
        }),
      );
      deleted += batch.length;
    }

    continuationToken = listed.IsTruncated
      ? listed.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return deleted;
};

const performBackup = async () => {
  const log = logger.child({ job: "db_backup" });
  log.info("backup_started");

  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Database not connected");
    }

    const bucket = getBackupBucket();
    if (!bucket || !process.env.DO_SPACES_KEY || !process.env.DO_SPACES_SECRET) {
      throw new Error("Backup storage is not configured");
    }

    const s3 = getS3Client();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const runPrefix = `backups/${stamp}`;

    const collections = await mongoose.connection.db.listCollections().toArray();
    const summary = [];

    const manifest = {
      timestamp: new Date().toISOString(),
      format: "ndjson.gz",
      collections: collections.map((col) => col.name),
    };

    await uploadBuffer(
      s3,
      bucket,
      `${runPrefix}/manifest.json.gz`,
      zlib.gzipSync(JSON.stringify(manifest, null, 2)),
      "application/gzip",
    );

    for (const collection of collections) {
      const name = collection.name;
      const { count, body } = await backupCollectionToGzipBuffer(name);
      const key = `${runPrefix}/${name}.ndjson.gz`;
      await uploadBuffer(s3, bucket, key, body, "application/gzip");
      summary.push({ collection: name, documents: count, bytes: body.length });
      log.info("backup_collection_uploaded", {
        collection: name,
        documents: count,
        bytes: body.length,
        key,
      });
    }

    const retentionDays = getRetentionDays();
    const pruned = await pruneOldBackups(s3, bucket, retentionDays);

    log.info("backup_completed", {
      bucket,
      prefix: runPrefix,
      collections: summary.length,
      documents: summary.reduce((sum, row) => sum + row.documents, 0),
      pruned,
      retentionDays,
    });

    return { ok: true, prefix: runPrefix, summary, pruned };
  } catch (error) {
    log.error("backup_failed", { err: error });
    return { ok: false, error: error.message };
  }
};

module.exports = {
  performBackup,
  getRetentionDays,
};
