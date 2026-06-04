import { useMemo } from "react";
import { GameFilter } from "@/components/GameFilter";
import { Tooltip } from "@/components/ui/tooltip";
import { ALL_TYPES, computeTypeEffectiveness } from "@/lib/type-chart";
import { cn } from "@/lib/utils";
import { type GameOption } from "@/lib/games";

const TYPE_ICON_BASE = "https://cdn.jsdelivr.net/gh/partywhale/pokemon-type-icons@main/icons";
function typeIconUrl(type: string) {
  return `${TYPE_ICON_BASE}/${type}.svg`;
}

function excludedForGen(gen: number): Set<string> {
  if (gen === 1) return new Set(["dark", "steel", "fairy"]);
  if (gen <= 5) return new Set(["fairy"]);
  return new Set();
}

export function TypeChartPage({ game }: { game: GameOption | null }) {
  const generation = game?.generation ?? 9;

  const types = useMemo(() => {
    const excl = excludedForGen(generation);
    return ALL_TYPES.filter((t) => !excl.has(t));
  }, [generation]);

  // matrix[atkIdx][defIdx] = multiplier when atkType attacks defType
  const matrix = useMemo(
    () =>
      types.map((atkType) =>
        types.map((defType) => {
          const eff = computeTypeEffectiveness([defType], generation);
          return eff[atkType] ?? 1;
        }),
      ),
    [types, generation],
  );

  const genLabel =
    generation === 1
      ? "Gen 1 — Dark, Steel & Fairy not yet introduced"
      : generation <= 5
        ? "Gen 2–5 — Fairy not yet introduced; Ghost/Dark resist Steel removed in Gen 6"
        : "Gen 6+ (current)";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-6">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 border-b border-border py-3 -mx-6 px-6">
        <h1 className="flex-1 text-xl font-semibold">Type Chart</h1>
        <GameFilter />
      </div>

      {/* Legend */}
      <div className="flex shrink-0 items-center gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-6 items-center justify-center rounded-sm bg-green-500 text-white text-[10px] font-bold">2</span>
          <span className="text-muted-foreground">Super effective</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-6 items-center justify-center rounded-sm bg-muted text-muted-foreground/40 text-[10px]">·</span>
          <span className="text-muted-foreground">Normal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-6 items-center justify-center rounded-sm bg-red-500 text-white text-[10px] font-bold">½</span>
          <span className="text-muted-foreground">Not very effective</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-6 items-center justify-center rounded-sm bg-slate-600 dark:bg-slate-500 text-white text-[10px] font-bold">0</span>
          <span className="text-muted-foreground">No effect (immune)</span>
        </div>
      </div>

      {/* Table */}
      {/* gen label sits above the chart */}
      <p className="shrink-0 text-xs text-muted-foreground">{genLabel} · ATK ↓ vs. DEF →</p>

      {/* Single scroll container — both axes */}
      <div className="flex-1 overflow-auto pb-6">
        <div className="flex">
          {/* Row-label icons — sticky to left, scrolls vertically with the table */}
          <div
            className="sticky left-0 z-20 shrink-0 bg-background flex flex-col"
            style={{ gap: "2px", paddingTop: "2.25rem" }}
          >
            {types.map((atkType) => (
              <Tooltip key={atkType} content={atkType.charAt(0).toUpperCase() + atkType.slice(1)} side="right">
                <img src={typeIconUrl(atkType)} alt={atkType} className="block h-7 w-7" />
              </Tooltip>
            ))}
          </div>

          {/* Table — column headers sticky to top */}
          <table style={{ borderCollapse: "separate", borderSpacing: "2px" }}>
            <thead>
              <tr>
                {types.map((defType) => (
                  <th key={defType} className="sticky top-0 z-10 bg-background p-0 pb-1 align-bottom">
                    <Tooltip content={defType.charAt(0).toUpperCase() + defType.slice(1)}>
                      <img src={typeIconUrl(defType)} alt={defType} className="mx-auto h-7 w-7" />
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {types.map((atkType, atkIdx) => (
                <tr key={atkType}>
                  {types.map((_defType, defIdx) => {
                    const m = matrix[atkIdx][defIdx];
                    const isSuper = m >= 2;
                    const isWeak = m > 0 && m < 1;
                    const isImmune = m === 0;
                    return (
                      <td key={defIdx} className="p-0">
                        <div
                          className={cn(
                            "w-8 h-7 text-xs font-bold flex items-center justify-center rounded-sm select-none",
                            isImmune
                              ? "bg-slate-600 dark:bg-slate-500 text-white"
                              : isSuper
                                ? "bg-green-500 text-white"
                                : isWeak
                                  ? "bg-red-500 text-white"
                                  : "bg-muted/30 text-muted-foreground/30",
                          )}
                        >
                          {isImmune ? "0" : isSuper ? "2" : isWeak ? "½" : "·"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
