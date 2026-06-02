#!/usr/bin/env node
/**
 * Scrapes gym leader / Elite Four / Champion team data from Bulbapedia
 * and writes structured JSON to public/data/trainers/{gameGroup}.json.
 *
 * Usage:
 *   node scripts/scrape-trainer-data.mjs             # fetch all Gen 1-4
 *   node scripts/scrape-trainer-data.mjs --force     # ignore cache, re-fetch
 *
 * Caches raw wikitext in .cache/bulbapedia/ to avoid hammering the API.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, "..", "public", "data", "trainers");
const CACHE_DIR = join(__dirname, "..", ".cache", "bulbapedia");
const FORCE     = process.argv.includes("--force");

mkdirSync(OUT_DIR,   { recursive: true });
mkdirSync(CACHE_DIR, { recursive: true });

// ── Bulbapedia game codes → our game-group keys ───────────────────────────────
const CODE_TO_GROUPS = {
  "RGB":  ["red-blue-yellow"],
  "RB":   ["red-blue-yellow"],
  "Y":    ["red-blue-yellow"],
  "FRLG": ["firered-leafgreen"],
  "GSC":  ["gold-silver-crystal"],
  "HGSS": ["heartgold-soulsilver"],
  "RS":   ["ruby-sapphire-emerald"],
  "RSE":  ["ruby-sapphire-emerald"],
  "E":    ["ruby-sapphire-emerald"],
  "DP":   ["diamond-pearl-platinum"],
  "DPPt": ["diamond-pearl-platinum"],
  "Pt":   ["diamond-pearl-platinum"],
};

// ── Trainer catalogue ─────────────────────────────────────────────────────────
// page      : Bulbapedia article title
// slug      : our stable ID (used in JSON)
// class     : "Gym Leader" | "Elite Four" | "Champion"
// badgeId   : matches Badge.id in GAME_BADGES (null for E4/Champion)
// order     : sort order within the game (determines progression)
// gameCodes : which Bulbapedia game codes to extract for this entry

const GAME_CONFIG = {
  "red-blue-yellow": {
    gameCodes: ["RGB", "RB", "Y"],
    trainers: [
      { page: "Brock",       slug: "brock",     class: "Gym Leader", badgeId: "boulder", order: 1  },
      { page: "Misty",       slug: "misty",     class: "Gym Leader", badgeId: "cascade", order: 2  },
      { page: "Lt. Surge",   slug: "lt-surge",  class: "Gym Leader", badgeId: "thunder", order: 3  },
      { page: "Erika",       slug: "erika",     class: "Gym Leader", badgeId: "rainbow", order: 4  },
      { page: "Koga",        slug: "koga",      class: "Gym Leader", badgeId: "soul",    order: 5  },
      { page: "Sabrina",     slug: "sabrina",   class: "Gym Leader", badgeId: "marsh",   order: 6  },
      { page: "Blaine",      slug: "blaine",    class: "Gym Leader", badgeId: "volcano", order: 7  },
      { page: "Giovanni",    slug: "giovanni",  class: "Gym Leader", badgeId: "earth",   order: 8  },
      { page: "Lorelei",     slug: "lorelei",   class: "Elite Four", badgeId: null,      order: 9  },
      { page: "Bruno",       slug: "bruno",     class: "Elite Four", badgeId: null,      order: 10 },
      { page: "Agatha",      slug: "agatha",    class: "Elite Four", badgeId: null,      order: 11 },
      { page: "Lance",       slug: "lance",     class: "Elite Four", badgeId: null,      order: 12 },
      { page: "Blue (game)", slug: "blue",      class: "Champion",   badgeId: null,      order: 13 },
    ],
  },
  "firered-leafgreen": {
    gameCodes: ["FRLG"],
    trainers: [
      { page: "Brock",       slug: "brock",     class: "Gym Leader", badgeId: "boulder", order: 1  },
      { page: "Misty",       slug: "misty",     class: "Gym Leader", badgeId: "cascade", order: 2  },
      { page: "Lt. Surge",   slug: "lt-surge",  class: "Gym Leader", badgeId: "thunder", order: 3  },
      { page: "Erika",       slug: "erika",     class: "Gym Leader", badgeId: "rainbow", order: 4  },
      { page: "Koga",        slug: "koga",      class: "Gym Leader", badgeId: "soul",    order: 5  },
      { page: "Sabrina",     slug: "sabrina",   class: "Gym Leader", badgeId: "marsh",   order: 6  },
      { page: "Blaine",      slug: "blaine",    class: "Gym Leader", badgeId: "volcano", order: 7  },
      { page: "Giovanni",    slug: "giovanni",  class: "Gym Leader", badgeId: "earth",   order: 8  },
      { page: "Lorelei",     slug: "lorelei",   class: "Elite Four", badgeId: null,      order: 9  },
      { page: "Bruno",       slug: "bruno",     class: "Elite Four", badgeId: null,      order: 10 },
      { page: "Agatha",      slug: "agatha",    class: "Elite Four", badgeId: null,      order: 11 },
      { page: "Lance",       slug: "lance",     class: "Elite Four", badgeId: null,      order: 12 },
      { page: "Blue (game)", slug: "blue",      class: "Champion",   badgeId: null,      order: 13 },
    ],
  },
  "gold-silver-crystal": {
    gameCodes: ["GSC"],
    trainers: [
      { page: "Falkner",  slug: "falkner",  class: "Gym Leader", badgeId: "zephyr",  order: 1  },
      { page: "Bugsy",    slug: "bugsy",    class: "Gym Leader", badgeId: "hive",    order: 2  },
      { page: "Whitney",  slug: "whitney",  class: "Gym Leader", badgeId: "plain",   order: 3  },
      { page: "Morty",    slug: "morty",    class: "Gym Leader", badgeId: "fog",     order: 4  },
      { page: "Chuck",    slug: "chuck",    class: "Gym Leader", badgeId: "storm",   order: 5  },
      { page: "Jasmine",  slug: "jasmine",  class: "Gym Leader", badgeId: "mineral", order: 6  },
      { page: "Pryce",    slug: "pryce",    class: "Gym Leader", badgeId: "glacier", order: 7  },
      { page: "Clair",    slug: "clair",    class: "Gym Leader", badgeId: "rising",  order: 8  },
      { page: "Will",     slug: "will",     class: "Elite Four", badgeId: null,      order: 9  },
      { page: "Koga",     slug: "koga",     class: "Elite Four", badgeId: null,      order: 10 },
      { page: "Bruno",    slug: "bruno",    class: "Elite Four", badgeId: null,      order: 11 },
      { page: "Karen",    slug: "karen",    class: "Elite Four", badgeId: null,      order: 12 },
      { page: "Lance",    slug: "lance",    class: "Champion",   badgeId: null,      order: 13 },
      { page: "Brock",    slug: "brock",    class: "Gym Leader", badgeId: "boulder", order: 14 },
      { page: "Misty",    slug: "misty",    class: "Gym Leader", badgeId: "cascade", order: 15 },
      { page: "Lt. Surge",slug: "lt-surge", class: "Gym Leader", badgeId: "thunder", order: 16 },
      { page: "Erika",    slug: "erika",    class: "Gym Leader", badgeId: "rainbow", order: 17 },
      { page: "Janine",   slug: "janine",   class: "Gym Leader", badgeId: "soul",    order: 18 },
      { page: "Sabrina",  slug: "sabrina",  class: "Gym Leader", badgeId: "marsh",   order: 19 },
      { page: "Blaine",   slug: "blaine",   class: "Gym Leader", badgeId: "volcano", order: 20 },
      { page: "Blue (game)", slug: "blue",  class: "Gym Leader", badgeId: "earth",   order: 21 },
      { page: "Red (game)",  slug: "red",   class: "Champion",   badgeId: null,      order: 22 },
    ],
  },
  "heartgold-soulsilver": {
    gameCodes: ["HGSS"],
    trainers: [
      { page: "Falkner",  slug: "falkner",  class: "Gym Leader", badgeId: "zephyr",  order: 1  },
      { page: "Bugsy",    slug: "bugsy",    class: "Gym Leader", badgeId: "hive",    order: 2  },
      { page: "Whitney",  slug: "whitney",  class: "Gym Leader", badgeId: "plain",   order: 3  },
      { page: "Morty",    slug: "morty",    class: "Gym Leader", badgeId: "fog",     order: 4  },
      { page: "Chuck",    slug: "chuck",    class: "Gym Leader", badgeId: "storm",   order: 5  },
      { page: "Jasmine",  slug: "jasmine",  class: "Gym Leader", badgeId: "mineral", order: 6  },
      { page: "Pryce",    slug: "pryce",    class: "Gym Leader", badgeId: "glacier", order: 7  },
      { page: "Clair",    slug: "clair",    class: "Gym Leader", badgeId: "rising",  order: 8  },
      { page: "Will",     slug: "will",     class: "Elite Four", badgeId: null,      order: 9  },
      { page: "Koga",     slug: "koga",     class: "Elite Four", badgeId: null,      order: 10 },
      { page: "Bruno",    slug: "bruno",    class: "Elite Four", badgeId: null,      order: 11 },
      { page: "Karen",    slug: "karen",    class: "Elite Four", badgeId: null,      order: 12 },
      { page: "Lance",    slug: "lance",    class: "Champion",   badgeId: null,      order: 13 },
      { page: "Brock",    slug: "brock",    class: "Gym Leader", badgeId: "boulder", order: 14 },
      { page: "Misty",    slug: "misty",    class: "Gym Leader", badgeId: "cascade", order: 15 },
      { page: "Lt. Surge",slug: "lt-surge", class: "Gym Leader", badgeId: "thunder", order: 16 },
      { page: "Erika",    slug: "erika",    class: "Gym Leader", badgeId: "rainbow", order: 17 },
      { page: "Janine",   slug: "janine",   class: "Gym Leader", badgeId: "soul",    order: 18 },
      { page: "Sabrina",  slug: "sabrina",  class: "Gym Leader", badgeId: "marsh",   order: 19 },
      { page: "Blaine",   slug: "blaine",   class: "Gym Leader", badgeId: "volcano", order: 20 },
      { page: "Blue (game)", slug: "blue",  class: "Gym Leader", badgeId: "earth",   order: 21 },
      { page: "Red (game)",  slug: "red",   class: "Champion",   badgeId: null,      order: 22 },
    ],
  },
  "ruby-sapphire-emerald": {
    gameCodes: ["RS", "RSE", "E"],
    trainers: [
      { page: "Roxanne",       slug: "roxanne",      class: "Gym Leader", badgeId: "stone",   order: 1  },
      { page: "Brawly",        slug: "brawly",       class: "Gym Leader", badgeId: "knuckle", order: 2  },
      { page: "Wattson",       slug: "wattson",      class: "Gym Leader", badgeId: "dynamo",  order: 3  },
      { page: "Flannery",      slug: "flannery",     class: "Gym Leader", badgeId: "heat",    order: 4  },
      { page: "Norman",        slug: "norman",       class: "Gym Leader", badgeId: "balance", order: 5  },
      { page: "Winona",        slug: "winona",       class: "Gym Leader", badgeId: "feather", order: 6  },
      { page: "Tate and Liza", slug: "tate-liza",    class: "Gym Leader", badgeId: "mind",    order: 7  },
      { page: "Wallace",       slug: "wallace",      class: "Gym Leader", badgeId: "rain",    order: 8  },
      { page: "Sidney",        slug: "sidney",       class: "Elite Four", badgeId: null,      order: 9  },
      { page: "Phoebe",        slug: "phoebe",       class: "Elite Four", badgeId: null,      order: 10 },
      { page: "Glacia",        slug: "glacia",       class: "Elite Four", badgeId: null,      order: 11 },
      { page: "Drake",         slug: "drake",        class: "Elite Four", badgeId: null,      order: 12 },
      { page: "Steven Stone",  slug: "steven",       class: "Champion",   badgeId: null,      order: 13 },
    ],
  },
  "diamond-pearl-platinum": {
    gameCodes: ["DP", "DPPt", "Pt"],
    trainers: [
      { page: "Roark",         slug: "roark",        class: "Gym Leader", badgeId: "coal",    order: 1  },
      { page: "Gardenia",      slug: "gardenia",     class: "Gym Leader", badgeId: "forest",  order: 2  },
      { page: "Maylene",       slug: "maylene",      class: "Gym Leader", badgeId: "cobble",  order: 3  },
      { page: "Crasher Wake",  slug: "crasher-wake", class: "Gym Leader", badgeId: "fen",     order: 4  },
      { page: "Fantina",       slug: "fantina",      class: "Gym Leader", badgeId: "relic",   order: 5  },
      { page: "Byron",         slug: "byron",        class: "Gym Leader", badgeId: "mine",    order: 6  },
      { page: "Candice",       slug: "candice",      class: "Gym Leader", badgeId: "icicle",  order: 7  },
      { page: "Volkner",       slug: "volkner",      class: "Gym Leader", badgeId: "beacon",  order: 8  },
      { page: "Aaron",         slug: "aaron",        class: "Elite Four", badgeId: null,      order: 9  },
      { page: "Bertha",        slug: "bertha",       class: "Elite Four", badgeId: null,      order: 10 },
      { page: "Flint",         slug: "flint",        class: "Elite Four", badgeId: null,      order: 11 },
      { page: "Lucian",        slug: "lucian",       class: "Elite Four", badgeId: null,      order: 12 },
      { page: "Cynthia",       slug: "cynthia",      class: "Champion",   badgeId: null,      order: 13 },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a Bulbapedia display name to a PokéAPI-style slug. */
