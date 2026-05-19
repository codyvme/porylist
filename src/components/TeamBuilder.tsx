import { useCallback, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Share2, Swords } from "lucide-react";
import { typeStyle } from "@/lib/types";
import { ALL_TYPES, computeTypeEffectiveness, offensiveCoverage } from "@/lib/type-chart";
import { useSinglePokemon, typesForGeneration } from "@/lib/pokeapi";
import { spriteUrl } from "@/lib/games";
import { cn, formatPokemonName } from "@/lib/utils";

function typeIconUrl(type: string) {
  return `https://cdn.jsdelivr.net/gh/partywhale/pokemon-type-icons@main/icons/${type}.svg`;
}

function multClass(mult: number) {
  if (mult === 0) return "bg-black text-white";
  if (mult === 0.25) return "bg-slate-600 text-slate-100";
  if (mult === 0.5) return "bg-slate-400/60 text-slate-900";
  if (mult === 2) return "bg-orange-500 text-white";
  if (mult === 4) return "bg-red-600 text-white";
  return "";
}

function multLabel(mult: number) {
  if (mult === 0) return "0×";
  if (mult === 0.25) return ".25×";
  if (mult === 0.5) return ".5×";
  if (mult === 2) return "2×";
  if (mult === 4) return "4×";
  return "";
}

interface Props {
  team: string[];
  onRemove: (name: string) => void;
  onClear: () => void;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}

