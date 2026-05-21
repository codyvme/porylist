/**
 * Builds public/data/pokemon-summary.json — a single file with everything
 * the Pokédex table needs, replacing 1025 individual PokeAPI fetches.
 *
 * Each entry contains:
 *   id, name, height, weight, types, past_types, stats, abilities, species
 *   moves: { [moveName]: number[] }  — array of generation numbers the move
 *                                      is available in (for the move filter)
 *
 * Run with: node scripts/build-pokemon-summary.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POKEMON_DIR = path.join(__dirname, "../public/data/pokemon");
const OUT_FILE = path.join(__dirname, "../public/data/pokemon-summary.json");

const VERSION_GROUP_TO_GEN = {
  "red-blue": 1, "yellow": 1,
  "gold-silver": 2, "crystal": 2,
  "ruby-sapphire": 3, "emerald": 3, "firered-leafgreen": 3, "colosseum": 3, "xd": 3,
  "diamond-pearl": 4, "platinum": 4, "heartgold-soulsilver": 4,
  "black-white": 5, "black-2-white-2": 5,
  "x-y": 6, "omega-ruby-alpha-sapphire": 6,
  "sun-moon": 7, "ultra-sun-ultra-moon": 7, "lets-go-pikachu-lets-go-eevee": 7,
  "sword-shield": 8, "brilliant-diamond-and-shining-pearl": 8, "legends-arceus": 8,
  "scarlet-violet": 9,
};

const files = fs.readdirSync(POKEMON_DIR).filter((f) => f.endsWith(".json"));
console.log(`Processing ${files.length} Pokémon…`);

const summary = [];

for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(POKEMON_DIR, file), "utf8"));

  // Compact moves: moveName → sorted unique array of generation numbers
  const movesMap = {};
  for (const m of raw.moves ?? []) {
    const gens = new Set();
    for (const vgd of m.version_group_details) {
      const gen = VERSION_GROUP_TO_GEN[vgd.version_group.name];
      if (gen) gens.add(gen);
    }
    if (gens.size > 0) movesMap[m.move.name] = [...gens].sort((a, b) => a - b);
  }

  summary.push({
    id: raw.id,
    name: raw.name,
    height: raw.height,
    weight: raw.weight,
    types: raw.types.map((t) => ({ slot: t.slot, type: { name: t.type.name } })),
    past_types: raw.past_types,
    stats: raw.stats.map((s) => ({ base_stat: s.base_stat, stat: { name: s.stat.name } })),
    abilities: raw.abilities.map((a) => ({
      ability: { name: a.ability.name },
      is_hidden: a.is_hidden,
      slot: a.slot,
    })),
    species: { name: raw.species.name },
    moves: movesMap,
  });
}

// Sort by id so the output is stable
summary.sort((a, b) => a.id - b.id);

fs.writeFileSync(OUT_FILE, JSON.stringify(summary));
const kb = Math.round(fs.statSync(OUT_FILE).size / 1024);
console.log(`✓ Wrote ${summary.length} entries to pokemon-summary.json (${kb} KB)`);
