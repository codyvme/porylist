## 2023-11-20 - [PokemonSearch Optimization]
**Learning:** Chained `.filter(...).filter(...).slice(...)` on a medium-sized list (1000+ items) in React's `useMemo` is an O(N) operation per keypress, and can be slow depending on the callbacks.
**Action:** Replace full array scans with `for...of` loops and early `break` when filtering down to a maximum number of results (e.g., `maxResults`). This prevents unnecessary evaluation of `formatPokemonName` and other regex logic on the rest of the array.
