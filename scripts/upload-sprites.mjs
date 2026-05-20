#!/usr/bin/env node
/**
 * Uploads trimmed sprites from public/poke-sprites/ to the porylist-sprites R2 bucket.
 * Only uploads files whose MD5 has changed since the last run (tracked via .sprites-manifest.json).
 * Use --force to re-upload everything.
 *
 * Usage:
 *   node scripts/upload-sprites.mjs
 *   node scripts/upload-sprites.mjs --force
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = path.resolve(__dirname, "../public/poke-sprites/sprites/pokemon");
const MANIFEST_PATH = path.resolve(__dirname, "../.sprites-manifest.json");
const BUCKET = "porylist-sprites";
const CONCURRENCY = 50;
const FORCE = process.argv.includes("--force");

// Load env vars from .env.local
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_SPRITES_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SPRITES_SECRET_ACCESS_KEY;

if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
  console.error("❌ Missing R2 credentials in .env.local");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

// Only upload these subdirectories (matching what trim-sprites targets)
const TARGET_DIRS = [
  "versions/generation-i/red-blue",
  "versions/generation-i/yellow",
  "versions/generation-ii/crystal",
  "versions/generation-iii/emerald",
  "versions/generation-iii/firered-leafgreen",
  "versions/generation-iii/ruby-sapphire",
  "versions/generation-iv/heartgold-soulsilver",
  "versions/generation-iv/platinum",
  "versions/generation-v/black-white",
  "versions/generation-vi/omegaruby-alphasapphire",
  "versions/generation-vii/ultra-sun-ultra-moon",
  "other/home",
];

// Collect all PNG files to upload
const files = [];
for (const dir of TARGET_DIRS) {
  const absDir = path.join(SPRITES_DIR, dir);
  if (!fs.existsSync(absDir)) continue;
  for (const file of fs.readdirSync(absDir)) {
    if (!file.endsWith(".png")) continue;
    const absPath = path.join(absDir, file);
    const r2Key = `sprites/pokemon/${dir}/${file}`;
    files.push({ absPath, r2Key });
  }
}

// Load manifest
const manifest = FORCE || !fs.existsSync(MANIFEST_PATH)
  ? {}
  : JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

// Filter to changed files
function md5(buf) {
  return crypto.createHash("md5").update(buf).digest("hex");
}

const toUpload = [];
for (const { absPath, r2Key } of files) {
  const buf = fs.readFileSync(absPath);
  const hash = md5(buf);
  if (!FORCE && manifest[r2Key] === hash) continue;
  toUpload.push({ absPath, r2Key, buf, hash });
}

console.log(`${files.length} sprites found, ${toUpload.length} changed/new. Uploading…\n`);
if (toUpload.length === 0) {
  console.log("Nothing to upload.");
  process.exit(0);
}

// Upload in parallel batches
let done = 0;
let failed = 0;

async function uploadOne({ absPath, r2Key, buf, hash }) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: buf,
    ContentType: "image/png",
  }));
  manifest[r2Key] = hash;
  done++;
  if (done % 200 === 0 || done === toUpload.length) {
    process.stdout.write(`\r  ${done}/${toUpload.length} uploaded`);
  }
}

for (let i = 0; i < toUpload.length; i += CONCURRENCY) {
  const batch = toUpload.slice(i, i + CONCURRENCY);
  const results = await Promise.allSettled(batch.map(uploadOne));
  for (const r of results) {
    if (r.status === "rejected") {
      failed++;
      console.error("\n  Upload error:", r.reason?.message);
    }
  }
}

// Save manifest
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 0));

console.log(`\n\nDone. ${done} uploaded, ${failed} failed.`);
