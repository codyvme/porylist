// Gen 6+ type chart. chart[attackType][defendType] = multiplier (only non-1× entries stored).
const CHART: Record<string, Record<string, number>> = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5, grass: 2, ice: 2, bug: 2, steel: 2 },
  water:    { water: 0.5, grass: 0.5, dragon: 0.5, fire: 2, ground: 2, rock: 2 },
  electric: { electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0, water: 2, flying: 2 },
  grass:    { fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5, water: 2, ground: 2, rock: 2 },
  ice:      { fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5, grass: 2, ground: 2, flying: 2, dragon: 2 },
  fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0 },
  poison:   { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground:   { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0 },
  flying:   { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5, dark: 0 },
  bug:      { grass: 2, psychic: 2, dark: 2, fire: 0.5, fighting: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, poison: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
  ghost:    { ghost: 2, psychic: 2, normal: 0, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { ghost: 2, psychic: 2, dark: 0.5, fighting: 0.5, fairy: 0.5 },
  steel:    { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
  fairy:    { fighting: 2, dragon: 2, dark: 2, fire: 0.5, poison: 0.5, steel: 0.5 },
};

// ── Generation-specific patches ───────────────────────────────────────────────
//
// Gen 1 (RBY):
//   • Ghost → Psychic = 0  (programming bug: should be 2×, coded as 0×)
//   • Poison → Bug    = 2  (nerfed to 1× in Gen 2)
//   • Bug   → Poison  = 2  (nerfed to 0.5× in Gen 2)
//   • No Dark, Steel, or Fairy types
//
// Gen 2–5 (GSC–BW2):
//   • Ghost → Steel   = 0.5  (Steel lost this resistance in Gen 6)
//   • Dark  → Steel   = 0.5  (Steel lost this resistance in Gen 6)
//   • No Fairy type

const GEN1_PATCHES: Record<string, Record<string, number>> = {
  ghost:  { psychic: 0 },
  poison: { bug: 2 },
  bug:    { poison: 2 },
};

const GEN2_5_PATCHES: Record<string, Record<string, number>> = {
  ghost: { steel: 0.5 },
  dark:  { steel: 0.5 },
};

// Types that don't exist in each era (excluded from both attacker & defender results)
const GEN1_EXCLUDED  = new Set(["dark", "steel", "fairy"]);
const GEN2_5_EXCLUDED = new Set(["fairy"]);

function resolvedChart(generation: number): Record<string, Record<string, number>> {
  if (generation === 1) {
    const chart: Record<string, Record<string, number>> = {};
    for (const [atk, row] of Object.entries(CHART)) {
      chart[atk] = { ...row, ...(GEN1_PATCHES[atk] ?? {}) };
    }
    return chart;
  }
  if (generation <= 5) {
    const chart: Record<string, Record<string, number>> = {};
    for (const [atk, row] of Object.entries(CHART)) {
      chart[atk] = { ...row, ...(GEN2_5_PATCHES[atk] ?? {}) };
    }
    return chart;
  }
  return CHART;
}

function excludedTypes(generation: number): Set<string> {
  if (generation === 1) return GEN1_EXCLUDED;
  if (generation <= 5) return GEN2_5_EXCLUDED;
  return new Set();
}

// ── Public API ────────────────────────────────────────────────────────────────

export const ALL_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
] as const;

export type TypeName = typeof ALL_TYPES[number];

/**
 * Returns the set of defending types that the given STAB types hit for 2×+.
 * Pass `generation` to respect pre-Gen-6 chart differences.
 */
export function offensiveCoverage(atkTypes: string[], generation = 9): Set<string> {
  const chart = resolvedChart(generation);
  const excluded = excludedTypes(generation);
  const covered = new Set<string>();
  for (const atk of atkTypes) {
    for (const def of ALL_TYPES) {
      if (excluded.has(def)) continue;
      if ((chart[atk]?.[def] ?? 1) >= 2) covered.add(def);
    }
  }
  return covered;
}

/**
 * Returns a map of attackingType → damage multiplier for a Pokémon
 * with the given defending types (1 or 2).
 * Pass `generation` to respect pre-Gen-6 chart differences.
 */
export function computeTypeEffectiveness(
  defendingTypes: string[],
  generation = 9,
): Record<string, number> {
  const chart = resolvedChart(generation);
  const excluded = excludedTypes(generation);
  const result: Record<string, number> = {};
  for (const atk of ALL_TYPES) {
    if (excluded.has(atk)) continue;
    let mult = 1;
    for (const def of defendingTypes) {
      mult *= chart[atk]?.[def] ?? 1;
    }
    result[atk] = mult;
  }
  return result;
}
