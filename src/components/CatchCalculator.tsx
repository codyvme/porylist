import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn, formatPokemonName } from "@/lib/utils";
import { spriteUrl } from "@/lib/games";
import { usePokemonSummaryList, usePokemonSpecies } from "@/lib/pokeapi";
import { PokemonSearch } from "@/components/PokemonSearch";
import type { GameOption } from "@/lib/games";
import { GameFilter } from "@/components/GameFilter";
import {
  calculateCatch,
  ballsForGeneration,
  generationForGame,
  catchSystemNote,
  statusMultiplier,
  type StatusCondition,
  type BallContext,
  type Ball,
} from "@/lib/catch-calculator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: StatusCondition; label: string }[] = [
  { value: "none",      label: "No status" },
  { value: "sleep",     label: "Sleep"     },
  { value: "freeze",    label: "Freeze"    },
  { value: "paralysis", label: "Paralysis" },
  { value: "burn",      label: "Burn"      },
  { value: "poison",    label: "Poison"    },
];

function pctColor(p: number): string {
  if (p >= 0.75) return "text-green-500 dark:text-green-400";
  if (p >= 0.4)  return "text-yellow-500 dark:text-yellow-400";
  if (p >= 0.1)  return "text-orange-500 dark:text-orange-400";
  return "text-red-500 dark:text-red-400";
}

function hpColor(pct: number): string {
  if (pct > 50) return "text-green-500 dark:text-green-400";
  if (pct >= 20) return "text-yellow-500 dark:text-yellow-400";
  return "text-red-500 dark:text-red-400";
}

function pctBarColor(p: number): string {
  if (p >= 0.75) return "bg-green-500";
  if (p >= 0.4)  return "bg-yellow-500";
  if (p >= 0.1)  return "bg-orange-500";
  return "bg-red-500";
}

// ─── Ball Picker ──────────────────────────────────────────────────────────────

