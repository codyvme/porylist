import { useMemo, useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import {
  usePokemonSummaryList,
  useMoveList,
  useItemList,
  type PokemonSummary,
  type MoveListEntry,
} from "@/lib/pokeapi";
import { TypeBadge } from "@/components/TypeBadge";
import { PokemonSearch } from "@/components/PokemonSearch";
import { formatPokemonName, cn } from "@/lib/utils";
import { GameFilter } from "@/components/GameFilter";
import {
  calculateDamage,
  knockoutLabel,
  ATTACKER_ITEMS,
  effectivenessLabel,
  type Weather,
} from "@/lib/damage-calc";

const BOOST_OPTIONS = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

function statByName(p: PokemonSummary, name: string): number {
  return p.stats.find((s) => s.stat.name === name)?.base_stat ?? 0;
}

function MovePicker({
  value,
  onChange,
  moves,
}: {
  value: MoveListEntry | null;
  onChange: (m: MoveListEntry | null) => void;
  moves: MoveListEntry[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? moves.filter((m) => m.name.includes(q) || m.displayName.toLowerCase().includes(q))
      : moves.filter((m) => (m.power ?? 0) > 0).sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
    return base.slice(0, 80);
  }, [query, moves]);

  return (
    <div ref={ref} className="relative flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">Move</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search moves…"
          value={open ? query : (value?.displayName ?? "")}
          onFocus={() => { setQuery(""); setOpen(true); }}
          onChange={(e) => setQuery(e.target.value)}
          className={cn(
            "h-9 w-full rounded-md border border-input bg-background pl-8 text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary",
            value && !open ? "pr-8" : "pr-3",
          )}
        />
        {value && !open && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Clear move"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-background py-1 shadow-xl">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No moves found.</p>
          ) : (
            matches.map((m) => (
              <button
                key={m.name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(m); setOpen(false); setQuery(""); }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted",
                  value?.name === m.name && "bg-primary/10",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.displayName}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {m.category} · Power {m.power ?? "—"}
                  </div>
                </div>
                <TypeBadge type={m.type} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function DamageCalculator() {
  const { data: pokemonList = [] } = usePokemonSummaryList();
  const { data: moveList = [] } = useMoveList();
  const { data: itemList = [] } = useItemList();

  const [attacker, setAttacker] = useState<PokemonSummary | null>(null);
  const [defender, setDefender] = useState<PokemonSummary | null>(null);
  const [move, setMove] = useState<MoveListEntry | null>(null);
  const [attackerLevel, setAttackerLevel] = useState(50);
  const [defenderLevel, setDefenderLevel] = useState(50);
  const [offenseBoost, setOffenseBoost] = useState(0);
  const [defenseBoost, setDefenseBoost] = useState(0);
  const [critical, setCritical] = useState(false);
  const [burned, setBurned] = useState(false);
  const [weather, setWeather] = useState<Weather>("none");
  const [screen, setScreen] = useState(false);
  const [attackerItem, setAttackerItem] = useState<string>("");

  const itemLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const it of itemList) map[it.name] = it.displayName;
    return map;
  }, [itemList]);

  const result = useMemo(() => {
    if (!attacker || !defender || !move) return null;
    if (move.category === "status" || (move.power ?? 0) <= 0) return null;
    const offense = move.category === "physical" ? statByName(attacker, "attack") : statByName(attacker, "special-attack");
    const defense = move.category === "physical" ? statByName(defender, "defense") : statByName(defender, "special-defense");
    return calculateDamage({
      level: attackerLevel,
      power: move.power ?? 0,
      category: move.category as "physical" | "special",
      moveType: move.type,
      attackerTypes: attacker.types.map((t) => t.type.name),
      defenderTypes: defender.types.map((t) => t.type.name),
      stats: { offense, defense },
      offenseBoost,
      defenseBoost,
      critical, burned, weather, screen,
      attackerItem: attackerItem || undefined,
    });
  }, [attacker, defender, move, attackerLevel, offenseBoost, defenseBoost, critical, burned, weather, screen, attackerItem]);

  // Defender HP for KO labelling — base HP rough estimate at the chosen level.
  // Uses the standard HP formula with 0 EVs/IVs: ((2*base + 0 + 0) * L / 100) + L + 10
  const defenderHp = useMemo(() => {
    if (!defender) return 0;
    const baseHp = statByName(defender, "hp");
    return Math.floor((2 * baseHp * defenderLevel) / 100) + defenderLevel + 10;
  }, [defender, defenderLevel]);

  return (
    <div className="flex flex-col gap-5 px-4 sm:px-6 pb-8">
      <div className="shrink-0 flex items-center gap-3 border-b border-border py-3 -mx-4 sm:-mx-6 px-4 sm:px-6">
        <h1 className="flex-1 text-xl font-semibold">Damage Calculator</h1>
        <GameFilter />
      </div>

      <p className="text-xs text-muted-foreground">
        Uses base stats only (no EV/IV/nature inputs) and Gen 6+ formulas. Min–max reflects the 0.85–1.00 random roll.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Attacker */}
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="font-semibold">Attacker</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Pokémon</label>
            <PokemonSearch
              value={attacker?.name ?? null}
              onChange={(name) => setAttacker(name ? pokemonList.find((p) => p.name === name) ?? null : null)}
              maxResults={50}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Level" value={attackerLevel} onChange={setAttackerLevel} min={1} max={100} />
            <SelectField
              label={`${move?.category === "special" ? "Sp. Atk" : "Atk"} stage`}
              value={offenseBoost}
              onChange={setOffenseBoost}
              options={BOOST_OPTIONS}
              formatOption={(n) => (n > 0 ? `+${n}` : String(n))}
            />
          </div>

          <SelectField
            label="Held item"
            value={attackerItem}
            onChange={(v) => setAttackerItem(v as string)}
            options={["", ...ATTACKER_ITEMS]}
            formatOption={(v) => (v ? (itemLookup[v as string] ?? (v as string)) : "— None —")}
          />

          <div className="flex flex-wrap gap-3 text-xs">
            <Toggle label="Critical hit" checked={critical} onChange={setCritical} />
            <Toggle label="Burned (physical halves)" checked={burned} onChange={setBurned} />
          </div>

          <MovePicker value={move} onChange={setMove} moves={moveList} />
        </section>

        {/* Defender */}
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="font-semibold">Defender</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Pokémon</label>
            <PokemonSearch
              value={defender?.name ?? null}
              onChange={(name) => setDefender(name ? pokemonList.find((p) => p.name === name) ?? null : null)}
              maxResults={50}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Level" value={defenderLevel} onChange={setDefenderLevel} min={1} max={100} />
            <SelectField
              label={`${move?.category === "special" ? "Sp. Def" : "Def"} stage`}
              value={defenseBoost}
              onChange={setDefenseBoost}
              options={BOOST_OPTIONS}
              formatOption={(n) => (n > 0 ? `+${n}` : String(n))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Weather"
              value={weather}
              onChange={(v) => setWeather(v as Weather)}
              options={["none", "sun", "rain", "sand", "snow"]}
              formatOption={(v) => (v as string).replace(/^./, (c) => c.toUpperCase())}
            />
            <div className="flex items-end">
              <Toggle label="Screen up" checked={screen} onChange={setScreen} />
            </div>
          </div>

          {defender && (
            <div className="text-xs text-muted-foreground">
              Estimated HP at Lv {defenderLevel}: <strong className="font-medium text-foreground">{defenderHp}</strong>
            </div>
          )}
        </section>
      </div>

      {/* Result */}
      <ResultCard result={result} defenderHp={defenderHp} attacker={attacker} defender={defender} move={move} />
    </div>
  );
}

// ─── Result ──────────────────────────────────────────────────────────────────

function ResultCard({
  result, defenderHp, attacker, defender, move,
}: {
  result: ReturnType<typeof calculateDamage> | null;
  defenderHp: number;
  attacker: PokemonSummary | null;
  defender: PokemonSummary | null;
  move: MoveListEntry | null;
}) {
  if (!attacker || !defender || !move) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Pick an attacker, defender, and move to see damage.
      </div>
    );
  }
  if (!result || move.category === "status" || (move.power ?? 0) <= 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        {move.displayName} is a status move — no direct damage.
      </div>
    );
  }
  const minPct = (result.minDamage / defenderHp) * 100;
  const maxPct = (result.maxDamage / defenderHp) * 100;
  const ko = knockoutLabel(result.maxDamage, defenderHp);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {formatPokemonName(attacker.name)}'s {move.displayName} vs. {formatPokemonName(defender.name)}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-bold">{result.minDamage}–{result.maxDamage}</span>
            <span className="text-sm text-muted-foreground">
              ({minPct.toFixed(1)}% – {maxPct.toFixed(1)}%)
            </span>
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-sm font-semibold",
              ko.chance === "guaranteed" ? "bg-red-500/15 text-red-600 dark:text-red-400"
                : ko.chance === "possible" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {ko.chance === "guaranteed" ? "Guaranteed " : ""}{ko.label}
          </span>
          <span className="text-xs text-muted-foreground">{effectivenessLabel(result.effectiveness)} effective</span>
        </div>
      </div>

      {/* HP bar */}
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="relative h-full">
          {/* min damage */}
          <div className="absolute left-0 top-0 h-full bg-red-500/40" style={{ width: `${Math.min(100, minPct)}%` }} />
          {/* extra to max */}
          <div className="absolute top-0 h-full bg-red-500" style={{ left: `${Math.min(100, minPct)}%`, width: `${Math.min(100, Math.max(0, maxPct - minPct))}%` }} />
        </div>
      </div>

      {result.modifierLines.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            Show modifier breakdown
          </summary>
          <table className="mt-2 w-full text-xs">
            <tbody>
              {result.modifierLines.map((line, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1 text-muted-foreground">{line.label}</td>
                  <td className="py-1 text-right font-mono">×{line.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

// ─── Tiny inputs ─────────────────────────────────────────────────────────────

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm"
      />
    </label>
  );
}

function SelectField<T extends string | number>({
  label, value, onChange, options, formatOption,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  formatOption?: (v: T) => string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          const next = typeof value === "number" ? Number(e.target.value) : e.target.value;
          onChange(next as T);
        }}
        className="h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm"
      >
        {options.map((opt) => (
          <option key={String(opt)} value={String(opt)}>{formatOption ? formatOption(opt) : String(opt)}</option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      <span className="text-muted-foreground">{label}</span>
    </label>
  );
}
