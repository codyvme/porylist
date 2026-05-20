#!/usr/bin/env node
/**
 * Trims transparent padding from Pokémon sprite PNGs in-place.
 *
 * Targets only the version folders used by the app plus the HOME renders.
 * Adds a small uniform padding back (PADDING px on each side) so sprites
 * don't clip right at the canvas edge.
 *
 * Usage:
 *   node scripts/trim-sprites.mjs
 *   node scripts/trim-sprites.mjs --dry-run   (print files without writing)
 */

import sharp from "sharp";
import { readdir, stat } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = join(__dirname, "..", "public", "poke-sprites", "sprites", "pokemon");

// Uniform padding (px) added back after trimming so sprites don't clip edges
const PADDING = 2;

const DRY_RUN = process.argv.includes("--dry-run");

// Directories to process (relative to SPRITES_DIR)
const TARGETS = [
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

async function trimSprite(filePath) {
  const img = sharp(filePath);
  const { data, info } = await img
    .trim({ threshold: 0 })
    .toBuffer({ resolveWithObject: true });

  // If trim made no change (or image is tiny), skip
  if (info.trimOffsetLeft === undefined) return false;

  // Add padding back
  await sharp(data)
    .extend({
      top: PADDING,
      bottom: PADDING,
      left: PADDING,
      right: PADDING,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(filePath);

  return true;
}

async function processDir(dirPath) {
  let files;
  try {
    files = await readdir(dirPath);
  } catch {
    console.warn(`  Skipping missing dir: ${dirPath}`);
    return { processed: 0, trimmed: 0 };
  }

  const pngs = files.filter(f => f.endsWith(".png"));
  let processed = 0;
  let trimmed = 0;

  for (const file of pngs) {
    const filePath = join(dirPath, file);
    processed++;
    if (DRY_RUN) {
      process.stdout.write(".");
    } else {
      try {
        const changed = await trimSprite(filePath);
        if (changed) trimmed++;
        if (processed % 100 === 0) process.stdout.write(`\n  ${processed}/${pngs.length}`);
      } catch (err) {
        console.error(`\n  Error processing ${file}: ${err.message}`);
      }
    }
  }

  process.stdout.write("\n");
  return { processed, trimmed };
}

console.log(`Trimming sprites${DRY_RUN ? " (DRY RUN)" : ""}…\n`);

let totalProcessed = 0;
let totalTrimmed = 0;

for (const target of TARGETS) {
  const dirPath = join(SPRITES_DIR, target);
  console.log(`▸ ${target}`);
  const { processed, trimmed } = await processDir(dirPath);
  totalProcessed += processed;
  totalTrimmed += trimmed;
  if (!DRY_RUN) console.log(`  ${trimmed}/${processed} trimmed`);
}

console.log(`\nDone. ${totalTrimmed}/${totalProcessed} sprites trimmed.`);
