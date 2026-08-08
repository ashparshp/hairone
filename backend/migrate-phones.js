/**
 * One-time migration: rewrite User.phone values to canonical 10-digit Indian mobiles.
 * Skips rows that would collide with an existing canonical phone.
 *
 * Usage (from repo root or backend/):
 *   node backend/migrate-phones.js
 *   node backend/migrate-phones.js --dry-run
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");
const { normalizeIndianPhone } = require("./src/utils/phoneUtils");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hairone";
const dryRun = process.argv.includes("--dry-run");

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log(dryRun ? "Dry run — no writes" : "Migrating phones…");

  const users = await User.find({}).select("_id phone role");
  let updated = 0;
  let skippedInvalid = 0;
  let skippedConflict = 0;
  let alreadyOk = 0;

  for (const user of users) {
    const normalized = normalizeIndianPhone(user.phone);
    if (!normalized) {
      skippedInvalid += 1;
      console.log(`skip invalid: ${user._id} phone=${JSON.stringify(user.phone)}`);
      continue;
    }

    if (user.phone === normalized) {
      alreadyOk += 1;
      continue;
    }

    const conflict = await User.findOne({
      phone: normalized,
      _id: { $ne: user._id },
    }).select("_id");

    if (conflict) {
      skippedConflict += 1;
      console.log(
        `skip conflict: ${user._id} ${user.phone} → ${normalized} (held by ${conflict._id})`,
      );
      continue;
    }

    console.log(`${dryRun ? "would update" : "update"}: ${user._id} ${user.phone} → ${normalized}`);
    if (!dryRun) {
      user.phone = normalized;
      await user.save();
    }
    updated += 1;
  }

  console.log({
    total: users.length,
    updated,
    alreadyOk,
    skippedInvalid,
    skippedConflict,
    dryRun,
  });

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
