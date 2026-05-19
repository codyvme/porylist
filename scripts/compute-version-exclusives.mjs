#!/usr/bin/env node
/**
 * Scans public/data/pokemon/{1..1025}/encounters.json and produces
 * public/data/version-exclusives.json.
 *
 * A Pokémon is "exclusive" to version A (vs version B) when it appears in
 * any encounter record for A but has zero encounter records for B.
 * Middle versions in trios (Yellow, Emerald, Platinum) are excluded from
 * the comparison — they're not one of the two paired slots.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");

// Game pairs: [gameValue, versionA, labelA, versionB, labelB]
// Only include games that have meaningful version-exclusive content.
const PAIRS = [
  ["red-blue-yellow",               "red",               "Red",                "blue",             "Blue"],
  ["gold-silver-crystal",           "gold",              "Gold",               "silver",           "Silver"],
  ["ruby-sapphire-emerald",         "ruby",              "Ruby",               "sapphire",         "Sapphire"],
  ["firered-leafgreen",             "firered",           "FireRed",            "leafgreen",        "LeafGreen"],
  ["diamond-pearl-platinum",        "diamond",           "Diamond",            "pearl",            "Pearl"],
  ["heartgold-soulsilver",          "heartgold",         "HeartGold",          "soulsilver",       "SoulSilver"],
  ["black-white",                   "black",             "Black",              "white",            "White"],
  ["black2-white2",                 "black-2",           "Black 2",            "white-2",          "White 2"],
  ["x-y",                           "x",                 "X",                  "y",                "Y"],
  ["omega-ruby-alpha-sapphire",     "omega-ruby",        "Omega Ruby",         "alpha-sapphire",   "Alpha Sapphire"],
  ["sun-moon",                      "sun",               "Sun",                "moon",             "Moon"],
  ["ultra-sun-ultra-moon",          "ultra-sun",         "Ultra Sun",          "ultra-moon",       "Ultra Moon"],
  ["lets-go",                       "lets-go-pikachu",   "Let's Go, Pikachu!", "lets-go-eevee",    "Let's Go, Eevee!"],
  ["sword-shield",                  "sword",             "Sword",              "shield",           "Shield"],
  ["brilliant-diamond-shining-pearl","brilliant-diamond","Brilliant Diamond",  "shining-pearl",    "Shining Pearl"],
  ["scarlet-violet",                "scarlet",           "Scarlet",            "violet",           "Violet"],
];

// For each Pokémon ID, collect the set of versions it appears in.
console.log("Scanning encounter files…");

// Map: versionName → Set<id>
const versionToIds = new Map();

let scanned = 0;
let missing = 0;

for (let id = 1; id <= 1025; id++) {
  const path = join(DATA_DIR, "pokemon", String(id), "encounters.json");
  if (!existsSync(path)) {
    missing++;
    continue;
  }
  const encounters = JSON.parse(readFileSync(path, "utf8"));
  const versionsForThis = new Set();
  for (const area of encounters) {
    for (const vd of area.version_details) {
      versionsForThis.add(vd.version.name);
    }
  }
  for (const v of versionsForThis) {
    if (!versionToIds.has(v)) versionToIds.set(v, new Set());
    versionToIds.get(v).add(id);
  }
  scanned++;
}

console.log(`Scanned ${scanned} encounter files (${missing} missing/empty).`);
console.log("Versions found:", [...versionToIds.keys()].sort().join(", "));

// Build the output object.
const output = {};

for (const [gameValue, vA, labelA, vB, labelB] of PAIRS) {
  const idsA = versionToIds.get(vA) ?? new Set();
  const idsB = versionToIds.get(vB) ?? new Set();

  // Exclusive to A: in A but not B
  const exclusiveA = [...idsA].filter(id => !idsB.has(id)).sort((a, b) => a - b);
  // Exclusive to B: in B but not A
  const exclusiveB = [...idsB].filter(id => !idsA.has(id)).sort((a, b) => a - b);

  output[gameValue] = {
    versions: [
      { key: vA, label: labelA, exclusiveIds: exclusiveA },
      { key: vB, label: labelB, exclusiveIds: exclusiveB },
    ],
  };

  console.log(`  ${gameValue}: ${labelA} has ${exclusiveA.length} exclusives, ${labelB} has ${exclusiveB.length} exclusives`);
}

const outPath = join(DATA_DIR, "version-exclusives.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nWrote ${outPath}`);
