# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow

- Never commit or push without explicit user approval first.

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

1. **Bundled static imports** — `src/data/pokemon-summary.json`, `src/data/pokemon-moves.json`, and `src/data/egg-parents.json` are imported directly by Vite. They become content-hashed chunks cached permanently by the browser — zero network cost on repeat visits. The summary includes species facts (catch rate, egg groups, legendary/mythical/baby flags, evolves-from) inlined at build time, so the Pokédex needs no per-Pokémon species fetches; move availability is split into `pokemon-moves.json` and lazy-loaded only when the Pokédex "Learns Move" filter opens.
2. **Cloudflare Pages** (`/data/...`) — small pre-built JSONs committed to the repo and served by Pages: `moves.json`, `abilities.json`, `version-exclusives.json`, and `route-data/{gameValue}.json`.
3. **PokéAPI** (`https://pokeapi.co/api/v2`) — on-demand fetches for per-Pokémon detail pages (species, evolution chains, move/ability modals, form data). These are lazy and only triggered when a user opens a modal or expands a form row.

Sprites are served from jsDelivr's PokeAPI mirror: `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon`. The `SPRITES_ROOT` constant in `src/lib/games.ts` is the single source of truth for the base URL.

TanStack Query is configured with `staleTime: Infinity` and `gcTime: 30 days` globally (`src/lib/query-client.ts`). The cache is persisted to `localStorage` under the key `porylist-cache-v9` via `@tanstack/query-sync-storage-persister`, except queries backed by bundled static imports (see `dehydrateOptions` in `src/lib/query-client.ts`) — persisting those would waste localStorage quota on data already in the JS bundle. **Bump this key whenever the data shape changes** to force clients to re-fetch.

### Application structure

`src/App.tsx` is the root. It uses React Router (`<Routes>`) with one `<Route>` per page. Cross-cutting state owned by App:
- **Auth state** via Supabase magic-link email; `src/lib/supabase.ts` handles all DB operations
- **Caught Pokémon** (`Record<string, string[]>` keyed by `gameValue`) persisted to localStorage and optionally synced to Supabase (`caught_pokemon` table) when signed in
- **Selected game** (a `GameOption`) shared via `GameProvider` context (`src/lib/game-context.ts`)

**Pages (one component per route):**

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `HomePage` | Dashboard — Pokémon of the Day, active playthrough summaries, breeding projects, shiny hunts, quick links |
| `/pokedex` | `PokemonTable` | Main Pokédex. TanStack Table + TanStack Virtual (1,000+ rows). Accepts `caught` state from App. |
| `/moves` | `MovesTable` | Sortable moves list |
| `/abilities` | `AbilitiesTable` | Sortable abilities list |
| `/natures` | `NaturesTable` | Nature stat modifier reference |
| `/items` | `ItemsTable` | Held items and effects |
| `/catch` | `CatchCalculator` | Generation-accurate catch probability simulator |
| `/damage` | `DamageCalculator` | Battle damage range calculator |
| `/compare` | `CompareView` | Side-by-side stat/type/ability comparison for up to 3 Pokémon |
| `/team` | `TeamBuilder` | Team builder with defensive matchup grid and STAB coverage |
| `/breeding` | `BreedingTracker` | Breeding project tracker with IV/nature/egg-move goals |
| `/routes` | `PlaythroughTracker` | Playthrough tracker with badge progress, Nuzlocke rules, and route encounter tables |
| `/shiny` | `ShinyHuntTracker` | Shiny hunt encounter counter with cumulative probability tracking |
| `/types` | `TypeChartPage` | Full 18×18 type effectiveness matrix. Generation-aware (Gen 1 / Gen 2–5 / Gen 6+). Row icons are in a sticky-left flex column outside the table; column header icons use `sticky top-0` inside the single `overflow-auto` container. |

Modal components (`PokemonModal`, `MoveModal`, `AbilityModal`) are rendered inside their parent table components, not in App.

