#!/usr/bin/env node
/**
 * fetch-held-items.mjs
 *
 * Fetches held_items for all 1–1025 base Pokémon from PokeAPI and saves a
 * compact lookup to public/data/held-items.json.
 *
 * Structure:
 *   { [pokemonId: string]: { [versionName: string]: [{item: string, rarity: number}] } }
 *
 * Only versions used by Porylist are kept. Pokémon with no held items are omitted.
 *
 * Usage:
 *   node scripts/fetch-held-items.mjs
 *   node scripts/fetch-held-items.mjs --force   (re-fetch even if output exists)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.resolve(__dirname, "../public/data/held-items.json");
const BASE = "https://pokeapi.co/api/v2";
const CONCURRENCY = 10;
const RETRY_LIMIT = 3;
const FORCE = process.argv.includes("--force");

const SUPPORTED_VERSIONS = new Set([
  "red", "blue", "yellow",
  "gold", "silver", "crystal",
  "ruby", "sapphire", "emerald", "firered", "leafgreen",
  "diamond", "pearl", "platinum", "heartgold", "soulsilver",
  "black", "white", "black-2", "white-2",
  "x", "y", "omega-ruby", "alpha-sapphire",
  "sun", "moon", "ultra-sun", "ultra-moon",
  "lets-go-pikachu", "lets-go-eevee",
]);

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

if (!FORCE && fs.existsSync(OUT_FILE)) {
  console.log("held-items.json already exists. Use --force to re-fetch.");
  process.exit(0);
}

console.log("Fetching held items for Pokémon 1–1025…\n");

const result = {};
let done = 0;
const ids = Array.from({ length: 1025 }, (_, i) => i + 1);

const queue = [...ids];
async function worker() {
  while (queue.length > 0) {
    const id = queue.shift();
    try {
      const data = await fetchJson(`${BASE}/pokemon/${id}`);
      if (data.held_items && data.held_items.length > 0) {
        const byVersion = {};
        for (const hi of data.held_items) {
          const itemName = hi.item.name;
          for (const vd of hi.version_details) {
            const v = vd.version.name;
            if (!SUPPORTED_VERSIONS.has(v)) continue;
            if (!byVersion[v]) byVersion[v] = [];
            byVersion[v].push({ item: itemName, rarity: vd.rarity });
          }
        }
        if (Object.keys(byVersion).length > 0) {
          result[String(id)] = byVersion;
        }
      }
    } catch (err) {
      console.error(`\n  Error fetching ${id}: ${err.message}`);
    }
    done++;
    if (done % 50 === 0 || done === ids.length) {
      process.stdout.write(`\r  ${done}/${ids.length}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const pokemonWithItems = Object.keys(result).length;
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(result));

console.log(`\n\nDone. ${pokemonWithItems} Pokémon have held items across supported versions.`);
console.log(`Saved to public/data/held-items.json`);
