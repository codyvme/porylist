/**
 * Builds the two bundled Pokédex data files from local PokéAPI dumps:
 *
 *   src/data/pokemon-summary.json — everything the Pokédex table needs to
 *     render and filter rows, including species facts (capture rate, egg
 *     groups, legendary/mythical/baby flags, evolves_from) inlined from
 *     public/data/pokemon-species/. No runtime species fetches.
 *
 *   src/data/pokemon-moves.json — { pokemonName: { moveName: [gens] } }.
 *     Split out of the summary because it is ~70% of the bytes and only the
 *     Pokédex "Learns Move" filter needs it; it is lazy-loaded on demand.
 *
 * Run with: node scripts/build-pokemon-summary.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POKEMON_DIR = path.join(__dirname, "../public/data/pokemon");
const SPECIES_DIR = path.join(__dirname, "../public/data/pokemon-species");
const OUT_FILE = path.join(__dirname, "../src/data/pokemon-summary.json");
const MOVES_OUT_FILE = path.join(__dirname, "../src/data/pokemon-moves.json");

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

const speciesCache = new Map();
function loadSpecies(name) {
  if (speciesCache.has(name)) return speciesCache.get(name);
  const file = path.join(SPECIES_DIR, `${name}.json`);
  let data = null;
  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  }
  speciesCache.set(name, data);
  return data;
}

const summary = [];
const allMoves = {};

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
  if (Object.keys(movesMap).length > 0) allMoves[raw.name] = movesMap;

  const species = loadSpecies(raw.species.name);

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
    ...(species && {
      capture_rate: species.capture_rate,
      egg_groups: species.egg_groups.map((g) => g.name),
      is_legendary: species.is_legendary,
      is_mythical: species.is_mythical,
      is_baby: species.is_baby,
      evolves_from: species.evolves_from_species?.name ?? null,
    }),
  });
}

// Sort by id so the output is stable
summary.sort((a, b) => a.id - b.id);

fs.writeFileSync(OUT_FILE, JSON.stringify(summary));
const kb = Math.round(fs.statSync(OUT_FILE).size / 1024);
console.log(`✓ Wrote ${summary.length} entries to pokemon-summary.json (${kb} KB)`);

fs.writeFileSync(MOVES_OUT_FILE, JSON.stringify(allMoves));
const movesKb = Math.round(fs.statSync(MOVES_OUT_FILE).size / 1024);
console.log(`✓ Wrote ${Object.keys(allMoves).length} entries to pokemon-moves.json (${movesKb} KB)`);
