// Type-matchup helpers shared by the playthrough battle-prep view.
// Built on top of computeTypeEffectiveness so all generation patches apply.

import { computeTypeEffectiveness } from "@/lib/type-chart";

export interface BestOffense {
  /** Best damage multiplier the attacker's STAB types reach against the defender. */
  mult: number;
  /** Which attacking type achieves that multiplier (null when neutral / no types). */
  type: string | null;
}

/**
 * The best multiplier the attacker's STAB types achieve against the defending
 * types, and which type achieves it. Returns neutral (1×) when the attacker has
 * no usable types.
 */
export function bestStabMultiplier(
  attackerTypes: string[],
  defenderTypes: string[],
  generation = 9,
): BestOffense {
  if (attackerTypes.length === 0) return { mult: 1, type: null };
  const eff = computeTypeEffectiveness(defenderTypes, generation);
  let best: BestOffense = { mult: -1, type: null };
  for (const atk of attackerTypes) {
    const mult = eff[atk] ?? 1;
    if (mult > best.mult) best = { mult, type: atk };
  }
  return best.type ? best : { mult: 1, type: null };
}

/**
 * Of the given attacking move types, which ones hit the defender for 2×+.
 * Deduplicated, order preserved.
 */
export function threateningTypes(
  defenderTypes: string[],
  attackMoveTypes: string[],
  generation = 9,
): string[] {
  if (defenderTypes.length === 0) return [];
  const eff = computeTypeEffectiveness(defenderTypes, generation);
  const out: string[] = [];
  for (const t of attackMoveTypes) {
    if (!t) continue;
    if ((eff[t] ?? 1) >= 2 && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Human-readable multiplier label: 0, ¼×, ½×, 1×, 2×, 4×. */
export function formatMultiplier(mult: number): string {
  if (mult === 0) return "0";
  if (mult === 0.25) return "¼×";
  if (mult === 0.5) return "½×";
  return `${mult}×`;
}

export type MatchupTone = "great" | "good" | "neutral" | "bad" | "immune";

/** Bucket a multiplier into a qualitative tone for color styling. */
export function matchupTone(mult: number): MatchupTone {
  if (mult === 0) return "immune";
  if (mult >= 4) return "great";
  if (mult >= 2) return "good";
  if (mult < 1) return "bad";
  return "neutral";
}
