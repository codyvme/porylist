import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, Share2, X } from "lucide-react";
import { typeStyle } from "@/lib/types";
import { ALL_TYPES, computeTypeEffectiveness, offensiveCoverage } from "@/lib/type-chart";
import { useSinglePokemon, usePokemonSummaryList, typesForGeneration } from "@/lib/pokeapi";
import { SPRITES_ROOT, spriteUrl } from "@/lib/games";
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
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onClear: () => void;
}

export function TeamBuilder({ team, onAdd, onRemove, onClear }: Props) {
  const [copied, setCopied] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const summaryList = usePokemonSummaryList().data ?? [];

  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const alreadyOnTeam = new Set(team);
    return summaryList
      .filter(p => !alreadyOnTeam.has(p.name) && (
        p.name.includes(q) || formatPokemonName(p.name).toLowerCase().includes(q)
      ))
      .slice(0, 8);
  }, [searchQuery, summaryList, team]);

  // Close search when clicking outside
  useEffect(() => {
    if (activeSlot === null) return;
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setActiveSlot(null);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [activeSlot]);
  const handleShare = useCallback(() => {
    const url = new URL(window.location.href);
    url.pathname = "/team";
    url.searchParams.set("team", team.join(","));
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [team]);

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
    <div className="flex flex-col gap-6 px-6 pb-6">
      {/* Page header */}
      <div className="shrink-0 flex items-center gap-3 border-b border-border py-3 -mx-6 px-6">
        <h1 className="flex-1 text-xl font-semibold">Team Builder</h1>
        {team.length > 0 && (
          <>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              aria-label="Copy shareable link"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4" />}
              {copied ? "Copied!" : "Share"}
            </button>
            <button
              onClick={onClear}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            >
              Clear all
            </button>
          </>
        )}
      </div>

      {/* Team slots */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => {
          const m = members[i];
          return (
            <div
              key={i}
              ref={activeSlot === i ? searchRef : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-lg border p-2",
                m ? "border-border bg-card" : "border-dashed border-muted-foreground/25",
                !m && activeSlot !== i && "cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors",
              )}
              onClick={!m && activeSlot !== i ? () => { setActiveSlot(i); setSearchQuery(""); setTimeout(() => inputRef.current?.focus(), 0); } : undefined}
            >
              {m ? (
                <>
                  <img
                    src={spriteUrl(m.id, undefined)}
                    alt={m.name}
                    className="h-16 w-16 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).src = `${SPRITES_ROOT}/${m.id}.png`; }}
                  />
                  <span className="max-w-full truncate text-center text-xs font-medium">
                    {formatPokemonName(m.name)}
                  </span>
                  <button
                    onClick={() => onRemove(m.name)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[11px] text-white shadow hover:bg-destructive/80 transition-colors"
                    aria-label={`Remove ${m.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : activeSlot === i ? (
                <>
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search…"
                    className="w-full bg-transparent text-center text-xs outline-none placeholder:text-muted-foreground/50"
                    onKeyDown={(e) => { if (e.key === "Escape") { setActiveSlot(null); setSearchQuery(""); } }}
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-lg border bg-background shadow-lg">
                      {suggestions.map(p => (
                        <button
                          key={p.name}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            onAdd(p.name);
                            setActiveSlot(null);
                            setSearchQuery("");
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                        >
                          <img src={`${SPRITES_ROOT}/${p.id}.png`} alt={p.name} className="h-6 w-6 object-contain" />
                          {formatPokemonName(p.name)}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center">
                  <Plus className="h-5 w-5 text-muted-foreground/30" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {team.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          Click a slot above to search for a Pokémon and build your team.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Shared Weaknesses */}
          {sharedWeaknesses.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Shared Weaknesses
              </h2>
              <div className="flex flex-wrap gap-2">
                {sharedWeaknesses.map(({ type, count }) => (
                  <span key={type} className="flex items-center gap-1.5">
                    <span
                      className="rounded px-2 py-0.5 text-xs font-semibold capitalize"
                      style={typeStyle(type)}
                    >
                      {type}
                    </span>
                    <span className="text-xs text-muted-foreground">{count} members</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Defensive matchups */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Defensive Matchups
            </h2>
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
                      <td className="max-w-[7rem] truncate py-1.5 pr-3 font-medium" title={formatPokemonName(m.name)}>
                        {formatPokemonName(m.name)}
                      </td>
                      {ALL_TYPES.map(t => {
                        const mult = defensiveRows[i]?.[t] ?? 1;
                        const cls = multClass(mult);
                        return (
                          <td
                            key={t}
                            className={cn("w-9 rounded py-1.5 text-center text-[10px] font-semibold border-l border-border/60", cls)}
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
                    <td className="pr-3 pt-2 text-[11px] font-medium text-muted-foreground">Weaknesses</td>
                    {ALL_TYPES.map(t => {
                      const count = weaknessCounts[t];
                      return (
                        <td
                          key={t}
                          className={cn(
                            "w-9 border-l border-border/60 pt-2 text-center text-[10px] font-bold",
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
          </section>

          {/* Offensive coverage */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Offensive Coverage <span className="font-normal normal-case">(STAB)</span>
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TYPES.map(t => (
                <span
                  key={t}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs font-semibold capitalize transition-opacity",
                    covered.has(t) ? "opacity-100" : "opacity-20",
                  )}
                  style={typeStyle(t)}
                  title={covered.has(t) ? `STAB coverage vs ${t}` : `No STAB coverage vs ${t}`}
                >
                  {t}
                </span>
              ))}
            </div>
            {(() => {
              const uncovered = ALL_TYPES.filter(t => !covered.has(t));
              if (uncovered.length === 0) return null;
              return (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs text-muted-foreground">
                    No super-effective coverage vs:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {uncovered.map(t => (
                      <span
                        key={t}
                        className="rounded px-1.5 py-0.5 text-xs font-semibold capitalize"
                        style={typeStyle(t)}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </section>
        </div>
      )}
    </div>
  );
}
