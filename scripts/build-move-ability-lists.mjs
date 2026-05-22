#!/usr/bin/env node
/**
 * Reads all pre-fetched move/ability JSON files from public/data/move/ and
 * public/data/ability/, then writes compact summary lists to:
 *   public/data/moves.json    – array of MoveListEntry
 *   public/data/abilities.json – array of AbilityListEntry
 *
 * Run: node scripts/build-move-ability-lists.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");

function formatName(name) {
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function substituteChance(text, chance) {
  if (!chance || !text) return text ?? "";
  return text.replace(/\$effect_chance%?/g, `${chance}%`);
}

// ── Generation detection ───────────────────────────────────────────────────────

const MOVE_VG_TO_GEN = {
  "red-blue": 1, "yellow": 1,
  // gold-silver/crystal need ID disambiguation — handled below
  "ruby-sapphire": 3, "emerald": 3, "firered-leafgreen": 3, "colosseum": 3, "xd": 3,
  "diamond-pearl": 4, "platinum": 4, "heartgold-soulsilver": 4,
  "black-white": 5, "black-2-white-2": 5,
  "x-y": 6, "omega-ruby-alpha-sapphire": 6,
  "sun-moon": 7, "ultra-sun-ultra-moon": 7, "lets-go-pikachu-lets-go-eevee": 7,
  "sword-shield": 8, "brilliant-diamond-and-shining-pearl": 8, "legends-arceus": 8,
  "scarlet-violet": 9,
};

function getMoveGenerationId(data) {
  const enEntries = (data.flavor_text_entries ?? []).filter((e) => e.language.name === "en");
  if (enEntries.length === 0) {
    // No flavor text – use ID ranges as fallback
    const id = data.id;
    if (id < 166) return 1;
    if (id < 252) return 2;
    if (id < 355) return 3;
    if (id < 468) return 4;
    if (id < 560) return 5;
    if (id < 622) return 6;
    if (id < 743) return 7;
    if (id < 827) return 8;
    return 9;
  }
  const firstVG = enEntries[0].version_group.name;
  if (firstVG === "gold-silver" || firstVG === "crystal") {
    // Moves ≤ ID 165 are Gen 1; higher IDs with a GSC first entry are Gen 2
    return data.id < 166 ? 1 : 2;
  }
  return MOVE_VG_TO_GEN[firstVG] ?? 9;
}

const ABILITY_VG_TO_GEN = {
  "ruby-sapphire": 3, "emerald": 3, "firered-leafgreen": 3,
  "diamond-pearl": 4, "platinum": 4, "heartgold-soulsilver": 4,
  "black-white": 5, "black-2-white-2": 5,
  "x-y": 6, "omega-ruby-alpha-sapphire": 6,
  "sun-moon": 7, "ultra-sun-ultra-moon": 7, "lets-go-pikachu-lets-go-eevee": 7,
  "sword-shield": 8, "brilliant-diamond-and-shining-pearl": 8, "legends-arceus": 8,
  "scarlet-violet": 9,
};

function getAbilityGenerationId(data) {
  const enEntries = (data.flavor_text_entries ?? []).filter((e) => e.language.name === "en");
  if (enEntries.length === 0) {
    // Fallback to ID ranges
    const id = data.id;
    if (id <= 76) return 3;
    if (id <= 123) return 4;
    if (id <= 163) return 5;
    if (id <= 191) return 6;
    if (id <= 233) return 7;
    if (id <= 267) return 8;
    return 9;
  }
  const firstVG = enEntries[0].version_group.name;
  return ABILITY_VG_TO_GEN[firstVG] ?? 9;
}

// ── Moves ─────────────────────────────────────────────────────────────────────
const moveDir = join(DATA_DIR, "move");
const moves = [];

for (const file of readdirSync(moveDir)) {
  if (!file.endsWith(".json")) continue;
  const data = JSON.parse(readFileSync(join(moveDir, file), "utf8"));
  const enName = data.names?.find((n) => n.language.name === "en")?.name
    ?? formatName(data.name);
  const shortEffect = data.effect_entries?.find((e) => e.language.name === "en")?.short_effect ?? "";
  moves.push({
    id: data.id,
    name: data.name,
    displayName: enName,
    type: data.type?.name ?? "normal",
    category: data.damage_class?.name ?? "status",
    power: data.power ?? null,
    accuracy: data.accuracy ?? null,
    pp: data.pp ?? null,
    effectChance: data.effect_chance ?? null,
    shortEffect: substituteChance(shortEffect, data.effect_chance),
    generationId: getMoveGenerationId(data),
  });
}

moves.sort((a, b) => a.id - b.id);
writeFileSync(join(DATA_DIR, "moves.json"), JSON.stringify(moves));
console.log(`✅ moves.json — ${moves.length} moves`);

// Quick sanity check
const byGen = Array.from({ length: 9 }, (_, i) => moves.filter((m) => m.generationId === i + 1).length);
console.log("   per gen:", byGen.map((n, i) => `G${i + 1}:${n}`).join(" "));

// ── Abilities ─────────────────────────────────────────────────────────────────
const abilityDir = join(DATA_DIR, "ability");
const abilities = [];

for (const file of readdirSync(abilityDir)) {
  if (!file.endsWith(".json")) continue;
  const data = JSON.parse(readFileSync(join(abilityDir, file), "utf8"));
  const enName = data.names?.find((n) => n.language.name === "en")?.name
    ?? formatName(data.name);
  const shortEffect = data.effect_entries?.find((e) => e.language.name === "en")?.short_effect ?? "";
  abilities.push({
    id: data.id,
    name: data.name,
    displayName: enName,
    shortEffect,
    generationId: getAbilityGenerationId(data),
  });
}

abilities.sort((a, b) => a.id - b.id);
writeFileSync(join(DATA_DIR, "abilities.json"), JSON.stringify(abilities));
console.log(`✅ abilities.json — ${abilities.length} abilities`);

const aByGen = Array.from({ length: 9 }, (_, i) => abilities.filter((a) => a.generationId === i + 1).length);
console.log("   per gen:", aByGen.map((n, i) => `G${i + 1}:${n}`).join(" "));

// ── Items ──────────────────────────────────────────────────────────────────────
const ITEM_VG_TO_GEN = {
  "gold-silver": 2, "crystal": 2,
  "ruby-sapphire": 3, "emerald": 3, "firered-leafgreen": 3, "colosseum": 3, "xd": 3,
  "diamond-pearl": 4, "platinum": 4, "heartgold-soulsilver": 4,
  "black-white": 5, "black-2-white-2": 5,
  "x-y": 6, "omega-ruby-alpha-sapphire": 6,
  "sun-moon": 7, "ultra-sun-ultra-moon": 7, "lets-go-pikachu-lets-go-eevee": 7,
  "sword-shield": 8, "brilliant-diamond-and-shining-pearl": 8, "legends-arceus": 8,
  "scarlet-violet": 9,
};

function getItemGenerationId(data) {
  const en = (data.flavor_text_entries ?? []).filter((e) => e.language.name === "en");
  if (en.length === 0) {
    // No flavor text — newer items; use ID range
    if (data.id >= 2000) return 9;
    if (data.id >= 1600) return 8;
    return 3; // safe fallback
  }
  const firstVG = en[0].version_group.name;
  return ITEM_VG_TO_GEN[firstVG] ?? 3;
}

const ITEM_CATEGORY_LABELS = {
  "standard-balls":  "Poké Balls",
  "special-balls":   "Special Balls",
  "apricorn-balls":  "Apricorn Balls",
  "medicine":        "Medicine",
  "healing":         "Healing",
  "revival":         "Revival",
  "pp-recovery":     "PP Recovery",
  "status-cures":    "Status Cures",
  "vitamins":        "Vitamins & Feathers",
  "effort-drop":     "Effort Berries",
  "held-items":      "Held Items",
  "choice":          "Choice Items",
  "type-enhancement":"Type Enhancement",
  "type-protection": "Type-Protection Berries",
  "bad-held-items":  "Bad Held Items",
  "species-specific":"Species-Specific",
  "plates":          "Plates",
  "memories":        "Memories",
  "mega-stones":     "Mega Stones",
  "z-crystals":      "Z-Crystals",
  "nature-mints":    "Nature Mints",
  "stat-boosts":     "Stat Boosters",
  "in-a-pinch":      "In-a-Pinch Berries",
  "picky-healing":   "Picky-Healing Berries",
  "evolution":       "Evolution Items",
  "effort-training": "Effort Training",
  "training":        "Training",
  "jewels":          "Jewels",
  "scarves":         "Contest Scarves",
  "flutes":          "Flutes",
  "other":           "Other",
};

const itemDir = join(DATA_DIR, "item");
const items = [];

if (existsSync(itemDir)) {
  for (const file of readdirSync(itemDir)) {
    if (!file.endsWith(".json")) continue;
    const data = JSON.parse(readFileSync(join(itemDir, file), "utf8"));
    const enName = data.names?.find((n) => n.language.name === "en")?.name ?? formatName(data.name);
    const shortEffect = data.effect_entries?.find((e) => e.language.name === "en")?.short_effect ?? "";
    const catSlug = data.category?.name ?? "other";
    items.push({
      id: data.id,
      name: data.name,
      displayName: enName,
      category: catSlug,
      categoryDisplay: ITEM_CATEGORY_LABELS[catSlug] ?? formatName(catSlug),
      shortEffect,
      cost: data.cost ?? 0,
      generationId: getItemGenerationId(data),
    });
  }
  items.sort((a, b) => a.id - b.id);
  writeFileSync(join(DATA_DIR, "items.json"), JSON.stringify(items));
  console.log(`✅ items.json — ${items.length} items`);
} else {
  console.log("⚠️  public/data/item/ not found — run fetch-items.mjs first");
}
