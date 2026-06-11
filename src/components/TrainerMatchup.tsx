import { useMemo } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { usePokemonSummaryMap, typesForGeneration, type TrainerEntry, type PokemonSummary } from "@/lib/pokeapi";
import { SPRITES_ROOT, type GameOption } from "@/lib/games";
import { computeTypeEffectiveness, ALL_TYPES } from "@/lib/type-chart";
import { SpriteImg } from "@/components/SpriteImg";
import { TypeBadge } from "@/components/TypeBadge";
import { formatPokemonName, cn } from "@/lib/utils";
import type { TeamMember } from "@/lib/playthroughs";
import {
  bestStabMultiplier,
  threateningTypes,
  formatMultiplier,
  matchupTone,
  type MatchupTone,
} from "@/lib/matchup";

interface Props {
  trainer: TrainerEntry;
  yourTeam: TeamMember[];
  game: GameOption | undefined;
  /** Gym leader's type specialty, when they have one — drives the "bring these" hint. */
  typeSpecialty?: string | null;
  onOpenPokemon: (species: string) => void;
}

const TONE_CELL: Record<MatchupTone, string> = {
  great: "bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold",
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium",
  neutral: "text-muted-foreground/40",
  bad: "bg-red-500/10 text-red-600 dark:text-red-400",
  immune: "bg-red-500/25 text-red-700 dark:text-red-300 font-medium",
};

/**
 * Battle-prep grid: the player's run team vs. a trainer's team. Each cell shows
 * the best STAB multiplier the player's Pokémon reaches against that opponent.
 * Below the grid, a defensive read of which opponents' move types threaten each
 * of the player's Pokémon.
 */
