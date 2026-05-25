#!/usr/bin/env node
/**
 * Scrapes Pokémon encounter data for Brilliant Diamond/Shining Pearl and
 * Sword/Shield from Bulbapedia's MediaWiki API, converting it into the same
 * route-data JSON format used by the existing Gen 1–7 data.
 *
 * Writes to:
 *   public/data/route-data/brilliant-diamond-shining-pearl.json
 *   public/data/route-data/sword-shield.json
 *
 * Usage:
 *   node scripts/scrape-gen8-encounters.mjs          # resumable (uses cache)
 *   node scripts/scrape-gen8-encounters.mjs --force  # re-fetch all pages
 *
 * Pages are cached in .bulba-cache/ to allow resuming after failures.
 * Requests are throttled to 1 per 600 ms to be polite to Bulbapedia's servers.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT        = join(__dirname, "..");
const OUT_DIR     = join(ROOT, "public", "data", "route-data");
const CACHE_DIR   = join(ROOT, ".bulba-cache");
const SUMMARY_PATH = join(ROOT, "src", "data", "pokemon-summary.json");

const FORCE = process.argv.includes("--force");
const API   = "https://bulbapedia.bulbagarden.net/w/api.php";
const DELAY_MS = 600;

// ─── Pokémon name/slug helpers ────────────────────────────────────────────────

// Load pokemon-summary.json to build dex# → slug lookup
const pokemonSummary = JSON.parse(readFileSync(SUMMARY_PATH, "utf8"));
// Index by national dex id (1-based)
const dexToSlug = new Map();
for (const p of pokemonSummary) {
  if (!dexToSlug.has(p.id)) dexToSlug.set(p.id, p.name);
}

// Manual overrides for Pokémon that appear in encounter tables with display
// names that don't cleanly convert to slugs.
const NAME_OVERRIDE = {
  "nidoran♀":   "nidoran-f",
  "nidoran♂":   "nidoran-m",
  "farfetch'd":  "farfetchd",
  "sirfetch'd":  "sirfetchd",
  "mr. mime":    "mr-mime",
  "mr. rime":    "mr-rime",
  "mime jr.":    "mime-jr",
  "flabébé":    "flabebe",
  "ho-oh":       "ho-oh",
  "porygon-z":   "porygon-z",
  "jangmo-o":    "jangmo-o",
  "hakamo-o":    "hakamo-o",
  "kommo-o":     "kommo-o",
  "tapu koko":   "tapu-koko",
  "tapu lele":   "tapu-lele",
  "tapu bulu":   "tapu-bulu",
  "tapu fini":   "tapu-fini",
  "type: null":  "type-null",
  "zygarde":     "zygarde",
  "wishiwashi":  "wishiwashi",
  "eiscue":      "eiscue",
  "indeedee":    "indeedee",
  "morpeko":     "morpeko",
};

function nameToSlug(name) {
  const lower = name.toLowerCase().trim();
  if (NAME_OVERRIDE[lower]) return NAME_OVERRIDE[lower];
  return lower
    .replace(/♀/g,  "-f")
    .replace(/♂/g,  "-m")
    .replace(/é/g,   "e")
    .replace(/[''']/g, "")
    .replace(/\./g,  "")
    .replace(/:\s*/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Method mapping ───────────────────────────────────────────────────────────

// Bulbapedia method string → { method, methodLabel } in our format
const BDSP_METHODS = {
  "grass":         { method: "walk",       methodLabel: "Grass" },
  "surfing":       { method: "surf",       methodLabel: "Surfing" },
  "old rod":       { method: "old-rod",    methodLabel: "Old Rod" },
  "good rod":      { method: "good-rod",   methodLabel: "Good Rod" },
  "super rod":     { method: "super-rod",  methodLabel: "Super Rod" },
  "swarm":         { method: "grass-spots", methodLabel: "Swarm" },
  "poké radar":    { method: "poke-radar", methodLabel: "Poké Radar" },
  "poke radar":    { method: "poke-radar", methodLabel: "Poké Radar" },
  "honey":         { method: "honey-tree", methodLabel: "Honey Tree" },
  "rock smash":    { method: "rock-smash", methodLabel: "Rock Smash" },
  "gift":          { method: "gift",       methodLabel: "Gift" },
  "gift egg":      { method: "gift-egg",   methodLabel: "Gift Egg" },
  "headbutt":      { method: "headbutt",   methodLabel: "Headbutt" },
  "trophy garden": { method: "grass-spots", methodLabel: "Trophy Garden" },
  "safari zone":   { method: "walk",       methodLabel: "Safari Zone" },
  "fr":            { method: "walk",       methodLabel: "Dual-Slot" },   // dual-slot migration
  "lg":            { method: "walk",       methodLabel: "Dual-Slot" },
};

const SWSH_METHODS = {
  "grass":         { method: "walk",       methodLabel: "Grass" },
  "surfing":       { method: "surf",       methodLabel: "Surfing" },
  "surf":          { method: "surf",       methodLabel: "Surfing" },
  "fishing":       { method: "super-rod",  methodLabel: "Fishing" },
  "old rod":       { method: "old-rod",    methodLabel: "Old Rod" },
  "good rod":      { method: "good-rod",   methodLabel: "Good Rod" },
  "super rod":     { method: "super-rod",  methodLabel: "Super Rod" },
  "berry tree":    { method: "honey-tree", methodLabel: "Berry Tree" },
  "curry":         { method: "curry",      methodLabel: "Curry" },
  "gift":          { method: "gift",       methodLabel: "Gift" },
  "gift egg":      { method: "gift-egg",   methodLabel: "Gift Egg" },
  "fossil":        { method: "gift",       methodLabel: "Fossil" },
  "trade":         { method: "gift",       methodLabel: "Trade" },
  "wanderer":      { method: "walk",       methodLabel: "Wanderer" },
  "rock smash":    { method: "rock-smash", methodLabel: "Rock Smash" },
};

function resolveMethod(raw, table) {
  const key = raw.toLowerCase().trim();
  return table[key] ?? { method: key.replace(/\s+/g, "-"), methodLabel: raw.trim() };
}

// ─── Template parsing ─────────────────────────────────────────────────────────

/**
 * Parse a single pipe-delimited template body (the content between {{ and }})
 * into positional params and a named-param map.
 */
function parseTemplateParams(body) {
  const positional = [];
  const named      = {};

  // Split on | but be careful about nested {{ }}
  const parts = [];
  let depth = 0, cur = "";
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "{" && body[i + 1] === "{") { depth++; cur += "{{"; i++; }
    else if (body[i] === "}" && body[i + 1] === "}") { depth--; cur += "}}"; i++; }
    else if (body[i] === "|" && depth === 0) { parts.push(cur.trim()); cur = ""; }
    else { cur += body[i]; }
  }
  if (cur.trim()) parts.push(cur.trim());

  // First part is the template name — skip it
  for (let i = 1; i < parts.length; i++) {
    const eqIdx = parts[i].indexOf("=");
    // Named param: must have = and the part before = looks like a name (no spaces / % / digits-only)
    if (eqIdx > 0) {
      const potentialKey = parts[i].slice(0, eqIdx).trim();
      if (/^[a-zA-Z_][\w]*$/.test(potentialKey)) {
        named[potentialKey.toLowerCase()] = parts[i].slice(eqIdx + 1).trim();
        continue;
      }
    }
    positional.push(parts[i]);
  }

  return { positional, named };
}

/**
 * Extract a rate number from a string like "50%", "40%", "all=20%", or a
 * weather-keyed object. Returns null if the value signals "0" or "—".
 */
