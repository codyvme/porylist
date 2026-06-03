import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  usePokemonSummaryList,
  usePokemonSpecies,
  typesForGeneration,
  type PokemonSummary,
} from "@/lib/pokeapi";
import { type GameOption, spriteUrl } from "@/lib/games";
import { computeTypeEffectiveness } from "@/lib/type-chart";
import { TYPE_COLORS } from "@/lib/types";
import { formatPokemonName, cn } from "@/lib/utils";
import { GameFilter } from "@/components/GameFilter";
import { SpriteImg } from "@/components/SpriteImg";
import { PokemonSearch } from "@/components/PokemonSearch";

// ── Constants ─────────────────────────────────────────────────────────────────

const STAT_ORDER_MODERN = [
  "hp",
  "attack",
  "defense",
  "special-attack",
  "special-defense",
  "speed",
] as const;

// Gen 1 had a single "Special" stat instead of Sp. Atk + Sp. Def
const STAT_ORDER_GEN1 = ["hp", "attack", "defense", "special", "speed"] as const;

const STAT_ABBR: Record<string, string> = {
  hp: "HP",
  attack: "Atk",
  defense: "Def",
  "special-attack": "SpA",
  "special-defense": "SpD",
  special: "Spc",
  speed: "Spe",
};

const STAT_MAX = 255;

const MATCHUP_BUCKETS = [4, 2, 0.5, 0.25, 0] as const;
const MATCHUP_LABELS: Record<number, string> = { 4: "4×", 2: "2×", 0.5: "½×", 0.25: "¼×", 0: "0×" };

const GROWTH_LABELS: Record<string, string> = {
  slow: "Slow",
  medium: "Medium",
  fast: "Fast",
  "medium-slow": "Medium Slow",
  "slow-then-very-fast": "Erratic",
  "fast-then-very-slow": "Fluctuating",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStat(p: PokemonSummary | null, name: string): number | null {
  if (!p) return null;
  // "special" is a virtual stat for Gen 1 — proxy via special-attack
  const lookupName = name === "special" ? "special-attack" : name;
  return p.stats.find((s) => s.stat.name === lookupName)?.base_stat ?? null;
}

function getBST(p: PokemonSummary | null, gen1 = false): number | null {
  if (!p) return null;
  if (gen1) {
    // Gen 1 BST = HP + Atk + Def + Special + Speed (5 stats, Special proxied by SpA)
    const names = ["hp", "attack", "defense", "special-attack", "speed"];
    return p.stats
      .filter((s) => names.includes(s.stat.name))
      .reduce((a, s) => a + s.base_stat, 0);
  }
  return p.stats.reduce((a, s) => a + s.base_stat, 0);
}

function winnerIndices(values: (number | null)[]): Set<number> {
  const nonNull = values.filter((v) => v !== null) as number[];
  if (nonNull.length <= 1) return new Set();
  const max = Math.max(...nonNull);
  const winners = new Set<number>();
  values.forEach((v, i) => { if (v === max) winners.add(i); });
  return winners;
}

function formatHeight(dm: number): string {
  const totalInches = Math.round((dm / 10) * 39.3701);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

function formatWeight(hg: number): string {
  return `${((hg / 10) * 2.20462).toFixed(1)} lbs`;
}

function typesInBucket(matchup: Record<string, number> | null, mult: number): string[] {
  if (!matchup) return [];
  return Object.entries(matchup)
    .filter(([, v]) => v === mult)
    .map(([k]) => k)
    .sort();
}

// ── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize text-white"
      style={{ backgroundColor: TYPE_COLORS[type] ?? "#999" }}
    >
      {type}
    </span>
  );
}

// ── Gender bar ────────────────────────────────────────────────────────────────

