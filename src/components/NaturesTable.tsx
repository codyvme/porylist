import { useState } from "react";
import { cn } from "@/lib/utils";

// ── Data ──────────────────────────────────────────────────────────────────────

const STATS = ["attack", "defense", "special-attack", "special-defense", "speed"] as const;
type Stat = typeof STATS[number];

const STAT_LABEL: Record<Stat, string> = {
  attack: "Attack",
  defense: "Defense",
  "special-attack": "Sp. Atk",
  "special-defense": "Sp. Def",
  speed: "Speed",
};

const STAT_ABBR: Record<Stat, string> = {
  attack: "Atk",
  defense: "Def",
  "special-attack": "SpA",
  "special-defense": "SpD",
  speed: "Spe",
};

// NATURE_MATRIX[boostStat][reduceStat] = nature name
// Diagonal entries are the 5 neutral natures.
const NATURE_MATRIX: Record<Stat, Record<Stat, string>> = {
  attack: {
    attack:           "Hardy",
    defense:          "Lonely",
    "special-attack": "Adamant",
    "special-defense":"Naughty",
    speed:            "Brave",
  },
  defense: {
    attack:           "Bold",
    defense:          "Docile",
    "special-attack": "Impish",
    "special-defense":"Lax",
    speed:            "Relaxed",
  },
  "special-attack": {
    attack:           "Modest",
    defense:          "Mild",
    "special-attack": "Bashful",
    "special-defense":"Rash",
    speed:            "Quiet",
  },
  "special-defense": {
    attack:           "Calm",
    defense:          "Gentle",
    "special-attack": "Careful",
    "special-defense":"Quirky",
    speed:            "Sassy",
  },
  speed: {
    attack:           "Timid",
    defense:          "Hasty",
    "special-attack": "Jolly",
    "special-defense":"Naive",
    speed:            "Serious",
  },
};


// ── Main component ─────────────────────────────────────────────────────────────

export function NaturesTable() {
  const [highlightBoost, setHighlightBoost] = useState<Stat | null>(null);
  const [highlightReduce, setHighlightReduce] = useState<Stat | null>(null);

  function toggleBoost(stat: Stat) {
    setHighlightBoost((prev) => (prev === stat ? null : stat));
    setHighlightReduce(null);
  }

  function toggleReduce(stat: Stat) {
    setHighlightReduce((prev) => (prev === stat ? null : stat));
    setHighlightBoost(null);
  }

  const hasFilter = highlightBoost !== null || highlightReduce !== null;

  return (
    <div className="flex h-full flex-col px-6">
      {/* ── Header ── */}
      <div className="shrink-0 flex items-center border-b border-border py-3 -mx-6 px-6">
        <h1 className="text-xl font-semibold">Natures</h1>
      </div>

      <div className="flex-1 overflow-auto pt-5 pb-8">

        {/* ── Matrix ── */}
        {(
          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              {/* Column header row */}
              <div
                className="grid"
                style={{ gridTemplateColumns: "116px repeat(5, 1fr)" }}
              >
                <div />
                {STATS.map((reduce) => (
                  <button
                    key={reduce}
                    onClick={() => toggleReduce(reduce)}
                    className={cn(
                      "pb-2 text-center text-xs font-semibold transition-colors rounded-sm",
                      highlightReduce === reduce
                        ? "text-rose-500"
                        : "text-muted-foreground hover:text-rose-400",
                    )}
                  >
                    <span className="opacity-60">−</span>{STAT_ABBR[reduce]}
                  </button>
                ))}
              </div>

              {/* Data rows */}
              <div className="rounded-xl border border-border overflow-hidden">
                {STATS.map((boost, bi) => (
                  <div
                    key={boost}
                    className={cn(
                      "grid",
                      bi > 0 && "border-t border-border",
                    )}
                    style={{ gridTemplateColumns: "116px repeat(5, 1fr)" }}
                  >
                    {/* Row header */}
                    <button
                      onClick={() => toggleBoost(boost)}
                      className={cn(
                        "flex items-center justify-end pr-3 py-2.5 text-xs font-semibold transition-colors border-r border-border",
                        highlightBoost === boost
                          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                          : "text-muted-foreground hover:text-emerald-500 bg-muted/30",
                      )}
                    >
                      <span className="opacity-60">+</span>{STAT_LABEL[boost]}
                    </button>

                    {/* Nature cells */}
                    {STATS.map((reduce, ri) => {
                      const name = NATURE_MATRIX[boost][reduce];
                      const isNeutral = boost === reduce;
                      const isBoostMatch = highlightBoost === boost;
                      const isReduceMatch = highlightReduce === reduce;
                      const isHighlighted = isBoostMatch || isReduceMatch;
                      const isDimmed = hasFilter && !isHighlighted;

                      return (
                        <div
                          key={reduce}
                          className={cn(
                            "flex items-center justify-center py-2.5 px-1 text-center transition-colors",
                            ri > 0 && "border-l border-border",
                            isHighlighted && !isNeutral && "bg-primary/10",
                            isNeutral && "bg-muted/30",
                            isDimmed && "opacity-25",
                          )}
                        >
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isNeutral ? "text-muted-foreground" : "text-foreground",
                            )}
                          >
                            {name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Matrix legend */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Diagonal = neutral (no stat change)</span>
                <span>Click a header to highlight that stat</span>
                {hasFilter && (
                  <button
                    onClick={() => { setHighlightBoost(null); setHighlightReduce(null); }}
                    className="text-primary hover:underline"
                  >
                    Clear highlight
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
