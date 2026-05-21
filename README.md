# Porylist

A fast, filterable Pokédex for browsing, sorting, and team-building across all 1,025 Pokémon.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## Features

- **Game filter** — narrow the list to Pokémon available in a specific game, with generation-accurate typings (e.g. pre-Fairy-type Pokémon show correctly in Gen 1–5)
- **National Dex mode** — show all Pokémon up to a generation's cutoff instead of just the regional dex
- **Sortable stats** — click any column header to sort by HP, Attack, Defense, Sp. Atk, Sp. Def, Speed, or BST
- **Filter dropdown** — filter by one or more types, limit results to legendary or mythical Pokémon, filter by move learnability (per game), and show only caught or not-yet-caught Pokémon
- **Catch tracker** — mark Pokémon as caught per game via the Pokéball icon in the table or detail modal; progress is shown in the footer and persists across sessions
- **Column picker** — toggle optional columns: height, weight, catch rate, and egg group
- **Search** — live search by name
- **Pokémon detail modal** — click any Pokémon to see:
  - Home and in-game sprites (with shiny toggle)
  - Generation-accurate abilities with descriptions
  - Base stats bar chart
  - Type effectiveness chart
  - Pokédex flavor text for the selected game
  - Wild encounter locations (where available)
  - Full move list (Level Up, Egg Moves, TM/HM, Move Tutor) for the selected game
  - Evolution chain
- **Team Builder** — pick up to 6 Pokémon via the + button on any row. A docked bottom panel shows:
  - Mini sprites for each team slot
  - Defensive matchups grid — per-type damage multipliers for each member with a shared weakness count totals row
  - Offensive STAB coverage — which types your team hits for super-effective damage
  - Shareable link via the share button
  - Team persists to localStorage across sessions
- **Dark mode** — defaults to your device's color scheme preference; toggle manually in the header
- **Offline-capable** — data is cached in localStorage via TanStack Query, so repeat visits are instant

## Tech Stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- [TanStack Query](https://tanstack.com/query) — data fetching and persistent caching
- [TanStack Table](https://tanstack.com/table) — headless table with sorting
- [TanStack Virtual](https://tanstack.com/virtual) — virtualized rows for smooth scrolling through 1,000+ Pokémon
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) — styling
- [Cloudflare Pages](https://pages.cloudflare.com/) — hosting
- [jsDelivr](https://www.jsdelivr.com/) — Pokémon sprite CDN (via the [PokeAPI sprites repository](https://github.com/PokeAPI/sprites))

## Data Architecture

Data is served from three sources:

1. **Bundled static imports** — `src/data/pokemon-summary.json` (all 1,350+ Pokémon with types, stats, abilities, and move lists) and `src/data/egg-parents.json` are imported directly by Vite. They're compiled into content-hashed chunks and cached permanently by the browser after the first visit.

2. **Cloudflare Pages** (`/data/...`) — smaller pre-built JSONs committed to the repo and served alongside the app: `moves.json`, `abilities.json`, `version-exclusives.json`, and per-game `route-data/{game}.json` encounter tables.

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

3. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173). Static data files are served locally by Vite and PokéAPI is called for on-demand details, so no additional setup is needed.

### Build

```bash
npm run build
```

Output goes to `dist/`.

## Data Sources

Pokémon data sourced from [PokéAPI](https://pokeapi.co/). Sprites from the [PokeAPI sprites repository](https://github.com/PokeAPI/sprites). Type icons by [partywhale](https://github.com/partywhale/pokemon-type-icons).

> **Note:** Wild encounter location data is not yet available for Generation 8+ games (Sword/Shield, Brilliant Diamond/Shining Pearl, Legends: Arceus, Scarlet/Violet) due to a gap in PokéAPI's data.

## Disclaimer

Porylist is an independent fan site and is not affiliated with, endorsed by, or connected to Nintendo, Game Freak, or The Pokémon Company. All Pokémon names, characters, and related media are trademarks and © of their respective owners.

## License

MIT © [Cody VerKuilen](https://github.com/codyvme)
