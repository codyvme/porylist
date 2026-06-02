// Types, odds math, and localStorage helpers for the Shiny Hunt Tracker.

// ─── Types ─────────────────────────────────────────────────────────────────

export type ShinyMethod = "masuda" | "soft-reset" | "sos-chain";
export type ShinyStatus = "active" | "found" | "abandoned";

export interface ShinyHunt {
  id: string;
  /** PokéAPI slug, e.g. "ralts" */
  species: string;
  /** Denormalized display name, e.g. "Ralts" — renders without data lookup */
  speciesName: string;
  /** GameOption.value, e.g. "sun-moon" */
  gameValue: string;
  method: ShinyMethod;
  hasShinyCharm: boolean;
  /** Encounter / SR / egg counter. For SOS this doubles as chain length. */
  count: number;
  status: ShinyStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  /** Set when status transitions to "found" */
  foundAt?: number;
}

// ─── Odds math ─────────────────────────────────────────────────────────────

/**
 * Masuda Method single-encounter probability.
 * Gen 4: 5 bonus rolls on 1/8192 base. No Shiny Charm in Gen 4.
 * Gen 5: 5 bonus rolls on 1/8192 base. Charm adds 2 more rolls.
 * Gen 6+: 5 bonus rolls on 1/4096 base. Charm adds 2 more rolls.
 */
function masudaRate(generation: number, charm: boolean): number {
  if (generation <= 3) return 0; // Not available
  if (generation === 4) return 6 / 8192; // ~1/1365; charm didn't exist
  if (generation === 5) return (charm ? 8 : 6) / 8192; // 1/1024 or 1/1365
  return (charm ? 8 : 6) / 4096; // 1/512 or ~1/683
}

/**
 * Soft-reset single-encounter probability.
 * Pre-Gen 6: 1/8192 base. Gen 6+: 1/4096 base. Shiny Charm halves odds.
 */
function softResetRate(generation: number, charm: boolean): number {
  const base = generation >= 6 ? 1 / 4096 : 1 / 8192;
  return charm ? base * 2 : base;
}

/**
 * SOS Chain (Gen 7 only) single-encounter probability.
 * Chain length determines extra shiny rolls per encounter call.
 * 0–10: 1 roll, 11–20: 5, 21–30: 9, 31+: 13.
 */
function sosRolls(chainLength: number): number {
  if (chainLength <= 10) return 1;
  if (chainLength <= 20) return 5;
  if (chainLength <= 30) return 9;
  return 13;
}

function sosRate(chainLength: number, charm: boolean): number {
  const rolls = sosRolls(chainLength);
  const pRoll = charm ? 2 / 4096 : 1 / 4096;
  return 1 - Math.pow(1 - pRoll, rolls);
}

/** Single-encounter shiny probability for a hunt at its current state. */
export function shinyRate(hunt: ShinyHunt, generation: number): number {
  switch (hunt.method) {
    case "masuda":     return masudaRate(generation, hunt.hasShinyCharm);
    case "soft-reset": return softResetRate(generation, hunt.hasShinyCharm);
    case "sos-chain":  return sosRate(hunt.count, hunt.hasShinyCharm);
  }
}

/**
 * Cumulative probability of at least one shiny after `n` independent
 * encounters each with probability `p`.
 */
export function cumulativeProb(p: number, n: number): number {
  if (n <= 0 || p <= 0) return 0;
  return 1 - Math.pow(1 - p, n);
}

/**
 * The "expected" number of encounters for this rate — i.e. 1/p.
 * Used to color the luck meter.
 */
export function expectedEncounters(p: number): number {
  return p > 0 ? Math.round(1 / p) : Infinity;
}

// ─── Labels ────────────────────────────────────────────────────────────────

export const METHOD_LABELS: Record<ShinyMethod, string> = {
  "masuda":      "Masuda Method",
  "soft-reset":  "Soft Reset",
  "sos-chain":   "SOS Chain",
};

// ─── Storage ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "porylist-shiny-hunts-v1";

export function loadHunts(): ShinyHunt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ShinyHunt[];
  } catch {
    return [];
  }
}

export function saveHunts(hunts: ShinyHunt[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hunts));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function newHuntId(): string {
  return `hunt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
