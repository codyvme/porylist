#!/usr/bin/env node
/**
 * Fetches location ordering from PokeAPI and saves to
 * public/data/location-order.json
 *
 * For each location area we store its game_index per generation, e.g.:
 *   { "johto-route-29-area": { "generation-ii": 1, "generation-iv": 3 } }
 *
 * compute-route-data.mjs reads this to sort locations in game order.
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const POKEAPI = "https://pokeapi.co/api/v2";
const DELAY_MS = 250; // polite delay between requests
const MAX_RETRIES = 3;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await sleep(DELAY_MS * attempt * 2);
      return fetchJson(url, attempt + 1);
    }
    throw new Error(`Failed after ${MAX_RETRIES} attempts: ${url} — ${err.message}`);
  }
}

// Regions that have games with route data in Porylist
const REGIONS = ["kanto", "johto", "hoenn", "sinnoh", "unova", "kalos", "alola"];

async function main() {
  // areaName → { generationName: gameIndex }
  const output = {};

  for (const region of REGIONS) {
    console.log(`\n── ${region.toUpperCase()} ──`);
    const regionData = await fetchJson(`${POKEAPI}/region/${region}/`);
    await sleep(DELAY_MS);

    const locs = regionData.locations;
    console.log(`  ${locs.length} locations`);

    for (let i = 0; i < locs.length; i++) {
      const locName = locs[i].name;
      process.stdout.write(`  [${i + 1}/${locs.length}] ${locName} … `);

      let locData;
      try {
        locData = await fetchJson(`${POKEAPI}/location/${locName}/`);
        await sleep(DELAY_MS);
      } catch (e) {
        console.log(`✗ ${e.message}`);
        continue;
      }

      // Build generation → game_index map for this location
      const genIndices = {};
      for (const gi of locData.game_indices) {
        genIndices[gi.generation.name] = gi.game_index;
      }

      // Apply to every location-area that belongs to this location
      for (const area of locData.areas) {
        if (!output[area.name]) output[area.name] = {};
        Object.assign(output[area.name], genIndices);
      }

      const idxSummary = Object.entries(genIndices)
        .map(([g, idx]) => `${g.replace("generation-", "gen")}:${idx}`)
        .join(", ");
      console.log(`✓  ${locData.areas.length} area(s)  [${idxSummary || "no indices"}]`);
    }
  }

  const outPath = join(__dirname, "location-order.json");
  writeFileSync(outPath, JSON.stringify(output));
  console.log(`\nDone. ${Object.keys(output).length} location areas → ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
