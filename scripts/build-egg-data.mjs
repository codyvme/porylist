/**
 * Processes Smogon Pokemon Showdown data into a compact JSON lookup table for
 * egg move parent finding. Run with: node scripts/build-egg-data.mjs
 *
 * Requires learnsets.ts and pokedex.ts downloaded locally:
 *   curl -o /tmp/learnsets.ts https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/learnsets.ts
 *   curl -o /tmp/pokedex.ts   https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/pokedex.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
import vm from "vm";

const learnsetsSrc = readFileSync("/tmp/learnsets.ts", "utf8");
const pokedexSrc = readFileSync("/tmp/pokedex.ts", "utf8");

function evalSmogonTS(src) {
  // Strip the TypeScript export + type annotation, leaving a plain JS object
  const stripped = src
    .replace(/^export const \w+:[^=]+=\s*/m, "module.exports = ")
    .replace(/^export const \w+ =\s*/m, "module.exports = ");
  const req = createRequire(import.meta.url);
  const m = { exports: {} };
  vm.runInNewContext(stripped, { module: m, exports: m.exports });
  return m.exports;
}

const Learnsets = evalSmogonTS(learnsetsSrc);
const Pokedex = evalSmogonTS(pokedexSrc);

// Gen bitmask: bit (gen-1), so gen 1=1, gen 2=2, gen 3=4 ... gen 9=256
function genMask(gen) {
  return 1 << (gen - 1);
}

// Smogon learnset codes: "9L1" "8E" "7M" "6T" "4S0" "3D" etc.
// First digits = generation number.
function codeGen(code) {
  const m = code.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// Smogon method letters: L=level-up, E=egg, M=TM/HM, T=tutor, S=event,
// V=virtual-console, D=dream-world, C=colosseum, X=XD
// For breeding, the parent just needs to *know* the move — any method counts.

const result = {};

for (const [speciesId, dexEntry] of Object.entries(Pokedex)) {
  // Skip CAP (Create-A-Pokemon) entries which have negative dex numbers
  if (dexEntry.num <= 0) continue;
  // Skip Undiscovered egg group (legendaries, babies before they can breed, etc.)
  if (!dexEntry.eggGroups || dexEntry.eggGroups.includes("Undiscovered")) continue;
  // Skip Ditto — it can breed but can't pass egg moves
  if (speciesId === "ditto") continue;

  const learnsetEntry = Learnsets[speciesId];
  if (!learnsetEntry?.learnset) continue;

  const moveMasks = {};
  for (const [moveName, codes] of Object.entries(learnsetEntry.learnset)) {
    let mask = 0;
    for (const code of codes) {
      const gen = codeGen(code);
      if (gen >= 1 && gen <= 9) mask |= genMask(gen);
    }
    if (mask > 0) moveMasks[moveName] = mask;
  }

  // Derive PokeAPI-compatible name from the display name
  const pokeApiName = dexEntry.name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // strip diacritics (Flabébé → Flabebe)
    .toLowerCase()
    .replace(/♀/g, "-f").replace(/♂/g, "-m")
    .replace(/['.:’]/g, "")   // remove apostrophes, dots, colons
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-$/, "");

  result[speciesId] = {
    n: dexEntry.name,    // display name, e.g. "Mr. Mime"
    p: pokeApiName,      // PokeAPI species name, e.g. "mr-mime"
    i: dexEntry.num,     // national dex number for sprite URL
    g: dexEntry.eggGroups,
    l: moveMasks,
  };
}

const json = JSON.stringify(result);
const outPath = "./src/data/egg-parents.json";
writeFileSync(outPath, json);

console.log(`Species written: ${Object.keys(result).length}`);
console.log(`Output size: ${(json.length / 1024).toFixed(1)} KB`);

// Quick sanity check: who can pass Curse to Hippopotas in Gen 4?
const hippoGroups = Pokedex["hippopotas"].eggGroups; // ["Field"]
// Smogon move name for "curse" is "curse" (same)
const gen4Mask = genMask(4);
const curseParents = Object.entries(result)
  .filter(([, data]) =>
    data.g.some((g) => hippoGroups.includes(g)) &&
    (data.l["curse"] & gen4Mask) !== 0,
  )
  .map(([id]) => id);
console.log(`\nCurse parents for Hippopotas (Gen 4, ${hippoGroups}):`);
console.log(curseParents.join(", "));