**Shared components:**
- **`CommandPalette`** (`src/components/CommandPalette.tsx`) — ⌘K search with fuzzy matching across Pokémon, moves, abilities, items, and navigation actions. Supports Pokédex number lookup: a query of all digits (e.g. `151` or `#151`) bypasses fuzzy matching and searches by dex ID.
- **`PokemonSearch`** (`src/components/PokemonSearch.tsx`) — reusable autocomplete input with sprite dropdown, used in CompareView, TeamBuilder, PlaythroughTeamTab, and others.
- **`SpriteImg`** (`src/components/SpriteImg.tsx`) — sprite image with skeleton shimmer and fallback URL support. Resets when `src` prop changes (prevents stale sprites).
- **`GameFilter`** (`src/components/GameFilter.tsx`) — game selector dropdown, reads/writes via `GameProvider` context.

### Key library files

| File | Purpose |
|------|---------|
| `src/lib/games.ts` | Source of truth for all supported games. `GAMES` array defines `nativeRanges`, `genMax`, `generation`, and `spriteVersion` per game. Also exports `bestFlavorText`, `spriteUrl`, `cryUrl`, and the version/version-group mapping tables used throughout the app. |
| `src/lib/pokeapi.ts` | All TanStack Query hooks and TypeScript interfaces for PokéAPI data shapes. `usePokemonSummaryList` returns the bundled `src/data/pokemon-summary.json` synchronously (no fetch). `typesForGeneration` resolves historical types using `past_types`. |
| `src/lib/type-chart.ts` | Type chart with generation patches. `computeTypeEffectiveness` (defensive), `offensiveCoverage` (STAB), and `ALL_TYPES` (canonical type order). Handles Gen 1 (no Dark/Steel/Fairy, Ghost→Psychic bug) and Gen 2–5 (no Fairy, Ghost/Dark resist Steel) differences via `resolvedChart`. Used by TypeChartPage, TeamBuilder, and CompareView. |
| `src/lib/types.ts` | `TYPE_COLORS` map and `typeStyle` helper for inline badge styling. |
| `src/lib/utils.ts` | `cn` (clsx + tailwind-merge) and `formatPokemonName` (handles Nidoran♀/♂ special cases). |
| `src/lib/game-context.ts` | React context providing `selectedGame` / `setSelectedGame` to all components without prop drilling. |
| `src/lib/playthroughs.ts` | Load/save helpers and types for playthrough data stored in localStorage. |
| `src/lib/breeding.ts` | Load/save helpers and types for breeding project data stored in localStorage. |
| `src/lib/shiny-hunts.ts` | Load/save helpers, shiny rate calculations, and cumulative probability for shiny hunt data. |

### Data pipeline scripts

Scripts in `scripts/` run with Node and populate static data files committed to the repo:
- `fetch-data.mjs` — downloads and strips PokéAPI data into `public/data/pokemon/`; resumable, supports per-type `--force=<type>` flag
- `compute-route-data.mjs` — inverts per-Pokémon encounter data into per-game route files at `public/data/route-data/{gameValue}.json`
- `build-move-ability-lists.mjs` — builds `public/data/moves.json` and `public/data/abilities.json`
- `build-pokemon-summary.mjs` — compiles all per-Pokémon JSON (plus species facts from `public/data/pokemon-species/`) into `src/data/pokemon-summary.json`, and move availability into `src/data/pokemon-moves.json` (both bundled by Vite)
- `build-egg-data.mjs` — outputs `src/data/egg-parents.json` (bundled by Vite)

After running scripts, commit the updated files — Cloudflare Pages serves them directly. There is no upload step (R2 has been removed).

### PWA

The app is a fully configured Progressive Web App via `vite-plugin-pwa`. The service worker (Workbox) precaches the app shell and static JSON files, and runtime-caches PokéAPI responses, sprites, cries, and Google Fonts. PWA is disabled in `devOptions` to keep the dev server fast — it activates on production builds. All four required icon sizes are in `public/` (`icon-192.png`, `icon-512.png`, `icon-192-maskable.png`, `icon-512-maskable.png`).

### Conventions

