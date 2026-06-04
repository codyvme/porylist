import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, '../src/data/pokemon-summary.json');
const summaryList = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

console.log(`Loaded ${summaryList.length} pokemon`);

const pokemonToFind = summaryList.map(p => p.name);

// Randomly select 1000 names to simulate rendering 1000 MiniSprites
const testNames = Array.from({length: 1000}, () => pokemonToFind[Math.floor(Math.random() * pokemonToFind.length)]);

console.log("Starting benchmark for O(N) find...");
const startO_N = performance.now();
let found1 = 0;
for (const name of testNames) {
    const p = summaryList.find(s => s.name === name);
    if (p) found1++;
}
const endO_N = performance.now();
console.log(`O(N) find took ${endO_N - startO_N} ms`);

console.log("Starting benchmark for Map get...");
const startMapBuild = performance.now();
const summaryMap = new Map();
for (const p of summaryList) {
    summaryMap.set(p.name, p);
}
const endMapBuild = performance.now();
console.log(`Map building took ${endMapBuild - startMapBuild} ms`);

const startO_1 = performance.now();
let found2 = 0;
for (const name of testNames) {
    const p = summaryMap.get(name);
    if (p) found2++;
}
const endO_1 = performance.now();
console.log(`O(1) get took ${endO_1 - startO_1} ms`);
