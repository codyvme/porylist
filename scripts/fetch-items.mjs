#!/usr/bin/env node
/**
 * fetch-items.mjs
 *
 * Fetches item data from PokéAPI for a curated set of categories and saves
 * individual JSON files to public/data/item/{name}.json.  Resumable — skips
 * files that already exist unless --force is passed.
 *
 * Usage:
 *   node scripts/fetch-items.mjs
 *   node scripts/fetch-items.mjs --force
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ITEM_DIR = join(__dirname, "..", "public", "data", "item");
const BASE = "https://pokeapi.co/api/v2";
const CONCURRENCY = 8;
const RETRY_LIMIT = 3;
const FORCE = process.argv.includes("--force");

const INCLUDED_CATEGORIES = new Set([
  "standard-balls", "special-balls", "apricorn-balls",
  "medicine", "healing", "revival", "pp-recovery", "status-cures",
  "vitamins", "effort-drop",
  "held-items", "choice", "type-enhancement", "type-protection",
  "bad-held-items", "species-specific", "plates", "memories",
  "mega-stones", "z-crystals", "nature-mints",
  "stat-boosts", "in-a-pinch", "picky-healing",
  "evolution", "effort-training", "training",
  "jewels", "scarves", "flutes", "other",
]);

mkdirSync(ITEM_DIR, { recursive: true });

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return await res.json();
  } catch (err) {
    if (attempt < RETRY_LIMIT) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return fetchJson(url, attempt + 1);
    }
    throw err;
  }
}

// Collect item names from all included categories
console.log("Fetching item categories…");
const allCategories = await fetchJson(`${BASE}/item-category/?limit=200`);
const itemNames = new Set();

for (const cat of allCategories.results) {
  if (!INCLUDED_CATEGORIES.has(cat.name)) continue;
  const catData = await fetchJson(cat.url);
  for (const item of catData.items) {
    itemNames.add(item.name);
  }
}

console.log(`Found ${itemNames.size} items across ${INCLUDED_CATEGORIES.size} categories.\n`);

// Determine which items still need fetching
const existing = FORCE ? new Set() : new Set(
  readdirSync(ITEM_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""))
);
const toFetch = [...itemNames].filter((name) => !existing.has(name));
console.log(`${existing.size} already cached, fetching ${toFetch.length} items…\n`);

let done = 0;
let errors = 0;
const queue = [...toFetch];

async function worker() {
  while (queue.length > 0) {
    const name = queue.shift();
    try {
      const data = await fetchJson(`${BASE}/item/${name}`);
      // Strip large/irrelevant fields before saving
      const slim = {
        id: data.id,
        name: data.name,
        cost: data.cost,
        category: data.category,
        effect_entries: data.effect_entries,
        flavor_text_entries: data.flavor_text_entries,
        names: data.names,
        sprites: data.sprites,
      };
      writeFileSync(join(ITEM_DIR, `${name}.json`), JSON.stringify(slim));
    } catch (err) {
      console.error(`\n  Error fetching ${name}: ${err.message}`);
      errors++;
    }
    done++;
    if (done % 25 === 0 || done === toFetch.length) {
      process.stdout.write(`\r  ${done + existing.size}/${itemNames.size} (${errors} errors)`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`\n\nDone. ${itemNames.size - errors} items saved to public/data/item/`);