function toSlug(name) {
  if (!name) return "";
  return name
    .trim()
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m")
    .replace(/['']/g, "")        // Farfetch'd, Sirfetch'd
    .replace(/\.\s*/g, "-")      // Mr. Mime → mr--mime (cleaned below)
    .replace(/[^a-z0-9\-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** Strip wiki markup from a field value to get plain text. */
function stripWiki(s) {
  if (!s) return "";
  return s
    .replace(/\{\{[^}]*\}\}/g, "")   // remove {{templates}}
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2")  // [[link|text]] → text
    .replace(/'{2,}/g, "")            // bold/italic
    .trim();
}

/** Sleep to be respectful to the API. */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Fetch wikitext for a Bulbapedia page, using cache if available. */
async function fetchWikitext(page) {
  const cacheFile = join(CACHE_DIR, encodeURIComponent(page) + ".txt");
  if (!FORCE && existsSync(cacheFile)) {
    return readFileSync(cacheFile, "utf8");
  }
  const url = `https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&redirects=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "porylist-data-scraper/1.0 (https://porylist.com; educational fan site)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${page}`);
  const json = await res.json();
  const wikitext = json?.parse?.wikitext?.["*"];
  if (!wikitext) throw new Error(`No wikitext returned for ${page}`);
  writeFileSync(cacheFile, wikitext, "utf8");
  await sleep(600); // be polite
  return wikitext;
}

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Extract all key=value pairs from a template body string.
 * Handles the `| key = value | key2 = value2` format on multiple lines.
 */
function parseTemplateArgs(body) {
  const args = {};
  // Split on pipe that starts a new argument (preceded by newline or start)
  const lines = body.split(/\n/);
  let current = null;
  for (const line of lines) {
    const m = line.match(/^\|\s*([^=|]+?)\s*=\s*(.*)/);
    if (m) {
      current = m[1].trim().toLowerCase();
      args[current] = m[2];
      // Inline pipes: | move1 = Tackle | move1type = Normal
      const rest = m[2];
      const inlinePipes = rest.split(/\s*\|\s*([^=|]+?)\s*=\s*/);
      if (inlinePipes.length > 1) {
        args[current] = inlinePipes[0];
        for (let i = 1; i < inlinePipes.length - 1; i += 2) {
          args[inlinePipes[i].trim().toLowerCase()] = inlinePipes[i + 1] ?? "";
        }
      }
    } else if (current && line.trim() && !line.startsWith("{{") && !line.startsWith("}}")) {
      args[current] += " " + line.trim();
    }
  }
  return args;
}

/**
 * Extract all top-level template blocks of a given name from wikitext.
 * Returns array of body strings (contents between {{ and }}).
 */
function extractTemplates(wikitext, templateName) {
  const results = [];
  const startTag = `{{${templateName}`;
  let i = 0;
  while (i < wikitext.length) {
    const start = wikitext.indexOf(startTag, i);
    if (start === -1) break;
    // Track nesting depth
    let depth = 0;
    let j = start;
    while (j < wikitext.length) {
      if (wikitext[j] === "{" && wikitext[j + 1] === "{") { depth++; j += 2; }
      else if (wikitext[j] === "}" && wikitext[j + 1] === "}") {
        depth--;
        if (depth === 0) { results.push(wikitext.slice(start, j + 2)); j += 2; break; }
        j += 2;
      } else { j++; }
    }
    i = j;
  }
  return results;
}

/**
 * Parse a single {{Pokémon ...}} template block into a structured object.
 */
function parsePokemonTemplate(block) {
  const body = block.replace(/^\{\{Pok[eé]mon\b/i, "").replace(/\}\}$/, "");
  const args = parseTemplateArgs(body);

  const name = stripWiki(args["pokemon"] || args["pkmn"] || "");
  if (!name) return null;

  const moves = [];
  for (let n = 1; n <= 4; n++) {
    const move = stripWiki(args[`move${n}`]);
    const moveType = stripWiki(args[`move${n}type`] || "").toLowerCase() || null;
    if (move) moves.push({ name: toSlug(move), type: moveType });
  }

  const heldRaw = stripWiki(args["held"] || args["item"] || "");

  return {
    species: toSlug(name),
    ndex: parseInt(args["ndex"] || "0", 10) || null,
    level: parseInt(args["level"] || args["lv"] || "0", 10) || null,
    ability: toSlug(stripWiki(args["ability"] || "")) || null,
    heldItem: heldRaw ? toSlug(heldRaw) : null,
    moves,
  };
}

/**
 * Given the full wikitext of a trainer page and a set of target game codes,
 * find the best matching {{Party}} block and return the parsed team.
 * "Best" = most Pokémon (prefers champion/full battles over scripted 1-mon fights).
 */
function extractTeamForGameCodes(wikitext, targetCodes) {
  const codeSet = new Set(targetCodes.map(c => c.toUpperCase()));
  const candidates = [];

  // Split on {{Party/end}} to get candidate blocks
  const segments = wikitext.split(/\{\{Party\/end\}\}/i);

  for (const segment of segments) {
    // Find the {{Party header within this segment
    const partyStart = segment.search(/\{\{Party\b/i);
    if (partyStart === -1) continue;

    // Extract just the Party header (up to the first {{Pokémon or end of Party args)
    const afterParty = segment.slice(partyStart + 2); // skip {{
    const headerEnd = afterParty.search(/\{\{Pok[eé]mon\b/i);
    const headerBody = headerEnd === -1 ? afterParty : afterParty.slice(0, headerEnd);
    const headerArgs = parseTemplateArgs(headerBody);

    const gameCode = (headerArgs["game"] || "").trim().toUpperCase();
    if (!codeSet.has(gameCode)) continue;

    const location = (headerArgs["location"] || "").toLowerCase();

    // Extract all Pokémon templates from this segment
    const pokemonBlocks = extractTemplates(segment, "Pokémon");
    const fallbackBlocks = pokemonBlocks.length === 0
      ? extractTemplates(segment, "Pokemon")
      : [];

    const team = [...pokemonBlocks, ...fallbackBlocks]
      .map(parsePokemonTemplate)
      .filter(Boolean);

    if (team.length > 0) candidates.push({ team, location });
  }

  if (candidates.length === 0) return null;

  // Prefer the canonical gym battle (location contains "gym") over rematches/dojos.
  // If no gym-location candidate exists (E4, Champion), fall back to the first candidate.
  const gymCandidates = candidates.filter(c => c.location.includes("gym"));
  if (gymCandidates.length > 0) return gymCandidates[0].team;
  return candidates[0].team;
}

// ── Main ──────────────────────────────────────────────────────────────────────

for (const [gameGroup, config] of Object.entries(GAME_CONFIG)) {
  console.log(`\n── ${gameGroup} ─────────────────────────────`);

  // Deduplicate pages to fetch (multiple game groups may share pages like Brock)
  const pagesSeen = new Set();
  const wikitextCache = new Map();

  // Pre-fetch all unique pages for this game group
  for (const trainer of config.trainers) {
    if (pagesSeen.has(trainer.page)) continue;
    pagesSeen.add(trainer.page);
    process.stdout.write(`  Fetching ${trainer.page}...`);
    try {
      const wikitext = await fetchWikitext(trainer.page);
      wikitextCache.set(trainer.page, wikitext);
      console.log(" ✓");
    } catch (e) {
      console.log(` ✗ (${e.message})`);
    }
  }

  // Parse each trainer
  const output = [];
  for (const trainer of config.trainers) {
    const wikitext = wikitextCache.get(trainer.page);
    if (!wikitext) {
      console.log(`  ⚠ Skipping ${trainer.name || trainer.page} — no wikitext`);
      continue;
    }

    const team = extractTeamForGameCodes(wikitext, config.gameCodes);
    if (!team) {
      console.log(`  ⚠ No team found for ${trainer.page} (codes: ${config.gameCodes.join(",")})`);
      continue;
    }

    console.log(`  ✓ ${trainer.page}: ${team.length} Pokémon`);
    output.push({
      slug:     trainer.slug,
      name:     trainer.page.replace(/ \(game\)/, ""),
      class:    trainer.class,
      badgeId:  trainer.badgeId,
      order:    trainer.order,
      team,
    });
  }

  output.sort((a, b) => a.order - b.order);
  const outPath = join(OUT_DIR, `${gameGroup}.json`);
  writeFileSync(outPath, JSON.stringify({ trainers: output }, null, 2));
  console.log(`  → Wrote ${output.length} trainers to ${outPath}`);
}

console.log("\nDone.");
