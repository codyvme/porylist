#!/usr/bin/env node
/**
 * Inverts public/data/pokemon/{1..1025}/encounters.json into per-game
 * route files at public/data/route-data/{gameValue}.json.
 *
 * Each file contains a sorted list of locations with the Pokémon that
 * appear there, grouped by version and method.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");
const OUT_DIR = join(DATA_DIR, "route-data");

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Location ordering data produced by fetch-location-order.mjs
// Maps location-area name → { generationName: gameIndex }
const locationOrderPath = join(__dirname, "location-order.json");
const locationOrder = existsSync(locationOrderPath)
  ? JSON.parse(readFileSync(locationOrderPath, "utf8"))
  : {};

if (Object.keys(locationOrder).length === 0) {
  console.warn("⚠  location-order.json not found — locations will be sorted alphabetically.");
  console.warn("   Run: node scripts/fetch-location-order.mjs\n");
}

// Maps each game group to the PokeAPI generation name used for game_index lookups.
// PokeAPI only has game_indices for gen-iv onward, so earlier games use the
// closest available generation (the remakes share the same region ordering).
const GAME_GENERATION = {
  "red-blue-yellow":              "generation-iv",  // Kanto — uses FRLG/HGSS indices
  "gold-silver-crystal":          "generation-iv",  // Johto — uses HGSS indices
  "ruby-sapphire-emerald":        "generation-vi",  // Hoenn — uses ORAS indices
  "firered-leafgreen":            "generation-iv",  // Kanto — uses FRLG/HGSS indices
  "diamond-pearl-platinum":       "generation-iv",
  "heartgold-soulsilver":         "generation-iv",
  "black-white":                  "generation-v",
  "black2-white2":                "generation-v",
  "x-y":                          "generation-vi",
  "omega-ruby-alpha-sapphire":    "generation-vi",
  "sun-moon":                     "generation-vii",
  "ultra-sun-ultra-moon":         "generation-vii",
  "lets-go":                      "generation-iv",  // Kanto
};

const GAME_VERSIONS = {
  "red-blue-yellow":               ["red", "blue", "yellow"],
  "gold-silver-crystal":           ["gold", "silver", "crystal"],
  "ruby-sapphire-emerald":         ["ruby", "sapphire", "emerald"],
  "firered-leafgreen":             ["firered", "leafgreen"],
  "diamond-pearl-platinum":        ["diamond", "pearl", "platinum"],
  "heartgold-soulsilver":          ["heartgold", "soulsilver"],
  "black-white":                   ["black", "white"],
  "black2-white2":                 ["black-2", "white-2"],
  "x-y":                           ["x", "y"],
  "omega-ruby-alpha-sapphire":     ["omega-ruby", "alpha-sapphire"],
  "sun-moon":                      ["sun", "moon"],
  "ultra-sun-ultra-moon":          ["ultra-sun", "ultra-moon"],
  "lets-go":                       ["lets-go-pikachu", "lets-go-eevee"],
  "sword-shield":                  ["sword", "shield"],
  "brilliant-diamond-shining-pearl": ["brilliant-diamond", "shining-pearl"],
  "legends-arceus":                ["legends-arceus"],
  "scarlet-violet":                ["scarlet", "violet"],
  "legends-za":                    ["scarlet", "violet"],
};

// Method name → display label
const METHOD_LABEL = {
  "walk":              "Grass",
  "old-rod":           "Old Rod",
  "good-rod":          "Good Rod",
  "super-rod":         "Super Rod",
  "surf":              "Surfing",
  "rock-smash":        "Rock Smash",
  "headbutt":          "Headbutt",
  "headbutt-normal":   "Headbutt",
  "headbutt-special":  "Headbutt",
  "headbutt-high":     "Headbutt",
  "headbutt-low":      "Headbutt",
  "honey-tree":        "Honey Tree",
  "grass-spots":       "Tall Grass",
  "dark-grass-spots":  "Dark Grass",
  "cave-spots":        "Cave",
  "bridge-spots":      "Bridge Shadow",
  "super-rod-spots":   "Super Rod",
  "surf-spots":        "Surfing",
  "gift":              "Gift",
  "gift-egg":          "Egg Gift",
  "unknown":           "Unknown",
};

function methodLabel(method) {
  return METHOD_LABEL[method] ?? method.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// Convert a location-area API key to a human-readable label.
// Strips trailing "-area" and formats the rest.
function locationLabel(key) {
  let s = key.replace(/-area$/, "");
  // Special abbreviation fixes
  s = s
    .replace(/\bmt\b/g, "Mt.")
    .replace(/\bst\b/g, "St.")
    .replace(/\bss\b/g, "S.S.")
    .replace(/-(\d+)([fF])\b/g, (_, n, f) => ` ${n}${f.toUpperCase()}`) // 1f → 1F
    .replace(/-b(\d+)([fF])\b/g, (_, n, f) => ` B${n}${f.toUpperCase()}`); // b1f → B1F
  return s
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Step 1: Read all encounter files and build an inverted index ───────────────
// locationKey → pokemonId → versionName → `method:timeOfDay` → { method, timeOfDay, minLevel, maxLevel, chance }

console.log("Reading encounter files…");

function getTimeOfDay(conditionValues) {
  for (const cv of conditionValues) {
    if (cv.name === "time-morning") return "morning";
    if (cv.name === "time-day")     return "day";
    if (cv.name === "time-night")   return "night";
  }
  return "";
}

// Map: locationKey → Map(pokemonId → { id, name, versions: Map(versionName → Map(slotKey → {...})) })
const locationMap = new Map();

for (let id = 1; id <= 1025; id++) {
  const path = join(DATA_DIR, "pokemon", String(id), "encounters.json");
  if (!existsSync(path)) continue;
  const encounters = JSON.parse(readFileSync(path, "utf8"));

  for (const area of encounters) {
    const locKey = area.location_area.name;
    if (!locationMap.has(locKey)) locationMap.set(locKey, new Map());
    const pokemonMap = locationMap.get(locKey);

    if (!pokemonMap.has(id)) {
      pokemonMap.set(id, { id, name: null, versions: new Map() });
    }
    const entry = pokemonMap.get(id);

    for (const vd of area.version_details) {
      const vName = vd.version.name;
      if (!entry.versions.has(vName)) entry.versions.set(vName, new Map());
      const slotMap = entry.versions.get(vName);

      for (const enc of vd.encounter_details) {
        const mName = enc.method.name;
        const timeOfDay = getTimeOfDay(enc.condition_values);
        const slotKey = `${mName}:${timeOfDay}`;
        if (!slotMap.has(slotKey)) {
          slotMap.set(slotKey, { method: mName, timeOfDay, minLevel: enc.min_level, maxLevel: enc.max_level, chance: enc.chance });
        } else {
          const existing = slotMap.get(slotKey);
          existing.minLevel = Math.min(existing.minLevel, enc.min_level);
          existing.maxLevel = Math.max(existing.maxLevel, enc.max_level);
          existing.chance += enc.chance;
        }
      }
    }
  }
}

// ── Step 2: Build id → name map from the main pokemon list ───────────────────
console.log("Loading Pokémon names…");
const idToName = new Map();
const pokemonList = JSON.parse(readFileSync(join(DATA_DIR, "pokemon.json"), "utf8"));
for (const entry of pokemonList.results) {
  const idMatch = entry.url.match(/\/(\d+)\/?$/);
  if (idMatch) idToName.set(Number(idMatch[1]), entry.name);
}

// ── Step 3: Produce per-game JSON files ──────────────────────────────────────
for (const [gameValue, versions] of Object.entries(GAME_VERSIONS)) {
  const versionSet = new Set(versions);
  const locations = [];

  for (const [locKey, pokemonMap] of locationMap) {
    // Collect encounters relevant to this game's versions
    const encounters = [];
    for (const [id, entry] of pokemonMap) {
      const name = idToName.get(id);
      if (!name) continue;
      for (const [vName, slotMap] of entry.versions) {
        if (!versionSet.has(vName)) continue;
        for (const { method, timeOfDay, minLevel, maxLevel, chance } of slotMap.values()) {
          encounters.push({
            id,
            name,
            version: vName,
            method,
            methodLabel: methodLabel(method),
            timeOfDay,
            minLevel,
            maxLevel,
            chance,
          });
        }
      }
    }
    if (encounters.length === 0) continue;

    // Sort encounters: by method then by id
    encounters.sort((a, b) => {
      if (a.method !== b.method) return a.method.localeCompare(b.method);
      return a.id - b.id;
    });

    locations.push({
      key: locKey,
      label: locationLabel(locKey),
      encounters,
    });
  }

  // Sort locations by in-game order (game_index from PokeAPI), falling back
  // to alphabetical for any locations not present in location-order.json.
  const gen = GAME_GENERATION[gameValue];
  locations.sort((a, b) => {
    const aIdx = gen ? (locationOrder[a.key]?.[gen] ?? 9999) : 9999;
    const bIdx = gen ? (locationOrder[b.key]?.[gen] ?? 9999) : 9999;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.label.localeCompare(b.label);
  });

  const outPath = join(OUT_DIR, `${gameValue}.json`);
  writeFileSync(outPath, JSON.stringify({ locations }, null, 0));
  console.log(`  ${gameValue}: ${locations.length} locations`);
}

console.log("\nDone.");
