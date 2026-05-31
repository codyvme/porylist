import { useMemo, useState } from "react";
import { ChevronDown, Search, Swords, X } from "lucide-react";
import {
  usePokemonSummaryList,
  useMoveList,
  useItemList,
  type PokemonSummary,
  type MoveListEntry,
} from "@/lib/pokeapi";
import { spriteUrl, SPRITES_ROOT } from "@/lib/games";
import { TYPE_COLORS, typeStyle } from "@/lib/types";
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

function PokemonPicker({
  label,
  value,
  onChange,
  pokemon,
}: {
  label: string;
  value: PokemonSummary | null;
  onChange: (p: PokemonSummary | null) => void;
  pokemon: PokemonSummary[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pokemon.slice(0, 50);
    return pokemon
      .filter((p) => p.name.includes(q) || formatPokemonName(p.name).toLowerCase().includes(q))
      .slice(0, 50);
  }, [query, pokemon]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 items-center gap-3 rounded-md border border-input bg-background px-3 text-left hover:bg-muted/50"
      >
        {value ? (
          <>
            <img
              src={spriteUrl(value.id)}
              alt=""
              className="h-10 w-10 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = `${SPRITES_ROOT}/${value.id}.png`; }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{formatPokemonName(value.name)}</div>
              <div className="flex gap-1">
                {value.types.map((t) => (
                  <span key={t.type.name} className="rounded-full px-1.5 text-[10px] font-semibold capitalize text-white" style={typeStyle(t.type.name)}>
                    {t.type.name}
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Select a Pokémon…</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="absolute left-1/2 top-24 w-full max-w-md -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Pokémon…"
                autoFocus
                className="h-11 flex-1 bg-transparent text-sm outline-none"
              />
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {matches.map((p) => (
                <button
                  key={p.name}
                  onClick={() => { onChange(p); setOpen(false); setQuery(""); }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted",
                    value?.name === p.name && "bg-muted",
                  )}
                >
                  <img src={spriteUrl(p.id)} alt="" className="h-8 w-8 object-contain" />
                  <span className="flex-1 text-sm">{formatPokemonName(p.name)}</span>
                  <div className="flex gap-1">
                    {p.types.map((t) => (
                      <span key={t.type.name} className="rounded-full px-1.5 text-[10px] font-semibold capitalize text-white" style={typeStyle(t.type.name)}>
                        {t.type.name}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
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

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? moves.filter((m) => m.name.includes(q) || m.displayName.toLowerCase().includes(q))
      : moves.filter((m) => (m.power ?? 0) > 0).sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
    return base.slice(0, 80);
  }, [query, moves]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">Move</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 items-center gap-3 rounded-md border border-input bg-background px-3 text-left hover:bg-muted/50"
      >
        {value ? (
          <>
            <Swords className="h-5 w-5 shrink-0" style={{ color: TYPE_COLORS[value.type] ?? "#888" }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{value.displayName}</div>
              <div className="text-xs text-muted-foreground">
                {value.category} · Power {value.power ?? "—"} · Acc {value.accuracy ?? "—"}
              </div>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize text-white" style={typeStyle(value.type)}>
              {value.type}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Select a move…</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="absolute left-1/2 top-24 w-full max-w-md -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search moves…"
                autoFocus
                className="h-11 flex-1 bg-transparent text-sm outline-none"
              />
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {matches.map((m) => (
                <button
                  key={m.name}
                  onClick={() => { onChange(m); setOpen(false); setQuery(""); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.displayName}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {m.category} · Power {m.power ?? "—"}
                    </div>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize text-white" style={typeStyle(m.type)}>
                    {m.type}
                  </span>
                </button>
              ))}
            </div>
          </div>
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
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Attacker</h2>
          <PokemonPicker label="Pokémon" value={attacker} onChange={setAttacker} pokemon={pokemonList} />

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
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Defender</h2>
          <PokemonPicker label="Pokémon" value={defender} onChange={setDefender} pokemon={pokemonList} />

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