function GenderBar({ rate }: { rate: number }) {
  if (rate === -1) return <span className="text-sm text-muted-foreground">Genderless</span>;
  const femalePct = (rate / 8) * 100;
  const malePct = 100 - femalePct;
  return (
    <div className="flex items-center gap-1.5 w-full">
      <span className="shrink-0 text-xs font-medium text-blue-400">♂{malePct}%</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full">
        <div className="flex h-full">
          {malePct > 0 && <div className="h-full bg-blue-400" style={{ width: `${malePct}%` }} />}
          {femalePct > 0 && <div className="h-full bg-pink-400" style={{ width: `${femalePct}%` }} />}
        </div>
      </div>
      <span className="shrink-0 text-xs font-medium text-pink-400">♀{femalePct}%</span>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mt-6 mb-2 flex items-center gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

// ── Comparison row (label + 3 data cells) ────────────────────────────────────

function CompareRow({
  label,
  children,
  separator = true,
  alignTop = false,
}: {
  label: string;
  children: React.ReactNode;
  separator?: boolean;
  alignTop?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[88px_1fr_1fr_1fr] gap-x-4 px-4 py-2.5",
        separator && "border-t border-border",
        alignTop ? "items-start" : "items-center",
      )}
    >
      <span className="text-xs font-medium text-muted-foreground leading-5">{label}</span>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CompareView({ game }: { game: GameOption | null }) {
  const { data: list } = usePokemonSummaryList();
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse slot names from URL (?compare=pikachu,charizard,blastoise)
  const [slotNames, setSlotNames] = useState<[string | null, string | null, string | null]>(() => {
    const raw = searchParams.get("compare") ?? "";
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return [parts[0] ?? null, parts[1] ?? null, parts[2] ?? null];
  });

  // Sync slot names → URL
  useEffect(() => {
    const names = slotNames.filter(Boolean) as string[];
    if (names.length > 0) {
      setSearchParams({ compare: names.join(",") }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [slotNames, setSearchParams]);

  // Resolve names → PokemonSummary
  const slots = useMemo((): [PokemonSummary | null, PokemonSummary | null, PokemonSummary | null] => {
    if (!list) return [null, null, null];
    return slotNames.map((name) =>
      name ? (list.find((p) => p.name === name) ?? null) : null,
    ) as [PokemonSummary | null, PokemonSummary | null, PokemonSummary | null];
  }, [list, slotNames]);

  // Always fetch species for all 3 slots (hooks can't be conditional)
  const sp0 = usePokemonSpecies(slots[0]?.species.name ?? null);
  const sp1 = usePokemonSpecies(slots[1]?.species.name ?? null);
  const sp2 = usePokemonSpecies(slots[2]?.species.name ?? null);
  const speciesData = [sp0.data, sp1.data, sp2.data];
  const speciesLoading = [sp0.isLoading, sp1.isLoading, sp2.isLoading];

  function setSlot(i: number, pokemon: PokemonSummary | null) {
    setSlotNames((prev) => {
      const next = [...prev] as [string | null, string | null, string | null];
      next[i] = pokemon?.name ?? null;
      return next;
    });
  }

  const generation = game?.generation ?? 9;

  // Game-aware types for each slot
  const slotTypes = slots.map((p) =>
    p ? typesForGeneration(p, game?.generation) : null,
  );

  // Defensive type matchups for each slot
  const slotMatchups = slotTypes.map((types) =>
    types ? computeTypeEffectiveness(types, generation) : null,
  );

  const anyFilled = slots.some((s) => s !== null);

  return (
    <div className="flex h-full flex-col px-6">
      {/* ── Page header ── */}
      <div className="shrink-0 flex items-center gap-3 border-b border-border py-3 -mx-6 px-6">
        <h1 className="flex-1 text-xl font-semibold">Compare</h1>
        <GameFilter />
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-auto pt-5 pb-8">
        {/* Horizontal scroll wrapper for narrow viewports */}
        <div className="overflow-x-auto">
          <div className="min-w-[540px]">

            {/* ── Slot pickers ── */}
            <div className="grid grid-cols-3 gap-3">
              {([0, 1, 2] as const).map((i) => (
                <PokemonSearch
                  key={i}
                  value={slots[i]?.name ?? null}
                  game={game ?? undefined}
                  maxResults={60}
                  placeholder="Choose Pokémon…"
                  onChange={(name) => setSlot(i, name ? ((list ?? []).find((p) => p.name === name) ?? null) : null)}
                />
              ))}
            </div>

            {/* ── Identity cards ── */}
            <div className="mt-3 grid grid-cols-3 gap-3">
              {([0, 1, 2] as const).map((i) => {
                const p = slots[i];
                const types = slotTypes[i];
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/20 py-5 px-3 min-h-[140px] justify-center",
                      !p && "opacity-40",
                    )}
                  >
                    {p ? (
                      <>
                        <SpriteImg src={spriteUrl(p.id, game?.spriteVersion)} alt={p.name} size="h-20 w-20" />
                        <div className="text-center">
                          <p className="text-sm font-semibold leading-tight">
                            {formatPokemonName(p.name)}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-1">
                          {types?.map((t) => <TypeBadge key={t} type={t} />)}
                        </div>
                      </>
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-border">
                        <span className="text-xl text-muted-foreground">?</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Empty state ── */}
            {!anyFilled && (
              <div className="mt-14 flex flex-col items-center gap-3 text-center text-muted-foreground">
                <p className="text-sm">Choose up to 3 Pokémon above to compare them.</p>
              </div>
            )}

            {anyFilled && (
              <>
                {/* ══ Base Stats ══ */}
                {(() => {
                  const isGen1 = generation === 1;
                  const statOrder = isGen1 ? STAT_ORDER_GEN1 : STAT_ORDER_MODERN;
                  return (
                    <>
                      <SectionHeader title={isGen1 ? "Base Stats (Gen 1)" : "Base Stats"} />
                      <div className="rounded-xl border border-border overflow-hidden">
                        {statOrder.map((statName, ri) => {
                          const values = slots.map((p) => getStat(p, statName));
                          const winners = winnerIndices(values);
                          return (
                            <div
                              key={statName}
                              className={cn("grid grid-cols-3", ri > 0 && "border-t border-border")}
                            >
                              {values.map((val, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-2.5",
                                    i > 0 && "border-l border-border",
                                  )}
                                >
                                  <span className="w-7 shrink-0 text-xs font-medium text-muted-foreground">
                                    {STAT_ABBR[statName]}
                                  </span>
                                  <span
                                    className={cn(
                                      "w-7 shrink-0 text-right text-sm font-semibold tabular-nums",
                                      winners.has(i)
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-foreground",
                                    )}
                                  >
                                    {val ?? "—"}
                                  </span>
                                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                    {val !== null && (
                                      <div
                                        className={cn(
                                          "h-full rounded-full",
                                          winners.has(i) ? "bg-emerald-500" : "bg-primary",
                                        )}
                                        style={{ width: `${(val / STAT_MAX) * 100}%` }}
                                      />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}

                        {/* BST total row */}
                        {(() => {
                          const bsts = slots.map((p) => getBST(p, isGen1));
                          const winners = winnerIndices(bsts);
                          return (
                            <div className="grid grid-cols-3 border-t border-border bg-muted/30">
                              {bsts.map((val, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-2.5",
                                    i > 0 && "border-l border-border",
                                  )}
                                >
                                  <span className="w-7 shrink-0 text-xs font-bold text-foreground">BST</span>
                                  <span
                                    className={cn(
                                      "text-sm font-bold tabular-nums",
                                      winners.has(i)
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-foreground",
                                    )}
                                  >
                                    {val ?? "—"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  );
                })()}

                {/* ══ Abilities ══ */}
                <SectionHeader title="Abilities" />
                <div className="rounded-xl border border-border overflow-hidden">
                  {([
                    { label: "Ability 1", test: (a: { slot: number; is_hidden: boolean }) => a.slot === 1 && !a.is_hidden },
                    { label: "Ability 2", test: (a: { slot: number; is_hidden: boolean }) => a.slot === 2 && !a.is_hidden },
                    { label: "Hidden",    test: (a: { slot: number; is_hidden: boolean }) => a.is_hidden },
                  ] as const).map(({ label, test }, ri) => {
                    const abilities = slots.map((p) =>
                      p ? (p.abilities.find(test) ?? null) : null,
                    );
                    if (abilities.every((a) => a === null)) return null;
                    return (
                      <CompareRow key={label} label={label} separator={ri > 0}>
                        {abilities.map((a, i) => (
                          <span key={i} className="text-sm">
                            {slots[i] === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : a ? (
                              <span className="font-medium">
                                {formatPokemonName(a.ability.name)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </span>
                        ))}
                      </CompareRow>
                    );
                  })}
                </div>

                {/* ══ Type Matchups ══ */}
                <SectionHeader
                  title={`Type Matchups${game ? ` · ${game.label}` : ""}`}
                />
                <div className="rounded-xl border border-border overflow-hidden">
                  {MATCHUP_BUCKETS.map((mult, ri) => {
                    const bucketTypes = slotMatchups.map((m) => typesInBucket(m, mult));
                    if (bucketTypes.every((t) => t.length === 0)) return null;
                    return (
                      <CompareRow key={mult} label={MATCHUP_LABELS[mult]} separator={ri > 0} alignTop>
                        {bucketTypes.map((types, i) => (
                          <div key={i} className="flex flex-wrap gap-1 py-0.5">
                            {slots[i] === null ? null : types.length > 0 ? (
                              types.map((t) => <TypeBadge key={t} type={t} />)
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        ))}
                      </CompareRow>
                    );
                  })}
                </div>

                {/* ══ Pokémon Info ══ */}
                <SectionHeader title="Pokémon Info" />
                <div className="rounded-xl border border-border overflow-hidden">
                  {/* Height */}
                  <CompareRow label="Height" separator={false}>
                    {slots.map((p, i) => (
                      <span key={i} className="text-sm">
                        {p ? formatHeight(p.height) : <span className="text-muted-foreground">—</span>}
                      </span>
                    ))}
                  </CompareRow>

                  {/* Weight */}
                  <CompareRow label="Weight">
                    {slots.map((p, i) => (
                      <span key={i} className="text-sm">
                        {p ? formatWeight(p.weight) : <span className="text-muted-foreground">—</span>}
                      </span>
                    ))}
                  </CompareRow>

                  {/* Catch Rate */}
                  <CompareRow label="Catch Rate">
                    {slots.map((p, i) => {
                      const s = speciesData[i];
                      const loading = speciesLoading[i];
                      return (
                        <span key={i} className="text-sm">
                          {p === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : loading ? (
                            <span className="inline-block h-3 w-8 skeleton-shimmer rounded" />
                          ) : s ? (
                            s.capture_rate
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </span>
                      );
                    })}
                  </CompareRow>

                  {/* Gender Ratio */}
                  <CompareRow label="Gender">
                    {slots.map((p, i) => {
                      const s = speciesData[i];
                      const loading = speciesLoading[i];
                      return (
                        <div key={i} className="min-w-0">
                          {p === null ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : loading ? (
                            <span className="inline-block h-3 w-24 skeleton-shimmer rounded" />
                          ) : s ? (
                            <GenderBar rate={s.gender_rate} />
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>
                      );
                    })}
                  </CompareRow>

                  {/* Egg Groups */}
                  <CompareRow label="Egg Groups">
                    {slots.map((p, i) => {
                      const s = speciesData[i];
                      const loading = speciesLoading[i];
                      return (
                        <span key={i} className="text-sm">
                          {p === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : loading ? (
                            <span className="inline-block h-3 w-20 skeleton-shimmer rounded" />
                          ) : s ? (
                            s.egg_groups.map((g) => formatPokemonName(g.name)).join(", ")
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </span>
                      );
                    })}
                  </CompareRow>

                  {/* Exp. Growth */}
                  <CompareRow label="Exp. Growth">
                    {slots.map((p, i) => {
                      const s = speciesData[i];
                      const loading = speciesLoading[i];
                      return (
                        <span key={i} className="text-sm">
                          {p === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : loading ? (
                            <span className="inline-block h-3 w-20 skeleton-shimmer rounded" />
                          ) : s ? (
                            GROWTH_LABELS[s.growth_rate.name] ??
                            formatPokemonName(s.growth_rate.name)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </span>
                      );
                    })}
                  </CompareRow>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
