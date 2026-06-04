# Porylist

A fast, filterable Pokémon reference and playthrough companion covering all 1,025 Pokémon across every mainline game from Gen I through Gen IX.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## Features

### Reference

- **Pokédex** — sortable by any stat (HP, Attack, Defense, Sp. Atk, Sp. Def, Speed, BST), filterable by type, legendary/mythical status, egg group, move learnability, and caught/not-caught status. Optional columns for height, weight, catch rate, and egg group.
- **Game filter** — narrow everything to a specific game with generation-accurate typings (e.g. pre-Fairy-type Pokémon show correctly in Gen I–V).
- **National Dex mode** — show all Pokémon up to a generation's cutoff instead of just the regional dex.
- **Pokémon detail modal** — click any Pokémon to see:
  - Home and in-game sprites (with shiny toggle)
  - Generation-accurate abilities with descriptions
  - Base stats bar chart and type effectiveness chart
  - Pokédex flavor text for the selected game
  - Wild encounter locations
  - Full move list (Level Up, Egg, TM/HM, Tutor) for the selected game
  - Evolution chain
- **Moves** — full sortable move list with power, accuracy, PP, type, and category. Filter by type using visual color-coded chips or by category (Physical/Special/Status).
- **Abilities** — browse all abilities with effect descriptions.
- **Natures** — quick reference for nature stat modifiers.
- **Items** — held items and their effects.
- **Type Chart** — full 18×18 attacking vs. defending type effectiveness matrix. Generation-aware (adapts to Gen 1 and Gen 2–5 chart differences). Uses type icons for both axes.

### Tools

- **Catch Calculator** — simulate catch probabilities using the generation-accurate formula for the selected game. Inputs include Pokémon, level, current HP %, status condition, and ball type. Shows catch %, expected throws, and cumulative probability for 1/3/5/10 attempts. All 27 balls supported with conditional multipliers (Nest Ball scales with level, Net Ball checks type, Dusk Ball checks night/cave, Quick Ball checks first turn, etc.).
- **Damage Calculator** — calculate battle damage ranges for any attacker/defender combination, factoring in stats, EVs, nature, held item, move, and weather.
- **Compare** — compare up to 3 Pokémon side-by-side across base stats, types, abilities, type matchups, and Pokémon info.
- **Team Builder** — pick up to 6 Pokémon and see a defensive matchup grid with shared-weakness totals, offensive STAB coverage, and a shareable team link.
- **Breeding Tracker** — track active breeding projects with target IVs, natures, egg moves, and shiny hunting. Syncs to your account when signed in.
- **Shiny Hunt Tracker** — log encounters for an active shiny hunt with method-accurate odds, cumulative probability, and encounter history.
- **Playthroughs** — track game runs with per-run Pokédex progress, badge/trial completion, and Nuzlocke mode with configurable rules. Includes a route browser with Bulbapedia-sourced encounter tables for all games (Gen I–IX, including Legends: Arceus and Scarlet/Violet). Syncs to your account when signed in.

### Other

- **Command palette** (⌘K) — fuzzy search across all Pokémon, moves, abilities, items, and navigation actions. Supports Pokédex number lookup (type `151` or `#151` to jump straight to Mew).
- **Home page** — Pokémon of the Day (deterministic per calendar day, same for all visitors), active playthrough summaries, and quick navigation to all sections.
- **Catch tracker** — mark Pokémon as caught per game via the Pokéball icon in the table or detail modal; progress persists locally and syncs to your account when signed in.
- **Dark mode** — defaults to your device preference; toggle in the header.
- **Offline-capable & installable** — a fully configured PWA (vite-plugin-pwa + Workbox). Add to your home screen on iOS or Android for a native app feel. Data is cached in localStorage via TanStack Query and in the service worker cache, so repeat visits are instant even without a connection.

---

## Tech Stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- [TanStack Query](https://tanstack.com/query) — data fetching and persistent caching
- [TanStack Table](https://tanstack.com/table) — headless table with sorting
- [TanStack Virtual](https://tanstack.com/virtual) — virtualized rows for smooth scrolling through 1,000+ Pokémon
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) — styling
- [Supabase](https://supabase.com/) — auth (magic-link email) and cloud sync for caught Pokémon, playthroughs, and breeding projects
- [Cloudflare Pages](https://pages.cloudflare.com/) — hosting
- [jsDelivr](https://www.jsdelivr.com/) — Pokémon sprite CDN (via the [PokeAPI sprites repository](https://github.com/PokeAPI/sprites))

---

## Data Architecture

Data is served from three sources:

1. **Bundled static imports** — `src/data/pokemon-summary.json` (all 1,350+ Pokémon with types, stats, abilities, and move lists) and `src/data/egg-parents.json` are imported directly by Vite. They're compiled into content-hashed chunks and cached permanently by the browser after the first visit.

2. **Cloudflare Pages** (`/data/...`) — smaller pre-built JSONs committed to the repo and served alongside the app: `moves.json`, `abilities.json`, `version-exclusives.json`, and per-game `route-data/{game}.json` encounter tables. Route data for all games is scraped from [Bulbapedia](https://bulbapedia.bulbagarden.net/) via `scripts/scrape-bulbapedia-all.mjs`.

3. **PokéAPI** (`https://pokeapi.co/api/v2`) — on-demand fetches for individual detail pages: species info, evolution chains, move/ability modals, and alternate form data. These are lazy and only triggered when a user opens a modal or expands an alternate form row.

All fetched data is cached in `localStorage` via TanStack Query (`staleTime: Infinity`, `gcTime: 30 days`), so repeat visits are instant with no network requests.

Sprites are served from jsDelivr's PokeAPI mirror (`cdn.jsdelivr.net/gh/PokeAPI/sprites@master`).

### Updating the data

```bash
# Re-fetch raw Pokémon data from PokéAPI into public/data/pokemon/
npm run fetch-data

# Rebuild derived files after a fetch
node scripts/build-pokemon-summary.mjs
node scripts/build-move-ability-lists.mjs
node scripts/compute-route-data.mjs
```

`fetch-data` is resumable — it skips files that already exist locally. Pass `--force` to re-fetch everything. After rebuilding, commit the updated files and push — Cloudflare Pages deploys them automatically.

---

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

1. **Clone the repo**

   ```bash
   git clone git@github.com:codyvme/porylist.git
   cd porylist
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment variables** (optional — app is read-only without them)

   ```
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```

4. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173). Static data files are served locally by Vite and PokéAPI is called for on-demand details, so no additional setup is needed.

### Build

```bash
npm run build
```

Output goes to `dist/`.

---

## Data Sources

Pokémon data sourced from [PokéAPI](https://pokeapi.co/). Encounter data sourced from [Bulbapedia](https://bulbapedia.bulbagarden.net/). Sprites from the [PokeAPI sprites repository](https://github.com/PokeAPI/sprites). Type icons by [partywhale](https://github.com/partywhale/pokemon-type-icons).

---

## Disclaimer

Porylist is an independent fan site and is not affiliated with, endorsed by, or connected to Nintendo, Game Freak, or The Pokémon Company. All Pokémon names, characters, and related media are trademarks and © of their respective owners.

## License

MIT © [Cody VerKuilen](https://github.com/codyvme)