export function TrainerMatchup({ trainer, yourTeam, game, typeSpecialty, onOpenPokemon }: Props) {
  const { data: summaryByName = new Map<string, PokemonSummary>() } = usePokemonSummaryMap();
  const gen = game?.generation;

  // Types that hit the leader's specialty for 2×+ — what to bring against them.
  const counterTypes = useMemo(() => {
    if (!typeSpecialty) return [];
    const eff = computeTypeEffectiveness([typeSpecialty], gen ?? 9);
    return ALL_TYPES.filter((t) => (eff[t] ?? 1) >= 2);
  }, [typeSpecialty, gen]);

  const yourMons = useMemo(
    () =>
      yourTeam
        .map((m) => {
          const summary = summaryByName.get(m.species);
          if (!summary) return null;
          return { member: m, summary, types: typesForGeneration(summary, gen) };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [yourTeam, summaryByName, gen],
  );

  const oppMons = useMemo(
    () =>
      trainer.team.map((mon) => {
        const summary = summaryByName.get(mon.species);
        return {
          mon,
          types: summary ? typesForGeneration(summary, gen) : [],
          moveTypes: mon.moves.map((mv) => mv.type).filter((t): t is string => !!t),
        };
      }),
    [trainer.team, summaryByName, gen],
  );

  // Every damaging move type the trainer carries — used for the defensive read.
  const allOppMoveTypes = useMemo(
    () => [...new Set(oppMons.flatMap((o) => o.moveTypes))],
    [oppMons],
  );

  // Defensive threats: which of the trainer's move types hit each of your mons SE.
  const threatsByMon = useMemo(
    () => yourMons.map((y) => threateningTypes(y.types, allOppMoveTypes, gen)),
    [yourMons, allOppMoveTypes, gen],
  );

  const answeredCount = useMemo(
    () =>
      oppMons.filter((o) =>
        yourMons.some((y) => bestStabMultiplier(y.types, o.types, gen).mult >= 2),
      ).length,
    [oppMons, yourMons, gen],
  );
  const threatenedCount = threatsByMon.filter((t) => t.length > 0).length;
  const oppMaxLevel = useMemo(
    () => oppMons.reduce((mx, o) => Math.max(mx, o.mon.level ?? 0), 0),
    [oppMons],
  );

  const specialtyHint = typeSpecialty && counterTypes.length > 0 && (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
      <span className="text-muted-foreground">
        {trainer.name} specializes in <TypeBadge type={typeSpecialty} size="sm" className="mx-0.5" /> — bring
      </span>
      {counterTypes.map((t) => (
        <TypeBadge key={t} type={t} size="sm" />
      ))}
    </div>
  );

  if (yourMons.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {specialtyHint}
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Add Pokémon to this run's <span className="font-medium text-foreground">Team</span> tab — or log
          live Nuzlocke encounters — to see how you match up against {trainer.name}.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {specialtyHint}
      {/* Summary */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Super-effective answer to {answeredCount}/{oppMons.length}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
            threatenedCount > 0
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : "bg-muted text-muted-foreground",
          )}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          {threatenedCount} of your team threatened
        </span>
      </div>

      {/* Offense grid: your STAB vs each opponent */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your best STAB vs each opponent
        </p>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background" />
                {oppMons.map((o, i) => (
                  <th key={i} className="w-12 align-bottom">
                    <button
                      onClick={() => onOpenPokemon(o.mon.species)}
                      className="flex w-full flex-col items-center gap-0.5"
                      title={formatPokemonName(o.mon.species)}
                    >
                      {o.mon.ndex ? (
                        <SpriteImg src={`${SPRITES_ROOT}/${o.mon.ndex}.png`} alt="" size="h-9 w-9" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center text-lg">?</span>
                      )}
                      {o.mon.level != null && (
                        <span className="text-[10px] text-muted-foreground">Lv.{o.mon.level}</span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yourMons.map((y, ri) => (
                <tr key={ri}>
                  <th className="sticky left-0 z-10 bg-background pr-2 text-left">
                    <button
                      onClick={() => onOpenPokemon(y.summary.name)}
                      className="flex items-center gap-2"
                      title={formatPokemonName(y.summary.name)}
                    >
                      <SpriteImg src={`${SPRITES_ROOT}/${y.summary.id}.png`} alt="" size="h-9 w-9" />
                      <span className="hidden max-w-[7rem] truncate text-xs font-medium sm:inline">
                        {y.member.nickname || formatPokemonName(y.summary.name)}
                      </span>
                    </button>
                  </th>
                  {oppMons.map((o, ci) => {
                    const best = bestStabMultiplier(y.types, o.types, gen);
                    return (
                      <td
                        key={ci}
                        title={best.type ? `${formatMultiplier(best.mult)} via ${best.type}` : formatMultiplier(best.mult)}
                        className={cn(
                          "h-10 w-12 rounded-md text-center text-xs tabular-nums",
                          TONE_CELL[matchupTone(best.mult)],
                        )}
                      >
                        {formatMultiplier(best.mult)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Defensive read: who's threatened by the trainer's moves */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Defensive threats
        </p>
        <div className="flex flex-col gap-1.5">
          {yourMons.map((y, i) => {
            const threats = threatsByMon[i];
            const underLeveled =
              y.member.level != null && oppMaxLevel > 0 && y.member.level < oppMaxLevel;
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
              >
                <SpriteImg src={`${SPRITES_ROOT}/${y.summary.id}.png`} alt="" size="h-7 w-7" />
                <span className="min-w-0 max-w-[8rem] shrink-0 truncate font-medium">
                  {y.member.nickname || formatPokemonName(y.summary.name)}
                </span>
                {y.member.level != null && (
                  <span className={cn("shrink-0 tabular-nums", underLeveled ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                    Lv.{y.member.level}
                  </span>
                )}
                {threats.length > 0 ? (
                  <span className="flex flex-1 flex-wrap items-center gap-1">
                    <span className="text-muted-foreground">weak to</span>
                    {threats.map((t) => (
                      <TypeBadge key={t} type={t} size="sm" />
                    ))}
                  </span>
                ) : (
                  <span className="flex-1 text-emerald-600 dark:text-emerald-400">
                    Resists their coverage
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Threats are based on the move types {trainer.name}'s Pokémon actually carry.
        </p>
      </div>
    </div>
  );
}