- **Path alias**: `@` → `./src` (configured in both `vite.config.ts` and `tsconfig.app.json`)
- **Styling**: Tailwind CSS with shadcn/ui primitives in `src/components/ui/`. Use `cn()` for conditional class merging. Dark mode is class-based (`dark` on `<html>`). Font is Onest (Google Fonts).
- **Button color**: Buttons use `--btn-primary` (porylist red) via CSS utility overrides in `src/index.css`, kept separate from `--primary` (teal) which drives links, focus rings, and active states.
- **TypeScript**: Strict mode with `noUnusedLocals` and `noUnusedParameters` enforced — unused imports will fail `typecheck`.
- **Game-aware rendering**: Always use `typesForGeneration(pokemon, game.generation)` when displaying types in a game context, not `pokemon.types` directly. Similarly use `bestFlavorText` from `src/lib/games.ts` for flavor text lookup.
- **Catch state key**: Caught Pokémon are stored by Pokémon `name` (PokéAPI slug, e.g. `"pikachu"`) not by ID, under a `gameValue` key (e.g. `"red-blue-yellow"`).

## Design system

Any new page, component, or design change MUST use the canonical patterns below — do not invent new size/weight/tracking combos or new spacing values for roles that already have one. If a deliberate exception is needed, add it to the exception lists here in the same PR.

### Typography scale

All text styling uses these canonical Tailwind class combinations. Layout classes (`mb-*`, `flex`, `truncate`) may be added, but the type classes must match exactly.

| Role | Element | Classes |
|------|---------|---------|
| Page title | `h1` | `text-xl font-semibold` |
| Content-modal / entity title (Pokémon, move, ability, item, trainer) | `h2` | `text-xl font-semibold` |
| Detail-pane title (selected hunt/project/playthrough/location) | `h2` | `text-lg font-semibold` |
| Dialog & form-view title (About, Sign in, confirm, "New X" / "Edit X") | `h2` | `text-lg font-semibold` |
| Section / panel title | `h2`/`h3` | `text-base font-semibold` |
| Eyebrow label (uppercase section/group label) | any | `text-xs font-semibold uppercase tracking-wide text-muted-foreground` (color may be swapped, e.g. `text-primary`; nav uses slate) |
| Form field label | `label` | `text-sm font-medium` |
| Compact form label (dense inline forms, e.g. EncountersTab) | `label` | `text-xs font-medium text-muted-foreground` |
| Checkbox/toggle label | `label` | `flex cursor-pointer items-center gap-2 text-sm` |
| Table column header | `th` | `text-xs font-medium text-muted-foreground` (see `SortableTh`) |
| Hero result number (calculators) | any | `text-4xl font-bold tabular-nums` |

Deliberate exceptions: the brand wordmark in the header (`text-2xl font-bold tracking-tight`), the Pokémon-of-the-Day display name (`text-2xl font-semibold`), and the shiny-hunt counter (`text-5xl font-bold tabular-nums tracking-tight`).

### Spacing & layout

Every page follows the same shell recipe:

- **Page gutter**: the page root sets `px-4 sm:px-6`. Nothing else sets horizontal page padding.
- **Page header bar**: full-bleed via negative margins that mirror the gutter:
  `shrink-0 flex items-center gap-3 border-b border-border py-3 -mx-4 sm:-mx-6 px-4 sm:px-6`
  (tracker pages put these classes directly on the `h1`). The `h1` takes `flex-1` to push `GameFilter`/actions right.
- **Full-bleed children** deeper in a page must use the matching `-mx-4 sm:-mx-6`, never a fixed `-mx-6`.
- **Bottom padding**: pages do NOT add `pb-*` to their root — the `<main>` scroll container in `App.tsx` provides it (`/routes` and `/breeding` opt out with `sm:!pb-0` and manage their own panel padding).
- **Header → content offset**: table & tracker pages use 12px (`gap-3` on the page root, or `pt-3` on tracker panels); tool/dashboard pages (Home, Team, Catch, Damage, Compare, Natures) use 20px (`gap-5` on the root, or `pt-5` on the scroll area). The root `gap` is also the rhythm between top-level sections.
- **Cards**: `p-3` compact tile (quick links), `p-4` standard section/form card, `p-5` featured/result card. Rounded: `rounded-lg` for in-flow cards, `rounded-xl` for hero/result cards and modal panels.
- **Modals**: simple dialogs use `p-6` on the panel; structured modals use a `px-6 py-4` header bar with a separately padded scrollable body.
- **Forms**: label ↔ control gap is `gap-1.5`; between fields use `gap-4` (single-column form) or `gap-6` (two-column grid, e.g. BreedingTracker); compact inline forms (EncountersTab) use grid `gap-3`.

### Environment variables

Required for Supabase auth and catch sync (app is read-only without them):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
