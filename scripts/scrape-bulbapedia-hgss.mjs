#!/usr/bin/env node
/**
 * Scrapes HeartGold/SoulSilver encounter data from Bulbapedia and produces
 * public/data/route-data/heartgold-soulsilver.json.
 *
 * Usage:
 *   node scripts/scrape-bulbapedia-hgss.mjs             # fetch missing + parse all cached
 *   node scripts/scrape-bulbapedia-hgss.mjs --force     # re-fetch every page (ignore cache)
 *   node scripts/scrape-bulbapedia-hgss.mjs --parse-only  # only re-parse, no network
 *
 * Raw wikitext pages are cached in scripts/bulbapedia-cache/hgss/ so subsequent
 * runs are fast and don't hammer Bulbapedia.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR   = join(__dirname, "bulbapedia-cache", "hgss");
const DATA_DIR    = join(__dirname, "..", "public", "data");
const OUT_FILE    = join(DATA_DIR, "route-data", "heartgold-soulsilver.json");
const ORDER_FILE  = join(__dirname, "location-order-manual.json");
const BULBA_API   = "https://bulbapedia.bulbagarden.net/w/api.php";
const RATE_MS     = 650; // ms between Bulbapedia requests

const args        = process.argv.slice(2);
const FORCE       = args.includes("--force");
const PARSE_ONLY  = args.includes("--parse-only");

mkdirSync(CACHE_DIR, { recursive: true });

// ── Sleep helper ────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

// ── Pokémon id → PokéAPI slug ───────────────────────────────────────────────

const pokemonList = JSON.parse(readFileSync(join(DATA_DIR, "pokemon.json"), "utf8"));
const idToName = new Map();
for (const e of pokemonList.results) {
  const m = e.url.match(/\/(\d+)\/?$/);
  if (m) idToName.set(parseInt(m[1]), e.name);
}

// ── Held items ──────────────────────────────────────────────────────────────

const heldItemsPath = join(DATA_DIR, "held-items.json");
const heldItems = existsSync(heldItemsPath)
  ? JSON.parse(readFileSync(heldItemsPath, "utf8"))
  : {};

// ── Method table ────────────────────────────────────────────────────────────
// Maps Bulbapedia method strings to our internal method keys + display labels.

const METHOD_MAP = {
  "Grass":      { method: "walk",          label: "Grass"        },
  "Cave":       { method: "cave",          label: "Cave"         },
  "Sand":       { method: "sand",          label: "Sand"         },
  "Surf":       { method: "surf",          label: "Surfing"      },
  "Fish Old":   { method: "old-rod",       label: "Old Rod"      },
  "Fish Good":  { method: "good-rod",      label: "Good Rod"     },
  "Fish Super": { method: "super-rod",     label: "Super Rod"    },
  "Rock Smash": { method: "rock-smash",    label: "Rock Smash"   },
  "Headbutt":   { method: "headbutt",      label: "Headbutt"     }, // overridden by div context
  "Hoenn":      { method: "hoenn-sound",   label: "Hoenn Sound"  },
  "Sinnoh":     { method: "sinnoh-sound",  label: "Sinnoh Sound" },
  "Swarm":      { method: "swarm",         label: "Swarm"        },
};

// ── Template parsing ────────────────────────────────────────────────────────

function parsePercent(s) {
  const m = (s ?? "").trim().match(/^(\d+)%?$/);
  return m ? parseInt(m[1]) : 0;
}

function parseLevels(s) {
  s = (s ?? "").trim();
  const range  = s.match(/^(\d+)-(\d+)$/);
  if (range)  return { minLevel: parseInt(range[1]),  maxLevel: parseInt(range[2]) };
  const single = s.match(/^(\d+)$/);
  if (single) return { minLevel: parseInt(single[1]), maxLevel: parseInt(single[1]) };
  // "2, 4" or "2,4" — keep as min/max range
  const parts = s.split(/[,\s]+/).map(Number).filter(n => n > 0);
  if (parts.length) return { minLevel: Math.min(...parts), maxLevel: Math.max(...parts) };
  return { minLevel: 1, maxLevel: 1 };
}

/**
 * Parse a single {{Catch/entryhs|...}} template body.
 * headbuttCtx is { method, label } when we're inside a headbutt group div, else null.
 * Returns zero or more encounter rows (one per version × time slot).
 */