export function TeamBuilder({ team, onRemove, onClear, expanded, onExpandedChange }: Props) {
  const [copied, setCopied] = useState(false);
  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const p0 = useSinglePokemon(team[0] ?? null);
  const p1 = useSinglePokemon(team[1] ?? null);
  const p2 = useSinglePokemon(team[2] ?? null);
  const p3 = useSinglePokemon(team[3] ?? null);
  const p4 = useSinglePokemon(team[4] ?? null);
  const p5 = useSinglePokemon(team[5] ?? null);

  const members = useMemo(() => {
    const queries = [p0.data, p1.data, p2.data, p3.data, p4.data, p5.data];
    return team.map((name, i) => {
      const pkmn = queries[i];
      if (!pkmn) return { name, types: [] as string[], id: 0, ready: false };
      return { name, types: typesForGeneration(pkmn, undefined), id: pkmn.id, ready: true };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, p0.data, p1.data, p2.data, p3.data, p4.data, p5.data]);

  const defensiveRows = useMemo(
    () => members.map(m => (m.ready ? computeTypeEffectiveness(m.types) : null)),
    [members],
  );

  const weaknessCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of ALL_TYPES) counts[t] = defensiveRows.filter(r => r && r[t] >= 2).length;
    return counts;
  }, [defensiveRows]);

  const covered = useMemo(
    () => offensiveCoverage(members.flatMap(m => m.types)),
    [members],
  );

  const sharedWeaknesses = useMemo(
    () =>
      ALL_TYPES
        .filter(t => weaknessCounts[t] >= 2)
        .map(t => ({ type: t, count: weaknessCounts[t] }))
        .sort((a, b) => b.count - a.count),
    [weaknessCounts],
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background shadow-[0_-2px_16px_rgba(0,0,0,0.12)]">
      {/* Always-visible header */}
      <div
        className="container flex h-14 cursor-pointer items-center justify-between gap-3"
        onClick={() => onExpandedChange(!expanded)}
        role="button"
        aria-label={expanded ? "Collapse team builder" : "Expand team builder"}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Swords className="h-4 w-4" />
            Team Builder
          </div>

          {/* 6 mini slots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => {
              const m = members[i];
              return (
                <div
                  key={i}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded border",
                    m ? "border-border bg-white" : "border-dashed border-muted-foreground/25",
                  )}
                >
                  {m ? (
                    <>
                      <img src={spriteUrl(m.id, undefined)} alt={m.name} className="h-9 w-9 object-contain" />
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemove(m.name); }}
                        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white shadow"
                        aria-label={`Remove ${m.name}`}
                      >×</button>
                    </>
                  ) : (
                    <span className="font-mono text-[10px] text-muted-foreground/30">{i + 1}</span>
                  )}
                </div>
              );
            })}
          </div>

          <span className="text-xs text-muted-foreground">{team.length}/6</span>

          {team.length > 0 && (
            <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
              Clear all
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {team.length > 0 && (
            <div className="group relative">
              <button
                onClick={(e) => { e.stopPropagation(); handleShare(); }}
                className="rounded-full p-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Copy shareable link"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4" />}
              </button>
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[11px] text-background opacity-0 transition-opacity group-hover:opacity-100">
                {copied ? "Copied!" : "Copy shareable link"}
              </div>
            </div>
          )}
          <div className="rounded-full p-2 text-muted-foreground">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {/* Expanded analysis */}
      {expanded && (
        <div className="border-t">
          <div className="container py-4">
            {team.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Click <strong className="text-foreground">+</strong> on any Pokémon to add it to your team.
              </p>
            ) : (
              <div className="max-h-80 space-y-5 overflow-y-auto pr-1">
                {/* Shared Weaknesses */}
                {sharedWeaknesses.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Shared Weaknesses
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sharedWeaknesses.map(({ type, count }) => (
                        <span key={type} className="flex items-center gap-1">
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
                            style={typeStyle(type)}
                          >
                            {type}
                          </span>
                          <span className="text-xs text-muted-foreground">{count}×</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Defensive matchups */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Defensive Matchups
                  </p>
                  <div className="overflow-x-auto">
                    <table className="border-collapse text-xs">
                      <thead>
                        <tr>
                          <th className="w-28 pr-3" />
                          {ALL_TYPES.map(t => (
                            <th key={t} className="w-9 border-l border-border/60 pb-1 text-center">
                              <img
                                src={typeIconUrl(t)}
                                alt={t}
                                title={t}
                                className="mx-auto h-5 w-5"
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m, i) => (
                          <tr key={m.name} className={i % 2 === 1 ? "bg-muted/70" : ""}>
                            <td className="max-w-[7rem] truncate py-1 pr-3 font-medium" title={formatPokemonName(m.name)}>
                              {formatPokemonName(m.name)}
                            </td>
                            {ALL_TYPES.map(t => {
                              const mult = defensiveRows[i]?.[t] ?? 1;
                              const cls = multClass(mult);
                              return (
                                <td
                                  key={t}
                                  className={cn("w-9 rounded py-1 text-center text-[10px] font-semibold border-l border-border/60", cls)}
                                  title={`${t}: ${mult}×`}
                                >
                                  {cls ? multLabel(mult) : ""}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {/* Weakness count totals row */}
                        <tr className="border-t border-border/60">
                          <td className="pr-3 pt-1.5 text-[11px] font-medium text-muted-foreground">Weaknesses</td>
                          {ALL_TYPES.map(t => {
                            const count = weaknessCounts[t];
                            return (
                              <td
                                key={t}
                                className={cn(
                                  "w-9 border-l border-border/60 pt-1.5 text-center text-[10px] font-bold",
                                  count >= 2 ? "text-red-500" : count === 1 ? "text-orange-400" : "text-transparent",
                                )}
                              >
                                {count > 0 ? count : "·"}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Offensive coverage */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Offensive Coverage <span className="font-normal normal-case">(STAB)</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_TYPES.map(t => (
                      <span
                        key={t}
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize transition-opacity",
                          covered.has(t) ? "opacity-100" : "opacity-20",
                        )}
                        style={typeStyle(t)}
                        title={covered.has(t) ? `STAB coverage vs ${t}` : `No STAB coverage vs ${t}`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  {team.length > 0 && (() => {
                    const uncovered = ALL_TYPES.filter(t => !covered.has(t));
                    if (uncovered.length === 0) return null;
                    return (
                      <div className="mt-2">
                        <p className="mb-1.5 text-xs text-muted-foreground">
                          No super-effective coverage vs:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {uncovered.map(t => (
                            <span
                              key={t}
                              className="rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
                              style={typeStyle(t)}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