function BallPicker({
  balls,
  selected,
  onSelect,
  ctx,
}: {
  balls: Ball[];
  selected: Ball;
  onSelect: (b: Ball) => void;
  ctx: BallContext;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm hover:bg-muted focus:outline-hidden focus:ring-2 focus:ring-primary"
      >
        <span>{selected.name}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{selected.conditionLabel(ctx)}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-background shadow-lg">
          {balls.map((b) => (
            <button
              key={b.id}
              onClick={() => { onSelect(b); setOpen(false); }}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted",
                b.id === selected.id && "bg-primary/10 font-medium",
              )}
            >
              <span>{b.name}</span>
              <span className="text-xs text-muted-foreground">{b.conditionLabel(ctx)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CatchCalculator({ game }: { game: GameOption | null }) {
  const generation = generationForGame(game?.value ?? null);
  const systemNote = catchSystemNote(game?.value ?? null);

  const [pokemonName, setPokemonName] = useState<string | null>(null);
  const [level, setLevel] = useState(50);
  const [hpPercent, setHpPercent] = useState(100);
  const [status, setStatus] = useState<StatusCondition>("none");
  const [selectedBallId, setSelectedBallId] = useState("poke-ball");
  const [playerLevel, setPlayerLevel] = useState(50);
  const [turnNumber, setTurnNumber] = useState(1);
  const [isDarkOrCave, setIsDarkOrCave] = useState(false);
  const [isFishing, setIsFishing] = useState(false);
  const [isWater, setIsWater] = useState(false);
  const [alreadyCaught, setAlreadyCaught] = useState(false);

  const { data: pokemonList = [] } = usePokemonSummaryList();
  const selectedPokemon = useMemo(() => pokemonList.find((p) => p.name === pokemonName) ?? null, [pokemonList, pokemonName]);
  const speciesName = selectedPokemon?.species?.name ?? selectedPokemon?.name ?? null;
  const { data: species, isLoading: speciesLoading } = usePokemonSpecies(speciesName);

  const types = useMemo(
    () => selectedPokemon?.types.map((t) => t.type.name) ?? [],
    [selectedPokemon],
  );
  const weight = selectedPokemon?.weight ?? 0;
  const baseHp = useMemo(
    () => selectedPokemon?.stats.find((s) => s.stat.name === "hp")?.base_stat ?? 45,
    [selectedPokemon],
  );
  const isUltraBeast = false; // Could expand later with a hardcoded UB list

  const availableBalls = useMemo(() => ballsForGeneration(generation), [generation]);

  // Reset ball to Poké Ball if current ball isn't available in this generation
  useEffect(() => {
    if (!availableBalls.find((b) => b.id === selectedBallId)) {
      setSelectedBallId("poke-ball");
    }
  }, [availableBalls, selectedBallId]);

  // Quick Ball only cares about turn 1; reset the slider so it shows the correct multiplier
  useEffect(() => {
    if (selectedBallId === "quick-ball") setTurnNumber(1);
  }, [selectedBallId]);

  const selectedBall = availableBalls.find((b) => b.id === selectedBallId) ?? availableBalls[0];

  const ballCtx: BallContext = {
    generation,
    level,
    weight,
    types,
    alreadyCaught,
    isDarkOrCave,
    isFishing,
    isWater,
    turnNumber,
    isUltraBeast,
    playerLevel,
  };

  // Show extra inputs for certain balls
  const needsTurn = selectedBall.id === "timer-ball";
  const needsFirstTurn = selectedBall.id === "quick-ball";
  const needsDark = selectedBall.id === "dusk-ball";
  const needsFishing = selectedBall.id === "lure-ball";
  const needsWater = selectedBall.id === "dive-ball";
  const needsAlreadyCaught = selectedBall.id === "repeat-ball";
  const needsPlayerLevel = selectedBall.id === "level-ball";

  const catchRate = species?.capture_rate ?? null;

  const result = useMemo(() => {
    if (catchRate == null || !selectedPokemon) return null;
    return calculateCatch({
      catchRate,
      baseHp,
      level,
      hpPercent,
      ball: selectedBall,
      ballContext: ballCtx,
      status,
      generation,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catchRate, baseHp, level, hpPercent, selectedBall, status, generation,
      playerLevel, turnNumber, isDarkOrCave, isFishing, isWater, alreadyCaught, selectedPokemon]);

  const statusBonus = statusMultiplier(status, generation);

  return (
    <div className="flex flex-col gap-5 px-4 sm:px-6">
      <div className="shrink-0 flex items-center gap-3 border-b border-border py-3 -mx-4 sm:-mx-6 px-4 sm:px-6">
        <h1 className="flex-1 text-xl font-semibold">Catch Calculator</h1>
        <GameFilter />
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 max-w-3xl">

        {/* ── Inputs ── */}
        <div className="flex flex-col gap-5 flex-1">

          {/* Pokémon */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Pokémon</label>
            <PokemonSearch value={pokemonName} onChange={(n) => { if (n) setPokemonName(n); }} maxResults={50} />
            {selectedPokemon && species && (
              <p className="text-xs text-muted-foreground">
                Base catch rate: <span className="font-medium text-foreground">{species.capture_rate}</span>/255
              </p>
            )}
            {selectedPokemon && speciesLoading && (
              <p className="text-xs text-muted-foreground animate-pulse">Loading catch rate…</p>
            )}
          </div>

          {/* Level */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Level</label>
              <span className="text-sm font-semibold tabular-nums">{level}</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span><span>100</span>
            </div>
          </div>

          {/* Current HP */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Current HP</label>
              <span className={cn("text-sm font-semibold tabular-nums", hpColor(hpPercent))}>
                {hpPercent}%
                {result && (
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    ({result.currentHp}/{result.maxHp})
                  </span>
                )}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={hpPercent}
              onChange={(e) => setHpPercent(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 HP</span><span>Full HP</span>
            </div>
          </div>

          {/* Status condition */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Status Condition</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(({ value: v, label }) => (
                <button
                  key={v}
                  onClick={() => setStatus(v)}
                  className={cn(
                    "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                    status === v
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {status !== "none" && (
              <p className="text-xs text-muted-foreground">
                Status multiplier: <span className="font-medium text-foreground">{statusBonus}×</span>
              </p>
            )}
          </div>

          {/* Ball */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Poké Ball</label>
            <BallPicker
              balls={availableBalls}
              selected={selectedBall}
              onSelect={(b) => setSelectedBallId(b.id)}
              ctx={ballCtx}
            />
          </div>

          {/* Conditional ball inputs */}
          {needsTurn && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Turn number</label>
                <span className="text-sm font-semibold tabular-nums">{turnNumber}</span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={turnNumber}
                onChange={(e) => setTurnNumber(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          )}
          {needsFirstTurn && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={turnNumber === 1}
                onChange={(e) => setTurnNumber(e.target.checked ? 1 : 2)}
                className="accent-primary"
              />
              First turn of battle
            </label>
          )}

          {needsPlayerLevel && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Your Pokémon's level</label>
                <span className="text-sm font-semibold tabular-nums">{playerLevel}</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={playerLevel}
                onChange={(e) => setPlayerLevel(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {needsDark && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={isDarkOrCave} onChange={(e) => setIsDarkOrCave(e.target.checked)} className="h-4 w-4 accent-primary" />
                Night or cave
              </label>
            )}
            {needsFishing && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={isFishing} onChange={(e) => setIsFishing(e.target.checked)} className="h-4 w-4 accent-primary" />
                Fishing encounter
              </label>
            )}
            {needsWater && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={isWater} onChange={(e) => setIsWater(e.target.checked)} className="h-4 w-4 accent-primary" />
                Surfing / diving encounter
              </label>
            )}
            {needsAlreadyCaught && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={alreadyCaught} onChange={(e) => setAlreadyCaught(e.target.checked)} className="h-4 w-4 accent-primary" />
                Already registered in Pokédex
              </label>
            )}
          </div>
        </div>

        {/* ── Result ── */}
        <div className="lg:w-56 flex flex-col gap-4">
          <div className="rounded-xl border bg-muted/30 p-5 flex flex-col items-center gap-3">
            {!selectedPokemon ? (
              <p className="text-sm text-muted-foreground text-center">Select a Pokémon to calculate.</p>
            ) : speciesLoading ? (
              <p className="text-sm text-muted-foreground animate-pulse text-center">Loading…</p>
            ) : result ? (
              <>
                {/* Sprite */}
                <img
                  src={spriteUrl(selectedPokemon.id, game?.spriteVersion)}
                  alt={formatPokemonName(selectedPokemon.name)}
                  className="h-24 w-24 object-contain"
                />

                {/* Big probability */}
                <div className="text-center">
                  {result.probability >= 1 ? (
                    <p className="text-4xl font-bold text-green-500">100%</p>
                  ) : (
                    <p className={cn("text-4xl font-bold tabular-nums", pctColor(result.probability))}>
                      {(result.probability * 100).toFixed(result.probability < 0.01 ? 2 : 1)}%
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">catch chance</p>
                </div>

                {/* Bar */}
                <div className="w-full h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", pctBarColor(result.probability))}
                    style={{ width: `${Math.min(100, result.probability * 100)}%` }}
                  />
                </div>

                {/* Stats */}
                <div className="w-full text-sm divide-y divide-border">
                  {result.probability < 1 && (
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Expected throws</span>
                      <span className="font-medium tabular-nums">
                        {result.expectedThrows < 1.05 ? "1" : result.expectedThrows < 100 ? result.expectedThrows.toFixed(1) : Math.round(result.expectedThrows).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Catch rate</span>
                    <span className="font-medium tabular-nums">{catchRate}/255</span>
                  </div>
                  {result.effectiveBallMult !== Infinity && (
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Ball bonus</span>
                      <span className="font-medium tabular-nums">
                        {selectedBall.isAdditive
                          ? selectedBall.conditionLabel(ballCtx)
                          : `${result.effectiveBallMult}×`}
                      </span>
                    </div>
                  )}
                  {status !== "none" && (
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Status bonus</span>
                      <span className="font-medium tabular-nums">{result.effectiveStatusMult}×</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Formula</span>
                    <span className="font-medium">Gen {generation}</span>
                  </div>
                </div>

                {/* Three-throw / five-throw cumulative */}
                {result.probability > 0 && result.probability < 1 && (
                  <div className="w-full rounded-lg bg-muted/60 p-3 text-xs space-y-1">
                    <p className="font-medium text-foreground mb-1.5">Cumulative probability</p>
                    {[1, 3, 5, 10].map((n) => {
                      const p = 1 - Math.pow(1 - result.probability, n);
                      return (
                        <div key={n} className="flex justify-between">
                          <span className="text-muted-foreground">{n} throw{n > 1 ? "s" : ""}</span>
                          <span className={cn("font-medium tabular-nums", pctColor(p))}>
                            {(p * 100).toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : null}
          </div>

          {systemNote && (
            <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-2 leading-relaxed">
              {systemNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