function parseEntryhs(body, headbuttCtx) {
  const pos = [];
  const named = {};
  for (const part of body.split("|").map(s => s.trim())) {
    const eq = part.indexOf("=");
    if (eq !== -1) {
      named[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
    } else if (part) {
      pos.push(part);
    }
  }

  // pos: [0]=id [1]=name [2]=hg [3]=ss [4]=method [5]=levels
  //      [6]=morning%  [7]=day%  [8]=night%  (if no "all" param)
  if (pos.length < 6) return [];

  const id      = parseInt(pos[0]);
  const hgYes   = pos[2]?.toLowerCase() === "yes";
  const ssYes   = pos[3]?.toLowerCase() === "yes";
  const methodStr = pos[4];
  const levelStr  = pos[5];

  if (isNaN(id) || (!hgYes && !ssYes)) return [];

  const name = idToName.get(id);
  if (!name) return [];

  const levels = parseLevels(levelStr);

  // Resolve method
  let methodInfo = METHOD_MAP[methodStr] ?? {
    method: methodStr.toLowerCase().replace(/\s+/g, "-"),
    label:  methodStr,
  };
  if (methodStr === "Headbutt" && headbuttCtx) {
    methodInfo = headbuttCtx;
  }

  const versions = [
    ...(hgYes ? ["heartgold"]  : []),
    ...(ssYes ? ["soulsilver"] : []),
  ];

  const results = [];

  if (named["all"] !== undefined) {
    // No time split
    const chance = parsePercent(named["all"]);
    if (chance === 0) return [];
    for (const version of versions) {
      results.push({
        id, name, version,
        method: methodInfo.method, methodLabel: methodInfo.label,
        timeOfDay: "", ...levels, chance,
        heldItems: heldItems[String(id)]?.[version] ?? [],
      });
    }
  } else {
    // Time-split
    const slots = [
      { timeOfDay: "morning", chance: parsePercent(pos[6]) },
      { timeOfDay: "day",     chance: parsePercent(pos[7]) },
      { timeOfDay: "night",   chance: parsePercent(pos[8]) },
    ].filter(s => s.chance > 0);

    if (slots.length === 0) return [];

    for (const version of versions) {
      const hi = heldItems[String(id)]?.[version] ?? [];
      for (const { timeOfDay, chance } of slots) {
        results.push({
          id, name, version,
          method: methodInfo.method, methodLabel: methodInfo.label,
          timeOfDay, ...levels, chance,
          heldItems: hi,
        });
      }
    }
  }

  return results;
}

/**
 * Extract all encounters from a page's wikitext.
 * All floors/sections within one Bulbapedia page are merged into a single
 * location (one page = one location key).
 */
function parsePageEncounters(wikitext) {
  const encounters = [];
  let headbuttCtx = null;

  for (const rawLine of wikitext.split("\n")) {
    const line = rawLine.trim();

    const lineLower = line.toLowerCase();

    // Track headbutt group context via Catch/div
    if (lineLower.startsWith("{{catch/div|")) {
      const body = line.slice(line.indexOf("|") + 1).replace(/\}\}$/, "");
      // Second pipe-separated segment is the label
      const labelRaw = body.split("|").slice(1).join("|");
      // Strip wiki markup to plain text
      const label = labelRaw
        .replace(/\{\{[^}]*\}\}/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (/headbutt/i.test(label)) {
        if      (/group\s*a/i.test(label)) headbuttCtx = { method: "headbutt-a", label: "Headbutt (Group A)" };
        else if (/group\s*b/i.test(label)) headbuttCtx = { method: "headbutt-b", label: "Headbutt (Group B)" };
        else                               headbuttCtx = { method: "headbutt",   label: "Headbutt"           };
      } else {
        headbuttCtx = null;
      }
      continue;
    }

    // Reset context at table footer
    if (lineLower.startsWith("{{catch/footer|")) {
      headbuttCtx = null;
      continue;
    }

    // Parse HGSS encounter entry
    if (lineLower.startsWith("{{catch/entryhs|")) {
      const body = line.slice(line.indexOf("|") + 1).replace(/\}\}$/, "");
      encounters.push(...parseEntryhs(body, headbuttCtx));
    }
  }

  return encounters;
}

// ── Page title → location key ───────────────────────────────────────────────

function pageToKey(title) {
  return title
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents  (é→e)
    .replace(/['']/g, "")                              // strip apostrophes
    .replace(/[^a-zA-Z0-9\s-]/g, "")                  // strip remaining non-alphanum
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

// Best-effort mapping from old PokéAPI-derived keys to new Bulbapedia keys
// so that existing location ordering is preserved.
function oldKeyToNew(oldKey) {
  return oldKey
    .replace(/-area$/, "")           // "johto-route-29-area" → "johto-route-29"
    .replace(/-\d+[fF]$/, "")        // "sprout-tower-2f"    → "sprout-tower"
    .replace(/-b\d+[fF]$/, "")       // "slowpoke-well-b1f"  → "slowpoke-well"
    .replace(/-(?:outside|entrance|interior-[a-z]|base)$/, ""); // ruins-of-alph-outside → ruins-of-alph
}

// ── Step 1: Get category page list ─────────────────────────────────────────

async function getCategoryPages() {
  const cacheFile = join(CACHE_DIR, "__pages.json");
  if (!FORCE && existsSync(cacheFile)) {
    const list = JSON.parse(readFileSync(cacheFile, "utf8"));
    console.log(`  Loaded ${list.length} page titles from cache.`);
    return list;
  }
  if (PARSE_ONLY) {
    if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, "utf8"));
    console.error("No page list cache — run without --parse-only first.");
    process.exit(1);
  }

  console.log("  Fetching category members from Bulbapedia...");
  const pages = [];
  let continueToken = null;
  do {
    const params = new URLSearchParams({
      action: "query", list: "categorymembers",
      cmtitle: "Category:HeartGold_and_SoulSilver_locations",
      cmlimit: "500", cmtype: "page", format: "json",
    });
    if (continueToken) params.set("cmcontinue", continueToken);

    const data = await fetchJson(`${BULBA_API}?${params}`);
    pages.push(...data.query.categorymembers.map(p => p.title));
    continueToken = data["query-continue"]?.categorymembers?.cmcontinue
                 ?? data.continue?.cmcontinue
                 ?? null;
    if (continueToken) await sleep(RATE_MS);
  } while (continueToken);

  writeFileSync(cacheFile, JSON.stringify(pages));
  console.log(`  Found ${pages.length} pages.`);
  return pages;
}