function parseRate(str) {
  if (!str) return null;
  const cleaned = str.replace(/%/g, "").trim();
  if (cleaned === "0" || cleaned === "—" || cleaned === "") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Parse the level string "2-3" or "5" into { min, max }.
 */
function parseLevel(str) {
  const parts = str.split("-");
  const min = parseInt(parts[0], 10);
  const max = parseInt(parts[1] ?? parts[0], 10);
  return { min: isNaN(min) ? 1 : min, max: isNaN(max) ? min : max };
}

// ─── Location key / label helpers ─────────────────────────────────────────────

function pageToKey(title) {
  return title
    .toLowerCase()
    .replace(/[''']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Encounter builders ────────────────────────────────────────────────────────

function makeEncounter({ id, name, version, method, methodLabel, timeOfDay, min, max, chance }) {
  return { id, name, version, method, methodLabel, timeOfDay, minLevel: min, maxLevel: max, chance, heldItems: [] };
}

/**
 * Parse all catch/entrybdsp templates from wikitext.
 * Returns an array of encounter objects (potentially multiple per template for time-of-day).
 */
function parseBDSPEncounters(wikitext) {
  const encounters = [];
  // Match {{Catch/entrybdsp|...}} (case-insensitive, spanning newlines)
  const re = /\{\{[Cc]atch\/entrybdsp([\s\S]*?)\}\}/g;
  let m;
  while ((m = re.exec(wikitext)) !== null) {
    try {
      const { positional, named } = parseTemplateParams("entrybdsp" + m[1]);
      // positional[0]=dex, [1]=name, [2]=bd, [3]=sp, [4]=method, [5]=level
      // then either named all= or positional [6]=morning, [7]=day, [8]=night
      const dexNum  = parseInt(positional[0], 10);
      const rawName = positional[1] ?? "";
      const inBD    = (positional[2] ?? "").toLowerCase() !== "no";
      const inSP    = (positional[3] ?? "").toLowerCase() !== "no";
      const rawMethod = positional[4] ?? "Grass";
      const rawLevel  = positional[5] ?? "1";

      if (!inBD && !inSP) continue; // skip if in neither version

      const slug = dexToSlug.get(dexNum) ?? nameToSlug(rawName);
      if (!slug) continue;

      const { method, methodLabel } = resolveMethod(rawMethod, BDSP_METHODS);
      const { min, max } = parseLevel(rawLevel);

      const versions = [];
      if (inBD) versions.push("brilliant-diamond");
      if (inSP) versions.push("shining-pearl");

      // Determine rates
      let rates; // [{timeOfDay, chance}]
      if (named.all) {
        const r = parseRate(named.all);
        if (r !== null) rates = [{ timeOfDay: "", chance: r }];
      } else {
        const morning = parseRate(positional[6]);
        const day     = parseRate(positional[7]);
        const night   = parseRate(positional[8]);
        if (morning === null && day === null && night === null) continue;

        // If all rates are equal, emit one entry
        if (morning === day && day === night) {
          rates = [{ timeOfDay: "", chance: morning ?? day ?? night }];
        } else {
          rates = [];
          if (morning !== null) rates.push({ timeOfDay: "morning", chance: morning });
          if (day     !== null) rates.push({ timeOfDay: "day",     chance: day });
          if (night   !== null) rates.push({ timeOfDay: "night",   chance: night });
        }
      }
      if (!rates || rates.length === 0) continue;

      for (const ver of versions) {
        for (const { timeOfDay, chance } of rates) {
          encounters.push(makeEncounter({ id: dexNum, name: slug, version: ver, method, methodLabel, timeOfDay, min, max, chance }));
        }
      }
    } catch (err) {
      // Skip malformed templates silently
    }
  }
  return encounters;
}

const SWSH_WEATHER_KEYS = ["clear", "cloudy", "rain", "thunderstorm", "snow", "blizzard", "sandstorm", "sun", "fog"];

/**
 * Parse all catch/entry8 templates from wikitext.
 */
function parseSWSHEncounters(wikitext) {
  const encounters = [];
  const re = /\{\{[Cc]atch\/entry8([\s\S]*?)\}\}/g;
  let m;
  while ((m = re.exec(wikitext)) !== null) {
    try {
      const { positional, named } = parseTemplateParams("entry8" + m[1]);
      // positional[0]=dex, [1]=name, [2]=sword, [3]=shield, [4]=method, [5]=level
      // positional[6] may be a plain rate; OR named weather params
      const dexNum    = parseInt(positional[0], 10);
      const rawName   = positional[1] ?? "";
      const inSword   = (positional[2] ?? "").toLowerCase() !== "no";
      const inShield  = (positional[3] ?? "").toLowerCase() !== "no";
      const rawMethod = positional[4] ?? "Grass";
      const rawLevel  = positional[5] ?? "1";

      if (!inSword && !inShield) continue;

      const slug = dexToSlug.get(dexNum) ?? nameToSlug(rawName);
      if (!slug) continue;

      const { method, methodLabel } = resolveMethod(rawMethod, SWSH_METHODS);
      const { min, max } = parseLevel(rawLevel);

      const versions = [];
      if (inSword)  versions.push("sword");
      if (inShield) versions.push("shield");

      // Check for weather-named params first
      const weatherRates = [];
      for (const w of SWSH_WEATHER_KEYS) {
        if (named[w]) {
          const r = parseRate(named[w]);
          if (r !== null) weatherRates.push({ timeOfDay: w, chance: r });
        }
      }

      let rates;
      if (weatherRates.length > 0) {
        rates = weatherRates;
      } else {
        // Plain positional rate
        const r = parseRate(positional[6]);
        if (r === null) continue;
        rates = [{ timeOfDay: "", chance: r }];
      }

      for (const ver of versions) {
        for (const { timeOfDay, chance } of rates) {
          encounters.push(makeEncounter({ id: dexNum, name: slug, version: ver, method, methodLabel, timeOfDay, min, max, chance }));
        }
      }
    } catch (err) {
      // Skip malformed templates
    }
  }
  return encounters;
}

// ─── Bulbapedia API helpers ────────────────────────────────────────────────────

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cachePathFor(title) {
  const safe = title.replace(/[/\\:*?"<>|]/g, "_");
  return join(CACHE_DIR, safe + ".txt");
}

async function fetchWikitext(title) {
  const cachePath = cachePathFor(title);
  if (!FORCE && existsSync(cachePath)) {
    return readFileSync(cachePath, "utf8");
  }

  const url = `${API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${title}`);
  const json = await res.json();

  if (json.error || !json.parse?.wikitext) {
    writeFileSync(cachePath, ""); // cache as empty to avoid re-fetching
    return "";
  }

  const text = json.parse.wikitext;
  writeFileSync(cachePath, text, "utf8");
  return text;
}

/**
 * Fetch all members of a Bulbapedia category (handles pagination).
 */
async function fetchCategoryMembers(category) {
  const members = [];
  let cont = "";
  do {
    const url = `${API}?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(category)}&cmlimit=500&cmtype=page&format=json&formatversion=2${cont ? `&cmcontinue=${cont}` : ""}`;
    const res  = await fetch(url);
    const json = await res.json();
    for (const m of json.query?.categorymembers ?? []) members.push(m.title);
    cont = json.continue?.cmcontinue ?? "";
    if (cont) await sleep(DELAY_MS);
  } while (cont);
  return members;
}

// ─── Main scraping logic ───────────────────────────────────────────────────────

const GAMES = [
  {
    value:    "brilliant-diamond-shining-pearl",
    category: "Sinnoh locations",
    parse:    parseBDSPEncounters,
    marker:   "entrybdsp",   // used to quickly detect if a page has relevant templates
  },
  {
    value:    "sword-shield",
    category: "Galar locations",
    parse:    parseSWSHEncounters,
    marker:   "entry8",
  },
];

async function scrapeGame(game) {
  console.log(`\n=== ${game.value} ===`);
  console.log(`Fetching category: ${game.category}`);

  const titles = await fetchCategoryMembers(game.category);
  console.log(`Found ${titles.length} pages in category`);

  const locations = [];
  let skipped = 0;

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    process.stdout.write(`[${i + 1}/${titles.length}] ${title} … `);

    await sleep(DELAY_MS);

    let wikitext;
    try {
      wikitext = await fetchWikitext(title);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      continue;
    }

    // Quick check: does this page have any relevant templates?
    if (!wikitext || !wikitext.toLowerCase().includes(game.marker)) {
      process.stdout.write("(no encounter data)\n");
      skipped++;
      continue;
    }

    const encounters = game.parse(wikitext);
    if (encounters.length === 0) {
      process.stdout.write("(0 encounters parsed)\n");
      skipped++;
      continue;
    }

    const key   = pageToKey(title);
    const label = title
      .replace(/\(.*?\)/g, "")    // remove parentheticals like "(Sinnoh)"
      .replace(/Sinnoh\s+/g, "")  // strip "Sinnoh " prefix from route names
      .trim();

    locations.push({ key, label, encounters });
    console.log(`✓ ${encounters.length} encounters`);
  }

  // Apply manual location ordering if available, else alphabetical
  const manualOrderPath = join(__dirname, "location-order-manual.json");
  const manualOrderData = existsSync(manualOrderPath)
    ? JSON.parse(readFileSync(manualOrderPath, "utf8"))
    : {};
  const manualOrder = manualOrderData[game.value] ?? [];
  const manualIndex = new Map(manualOrder.map((k, i) => [k, i]));
  locations.sort((a, b) => {
    const aIdx = manualIndex.get(a.key) ?? 9999;
    const bIdx = manualIndex.get(b.key) ?? 9999;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.label.localeCompare(b.label);
  });

  console.log(`\nWriting ${locations.length} locations (${skipped} pages skipped)`);
  const out = { locations };
  const outPath = join(OUT_DIR, `${game.value}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  for (const game of GAMES) {
    await scrapeGame(game);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
