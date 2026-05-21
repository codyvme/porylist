# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server at http://localhost:5173
npm run build        # Type-check then build to dist/
npm run typecheck    # Run tsc --noEmit (no test suite exists)
npm run preview      # Preview the production build locally

npm run fetch-data   # Pull Pokémon data from PokéAPI → public/data/ (resumable; add --force to re-fetch)
```

There is no test suite. `npm run typecheck` is the primary code-correctness check.

## Architecture

### Runtime data flow

Data comes from three sources:

1. **Bundled static imports** — `src/data/pokemon-summary.json` and `src/data/egg-parents.json` are imported directly by Vite. They become content-hashed chunks cached permanently by the browser — zero network cost on repeat visits.
2. **Cloudflare Pages** (`/data/...`) — small pre-built JSONs committed to the repo and served by Pages: `moves.json`, `abilities.json`, `version-exclusives.json`, and `route-data/{gameValue}.json`.
3. **PokéAPI** (`https://pokeapi.co/api/v2`) — on-demand fetches for per-Pokémon detail pages (species, evolution chains, move/ability modals, form data). These are lazy and only triggered when a user opens a modal or expands a form row.

Sprites are served from jsDelivr's PokeAPI mirror: `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon`. The `SPRITES_ROOT` constant in `src/lib/games.ts` is the single source of truth for the base URL.

TanStack Query is configured with `staleTime: Infinity` and `gcTime: 30 days` globally (`src/lib/query-client.ts`). The entire cache is persisted to `localStorage` under the key `porylist-cache-v7` via `@tanstack/query-sync-storage-persister`. **Bump this key whenever the data shape changes** to force clients to re-fetch.

### Application structure

`src/App.tsx` is the root — it owns all cross-cutting state:
- **Active tab** (`pokedex` | `moves` | `abilities` | `routes`) synced to `?tab=` URL param
- **Caught Pokémon** (`Record<string, string[]>` keyed by `gameValue`) persisted to localStorage and optionally synced to Supabase (`caught_pokemon` table) when signed in
- **Team** (up to 6 Pokémon names) persisted to localStorage and encoded in `?team=` URL param
- **Auth state** via Supabase magic-link email; `src/lib/supabase.ts` handles all DB operations

Each tab renders a single top-level component:
- **PokemonTable** (`src/components/PokemonTable.tsx`) — the main Pokédex. Uses TanStack Table for sorting/column management and TanStack Virtual for virtualized rows (handles 1,000+ Pokémon). Accepts `caught` and `team` state from App.
- **MovesTable** (`src/components/MovesTable.tsx`) — sortable moves list.
- **AbilitiesTable** (`src/components/AbilitiesTable.tsx`) — sortable abilities list.
- **RouteBrowser** (`src/components/RouteBrowser.tsx`) — per-game encounter tables with Pokémon catch-tracking overlay. Navigation target from the Pokédex tab (`handleOpenInCatchTracker`) is passed as a prop.

Modal components (`PokemonModal`, `MoveModal`, `AbilityModal`) are rendered inside their parent table components, not in App.

**TeamBuilder** (`src/components/TeamBuilder.tsx`) is a docked bottom panel only visible on the `pokedex` tab. It displays defensive matchup grids and offensive STAB coverage using `src/lib/type-chart.ts`.

### Key library files

| File | Purpose |
|------|---------|
| `src/lib/games.ts` | Source of truth for all supported games. `GAMES` array defines `nativeRanges`, `genMax`, `generation`, and `spriteVersion` per game. Also exports `bestFlavorText`, `spriteUrl`, and the version/version-group mapping tables used throughout the app. |
| `src/lib/pokeapi.ts` | All TanStack Query hooks and TypeScript interfaces for PokéAPI data shapes. `usePokemonSummaryList` returns the bundled `src/data/pokemon-summary.json` synchronously (no fetch). `typesForGeneration` resolves historical types using `past_types`. |
| `src/lib/type-chart.ts` | Gen 6+ type chart. `computeTypeEffectiveness` (defensive) and `offensiveCoverage` (STAB). Does not account for pre-Gen-6 chart differences. |
| `src/lib/types.ts` | `TYPE_COLORS` map and `typeStyle` helper for inline badge styling. |
| `src/lib/utils.ts` | `cn` (clsx + tailwind-merge) and `formatPokemonName` (handles Nidoran♀/♂ special cases). |

### Data pipeline scripts

Scripts in `scripts/` run with Node and populate static data files committed to the repo:
- `fetch-data.mjs` — downloads and strips PokéAPI data into `public/data/pokemon/`; resumable, supports per-type `--force=<type>` flag
- `compute-route-data.mjs` — inverts per-Pokémon encounter data into per-game route files at `public/data/route-data/{gameValue}.json`
- `build-move-ability-lists.mjs` — builds `public/data/moves.json` and `public/data/abilities.json`
- `build-pokemon-summary.mjs` — compiles all per-Pokémon JSON into `src/data/pokemon-summary.json` (bundled by Vite)
- `build-egg-data.mjs` — outputs `src/data/egg-parents.json` (bundled by Vite)

After running scripts, commit the updated files — Cloudflare Pages serves them directly. There is no upload step (R2 has been removed).

### Conventions

- **Path alias**: `@` → `./src` (configured in both `vite.config.ts` and `tsconfig.app.json`)
- **Styling**: Tailwind CSS with shadcn/ui primitives in `src/components/ui/`. Use `cn()` for conditional class merging. Dark mode is class-based (`dark` on `<html>`).
- **TypeScript**: Strict mode with `noUnusedLocals` and `noUnusedParameters` enforced — unused imports will fail `typecheck`.
- **Game-aware rendering**: Always use `typesForGeneration(pokemon, game.generation)` when displaying types in a game context, not `pokemon.types` directly. Similarly use `bestFlavorText` from `src/lib/games.ts` for flavor text lookup.
- **Catch state key**: Caught Pokémon are stored by Pokémon `name` (PokéAPI slug, e.g. `"pikachu"`) not by ID, under a `gameValue` key (e.g. `"red-blue-yellow"`).

### Environment variables

Required for Supabase auth and catch sync (app is read-only without them):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