// ── Step 2: Fetch / load page wikitext ─────────────────────────────────────

async function fetchWikitext(title) {
  const safe = title.replace(/\//g, "_").replace(/\s/g, "_");
  const cacheFile = join(CACHE_DIR, `${safe}.json`);

  if (!FORCE && existsSync(cacheFile)) {
    return JSON.parse(readFileSync(cacheFile, "utf8")).wikitext;
  }
  if (PARSE_ONLY) {
    return existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, "utf8")).wikitext : null;
  }

  await sleep(RATE_MS);
  const params = new URLSearchParams({
    action: "parse", page: title, prop: "wikitext", format: "json",
  });
  const data = await fetchJson(`${BULBA_API}?${params}`);
  const wikitext = data.parse?.wikitext?.["*"] ?? "";
  writeFileSync(cacheFile, JSON.stringify({ title, wikitext }, null, 0));
  return wikitext;
}

// ── Step 3: Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Bulbapedia HGSS scraper ===\n");

  const pages = await getCategoryPages();

  // Parse every page
  const locationMap = new Map(); // key → { label, encounters[] }
  let fetched = 0, skipped = 0;

  // Filter out user/talk/file pages
  const locationPages = pages.filter(t => !t.startsWith("User:") && !t.startsWith("Talk:") && !t.startsWith("File:"));

  for (let i = 0; i < locationPages.length; i++) {
    const title = locationPages[i];
    process.stdout.write(`[${String(i + 1).padStart(3)}/${locationPages.length}] ${title} ... `);

    let wikitext;
    try {
      wikitext = await fetchWikitext(title);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      continue;
    }

    if (!wikitext) { console.log("(no cache, skipped)"); skipped++; continue; }

    const encounters = parsePageEncounters(wikitext);
    if (encounters.length === 0) { console.log("(no encounters)"); skipped++; continue; }

    const key = pageToKey(title);
    if (!locationMap.has(key)) locationMap.set(key, { label: title, encounters: [] });
    locationMap.get(key).encounters.push(...encounters);

    console.log(`${encounters.length} encounters`);
    fetched++;
  }

  console.log(`\nParsed ${fetched} locations with encounters (${skipped} skipped).\n`);

  // Sort encounters within each location: method order, then by id
  const METHOD_ORDER = [
    "walk", "cave", "sand",
    "surf", "old-rod", "good-rod", "super-rod",
    "rock-smash",
    "headbutt", "headbutt-a", "headbutt-b",
    "hoenn-sound", "sinnoh-sound",
  ];
  function methodOrd(m) { const i = METHOD_ORDER.indexOf(m); return i === -1 ? 99 : i; }

  const locations = [...locationMap.entries()].map(([key, { label, encounters }]) => ({
    key, label,
    encounters: encounters.sort((a, b) =>
      methodOrd(a.method) - methodOrd(b.method) || a.id - b.id
    ),
  }));

  // Apply manual ordering, migrating old PokéAPI keys to new Bulbapedia keys
  const orderData = JSON.parse(readFileSync(ORDER_FILE, "utf8"));
  const oldOrder  = orderData["heartgold-soulsilver"] ?? [];

  const seen = new Set();
  const newOrder = [];
  for (const oldKey of oldOrder) {
    const newKey = oldKeyToNew(oldKey);
    if (!seen.has(newKey)) { seen.add(newKey); newOrder.push(newKey); }
  }
  for (const key of locationMap.keys()) {
    if (!seen.has(key)) newOrder.push(key);
  }

  const orderIdx = new Map(newOrder.map((k, i) => [k, i]));
  locations.sort((a, b) => {
    const ai = orderIdx.get(a.key) ?? 9999;
    const bi = orderIdx.get(b.key) ?? 9999;
    return ai !== bi ? ai - bi : a.label.localeCompare(b.label);
  });

  // Persist updated ordering (using Bulbapedia keys now)
  orderData["heartgold-soulsilver"] = newOrder.filter(k => locationMap.has(k));
  writeFileSync(ORDER_FILE, JSON.stringify(orderData, null, 2));
  console.log("Updated location-order-manual.json with Bulbapedia keys.");

  writeFileSync(OUT_FILE, JSON.stringify({ locations }, null, 0));
  console.log(`Wrote ${locations.length} locations → ${OUT_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });
