## 2023-11-20 - [PokemonSearch Optimization]
**Learning:** Chained `.filter(...).filter(...).slice(...)` on a medium-sized list (1000+ items) in React's `useMemo` is an O(N) operation per keypress, and can be slow depending on the callbacks.
**Action:** Replace full array scans with `for...of` loops and early `break` when filtering down to a maximum number of results (e.g., `maxResults`). This prevents unnecessary evaluation of `formatPokemonName` and other regex logic on the rest of the array.
## 2024-06-06 - TypeBadge and SpriteImg re-rendering issue
**Learning:** Pure components like `SpriteImg` and `TypeBadge` used widely in long lists/tables can cause serious performance issues if not memoized, due to React re-rendering them whenever a parent component (like a list row) updates.
**Action:** Always wrap small, heavily-used pure UI components (badges, icons, primitive components) in `React.memo` to prevent cascading render cycles when updating parent states.
