# Porylist

A fast, filterable Pokédex for browsing, sorting, and team-building across all 1,025 Pokémon.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## Features

- **Game filter** — narrow the list to Pokémon available in a specific game, with generation-accurate typings (e.g. pre-Fairy-type Pokémon show correctly in Gen 1–5)
- **National Dex mode** — show all Pokémon up to a generation's cutoff instead of just the regional dex
- **Sortable stats** — click any column header to sort by HP, Attack, Defense, Sp. Atk, Sp. Def, Speed, or BST
- **Filter dropdown** — filter by one or more types, or limit results to legendary or mythical Pokémon
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
- **Team Builder** — pick up to 6 Pokémon via the + button on any row or in the detail modal. A docked bottom panel shows:
  - Mini sprites for each team slot
  - Defensive matchups grid — per-type damage multipliers for each member with a shared weakness count totals row
  - Offensive STAB coverage — which types your team hits for super-effective damage
  - Team persists to localStorage across sessions
- **Dark mode** — defaults to your device's color scheme preference; toggle manually in the header
- **Offline-capable** — data is cached in IndexedDB via TanStack Query, so repeat visits are instant

## Tech Stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- [TanStack Query](https://tanstack.com/query) — data fetching and persistent caching
- [TanStack Table](https://tanstack.com/table) — headless table with sorting
- [TanStack Virtual](https://tanstack.com/virtual) — virtualized rows for smooth scrolling through 1,000+ Pokémon
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) — styling
- [PokéAPI](https://pokeapi.co/) — Pokémon data
- [PokeAPI Sprites](https://github.com/PokeAPI/sprites) — sprite assets

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

3. **Set up sprites**

   Sprites are not included in this repo due to their size (~490 MB, ~24k files). Clone the PokeAPI sprites repo into `public/poke-sprites/`:

   ```bash
   git clone https://github.com/PokeAPI/sprites.git public/poke-sprites
   ```

4. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173).

### Build

```bash
npm run build
```

Output goes to `dist/`.

## Data Sources

All Pokémon data is fetched at runtime from [PokéAPI](https://pokeapi.co/) and cached locally. Sprites are sourced from the [PokeAPI sprites repository](https://github.com/PokeAPI/sprites). Type icons by [partywhale](https://github.com/partywhale/pokemon-type-icons).

> **Note:** Wild encounter location data is not yet available for Generation 8+ games (Sword/Shield, Brilliant Diamond/Shining Pearl, Legends: Arceus, Scarlet/Violet) due to a gap in PokéAPI's data. Contributions to add this data are welcome — see below.

## Contributing

Contributions are welcome! The most impactful area right now is **wild encounter data for Gen 8+ games**, which is missing from PokéAPI. If you're interested in helping compile that data, please open an issue to coordinate.

For everything else, feel free to open a PR.

## Disclaimer

Porylist is an independent fan site and is not affiliated with, endorsed by, or connected to Nintendo, Game Freak, or The Pokémon Company. All Pokémon names, characters, and related media are trademarks and © of their respective owners.

## License

MIT © [Cody VerKuilen](https://github.com/codyvme)
