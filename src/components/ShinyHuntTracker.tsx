import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Pencil, Plus, RotateCcw, Sparkles, Trash2, X,
} from "lucide-react";
import { cn, formatPokemonName } from "@/lib/utils";
import { GAMES, GAMES_BY_VALUE, spriteUrl } from "@/lib/games";
import { usePokemonSummaryList } from "@/lib/pokeapi";
import { SpriteImg } from "@/components/SpriteImg";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { Tooltip } from "@/components/ui/tooltip";
import {
  loadHunts, saveHunts, newHuntId,
  shinyRate, cumulativeProb, expectedEncounters,
  METHOD_LABELS,
  type ShinyHunt, type ShinyMethod,
} from "@/lib/shiny-hunts";
import {
  fetchShinyHuntsFromDB, upsertShinyHunt, deleteShinyHunt,
  type User,
} from "@/lib/supabase";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHARM_GAMES = new Set(GAMES.filter(g => g.generation >= 5).map(g => g.value));

function availableMethods(gameValue: string): ShinyMethod[] {
  const game = GAMES_BY_VALUE[gameValue];
  if (!game) return ["soft-reset"];
  const methods: ShinyMethod[] = ["soft-reset"];
  if (game.generation >= 4) methods.push("masuda");
  if (game.generation === 7) methods.push("sos-chain");
  return methods;
}

// ─── Luck meter ───────────────────────────────────────────────────────────────

function LuckMeter({ p, count }: { p: number; count: number }) {
  const cumulative = cumulativeProb(p, count);
  const expected = expectedEncounters(p);
  const pct = cumulative * 100;
  const ratio = count / expected;
  const barColor =
    ratio < 1 ? "bg-emerald-500" :
    ratio < 2 ? "bg-yellow-500" :
    ratio < 3 ? "bg-orange-500" :
                "bg-red-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Cumulative chance</span>
        <span className="font-semibold tabular-nums">
          {pct < 0.01 ? "<0.01" : pct.toFixed(2)}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", barColor)}
          style={{ width: `${Math.min(pct, 99.5)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Expected: ~{expected.toLocaleString()}</span>
        <span>
          {ratio >= 1
            ? `${ratio.toFixed(1)}× over odds`
            : `${(ratio * 100).toFixed(0)}% of odds`}
        </span>
      </div>
    </div>
  );
}

// ─── Left panel: compact hunt list item ──────────────────────────────────────

function HuntListItem({
  hunt,
  selected,
  onClick,
}: {
  hunt: ShinyHunt;
  selected: boolean;
  onClick: () => void;
}) {
  const game = GAMES_BY_VALUE[hunt.gameValue];
  const generation = game?.generation ?? 6;
  const p = shinyRate(hunt, generation);
  const cumPct = (cumulativeProb(p, hunt.count) * 100);
  const { data: summaryList = [] } = usePokemonSummaryList();
  const entry = useMemo(() => summaryList.find(s => s.name === hunt.species), [summaryList, hunt.species]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition-colors hover:bg-muted/50",
        selected ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <div className="flex items-center gap-3">
        {entry ? (
          <SpriteImg src={spriteUrl(entry.id, game?.spriteVersion)} alt={hunt.speciesName} size="h-10 w-10" fallbackSrc={spriteUrl(entry.id, undefined)} />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-semibold", selected && "text-primary")}>
            {hunt.speciesName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {METHOD_LABELS[hunt.method]} · {hunt.count.toLocaleString()} enc.
          </p>
        </div>
        {hunt.count > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold tabular-nums">{cumPct < 0.01 ? "<0.01" : cumPct.toFixed(1)}%</p>
            <p className="text-[9px] text-muted-foreground">cumul.</p>
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Right panel: hunt detail ─────────────────────────────────────────────────

function HuntDetail({
  hunt,
  onUpdate,
  onDelete,
  onBack,
}: {
  hunt: ShinyHunt;
  onUpdate: (h: ShinyHunt) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  const game = GAMES_BY_VALUE[hunt.gameValue];
  const generation = game?.generation ?? 6;
  const p = shinyRate(hunt, generation);
  const odds = p > 0 ? Math.round(1 / p) : null;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftNotes, setDraftNotes] = useState(hunt.notes ?? "");

  // Keep draft in sync when hunt changes (e.g. navigating between hunts)
  useEffect(() => {
    setDraftNotes(hunt.notes ?? "");
    setEditingNotes(false);
  }, [hunt.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCountChange = (delta: number) => {
    const newCount = Math.max(0, hunt.count + delta);
    if (newCount === hunt.count) return;
    onUpdate({ ...hunt, count: newCount, updatedAt: Date.now() });
  };

  const handleFound = () => onUpdate({ ...hunt, status: "found", foundAt: Date.now(), updatedAt: Date.now() });
  const handleAbandon = () => onUpdate({ ...hunt, status: "abandoned", updatedAt: Date.now() });

  const handleSaveNotes = () => {
    onUpdate({ ...hunt, notes: draftNotes.trim() || undefined, updatedAt: Date.now() });
    setEditingNotes(false);
  };

  const { data: summaryList = [] } = usePokemonSummaryList();
  const entry = useMemo(() => summaryList.find(s => s.name === hunt.species), [summaryList, hunt.species]);

  return (
    <>
      {confirmDelete && (
        <ConfirmDeleteModal
          title="Delete hunt?"
          subject={hunt.speciesName}
          onConfirm={() => { setConfirmDelete(false); onDelete(hunt.id); onBack(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-1 pb-6">

        {/* Mobile back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground sm:hidden"
        >
          <ArrowLeft className="h-4 w-4" /> All hunts
        </button>

        {/* Header */}
        <div className="flex items-center gap-4">
          {entry ? (
            <SpriteImg
              src={spriteUrl(entry.id, game?.spriteVersion)}
              alt={hunt.speciesName}
              size="h-16 w-16"
              fallbackSrc={spriteUrl(entry.id, undefined)}
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Sparkles className="h-7 w-7 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{hunt.speciesName}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {game?.label ?? hunt.gameValue}
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {METHOD_LABELS[hunt.method]}
              </span>
              {hunt.hasShinyCharm && (
                <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                  ✦ Shiny Charm
                </span>
              )}
            </div>
          </div>
          {odds !== null && (
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-muted-foreground">Per encounter</p>
              <p className="text-base font-bold tabular-nums">1/{odds.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Counter */}
        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center justify-center rounded-xl border bg-muted/40 py-5">
            <span className="text-5xl font-bold tabular-nums tracking-tight">
              {hunt.count.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => handleCountChange(1)}
                className="flex-1 rounded-lg border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
              >
                +1
              </button>
              <button
                onClick={() => handleCountChange(10)}
                className="flex-1 rounded-lg border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
              >
                +10
              </button>
            </div>
            <Tooltip content="Reset counter to 0" side="top">
              <button
                onClick={() => onUpdate({ ...hunt, count: 0, updatedAt: Date.now() })}
                className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </Tooltip>
          </div>
        </div>

        {hunt.method === "sos-chain" && (
          <p className="text-xs text-muted-foreground -mt-2">
            Counter = current chain length — reset it when your chain breaks
          </p>
        )}

        {/* Luck meter */}
        {hunt.count > 0 && <LuckMeter p={p} count={hunt.count} />}

        {/* Notes */}
        <div className="rounded-xl border p-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
            {!editingNotes && (
              <button
                onClick={() => setEditingNotes(true)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={draftNotes}
                onChange={e => setDraftNotes(e.target.value)}
                placeholder="Route, location, strategy..."
                rows={3}
                autoFocus
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setDraftNotes(hunt.notes ?? ""); setEditingNotes(false); }}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotes}
                  className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Save
                </button>
              </div>
            </div>
          ) : hunt.notes ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{hunt.notes}</p>
          ) : (
            <button
              onClick={() => setEditingNotes(true)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              + Add notes
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleFound}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-yellow-400/50 bg-yellow-400/15 px-3 py-2.5 text-sm font-semibold text-yellow-700 hover:bg-yellow-400/25 dark:text-yellow-400 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Found it!
          </button>
          <button
            onClick={handleAbandon}
            className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
            Abandon
          </button>
          <Tooltip content="Delete hunt" side="top">
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center justify-center rounded-lg border px-2.5 py-2.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </>
  );
}

// ─── Right panel: new hunt form ───────────────────────────────────────────────

function NewHuntForm({
  onAdd,
  onCancel,
}: {
  onAdd: (hunt: ShinyHunt) => void;
  onCancel: () => void;
}) {
  const { data: summaryList = [] } = usePokemonSummaryList();
  const [query, setQuery] = useState("");
  const [species, setSpecies] = useState("");
  const [speciesName, setSpeciesName] = useState("");
  const [gameValue, setGameValue] = useState(GAMES[0]?.value ?? "");
  const [method, setMethod] = useState<ShinyMethod>("soft-reset");
  const [hasCharm, setHasCharm] = useState(false);
  const [notes, setNotes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const game = GAMES_BY_VALUE[gameValue];
  const generation = game?.generation ?? 6;
  const methods = availableMethods(gameValue);
  const charmAvailable = CHARM_GAMES.has(gameValue);

  useEffect(() => {
    if (!methods.includes(method)) setMethod("soft-reset");
  }, [gameValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return summaryList
      .filter(p => p.name === p.species.name)
      .filter(p => p.name.includes(q) || formatPokemonName(p.name).toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, summaryList]);

  const selectSpecies = (name: string) => {
    setSpecies(name);
    setSpeciesName(formatPokemonName(name));
    setQuery(formatPokemonName(name));
  };

  const previewP = species
    ? shinyRate({ method, hasShinyCharm: hasCharm, count: 0, species, speciesName, gameValue, id: "", status: "active", createdAt: 0, updatedAt: 0 }, generation)
    : 0;
  const odds = previewP > 0 ? Math.round(1 / previewP) : null;

  const handleSubmit = () => {
    if (!species) return;
    const now = Date.now();
    onAdd({ id: newHuntId(), species, speciesName, gameValue, method, hasShinyCharm: hasCharm, count: 0, status: "active", notes: notes.trim() || undefined, createdAt: now, updatedAt: now });
  };

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-1 pb-6">

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">New Hunt</h2>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Species */}
      <div className="relative flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target Pokémon</label>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setSpecies(""); setSpeciesName(""); }}
          placeholder="Search Pokémon..."
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border bg-background shadow-lg overflow-hidden">
            {filtered.map(p => (
              <button
                key={p.name}
                onMouseDown={e => { e.preventDefault(); selectSpecies(p.name); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <SpriteImg src={spriteUrl(p.id)} alt="" size="h-7 w-7" />
                {formatPokemonName(p.name)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Game */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Game</label>
        <select
          value={gameValue}
          onChange={e => setGameValue(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {GAMES.map(g => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
      </div>

      {/* Method */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Method</label>
        <div className="flex gap-2 flex-wrap">
          {(["soft-reset", "masuda", "sos-chain"] as ShinyMethod[]).map(m => {
            const available = methods.includes(m);
            return (
              <button
                key={m}
                disabled={!available}
                onClick={() => setMethod(m)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  method === m && available
                    ? "border-primary bg-primary/10 text-primary"
                    : available
                    ? "border-border text-muted-foreground hover:bg-muted"
                    : "border-border/40 text-muted-foreground/40 cursor-not-allowed",
                )}
              >
                {METHOD_LABELS[m]}
                {!available && m === "masuda" && " (Gen 4+)"}
                {!available && m === "sos-chain" && " (Gen 7)"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Shiny Charm */}
      <label className={cn("flex items-center gap-2 text-sm", !charmAvailable && "opacity-40 cursor-not-allowed")}>
        <input
          type="checkbox"
          checked={hasCharm && charmAvailable}
          disabled={!charmAvailable}
          onChange={e => setHasCharm(e.target.checked)}
          className="rounded"
        />
        Shiny Charm
        {!charmAvailable && <span className="text-xs text-muted-foreground">(Gen 5+)</span>}
      </label>

      {/* Odds preview */}
      {odds !== null && (
        <p className="text-sm text-muted-foreground">
          Starting odds:{" "}
          <span className="font-semibold text-foreground">1/{odds.toLocaleString()}</span> per encounter
        </p>
      )}

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Route, location, strategy..."
          rows={2}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!species}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Start Hunt
      </button>
    </div>
  );
}

// ─── Left panel: log row (completed hunts) ────────────────────────────────────

function HuntLogRow({ hunt, onDelete }: { hunt: ShinyHunt; onDelete: (id: string) => void }) {
  const game = GAMES_BY_VALUE[hunt.gameValue];
  const { data: summaryList = [] } = usePokemonSummaryList();
  const entry = useMemo(() => summaryList.find(s => s.name === hunt.species), [summaryList, hunt.species]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      {confirmDelete && (
        <ConfirmDeleteModal
          title="Delete log entry?"
          subject={hunt.speciesName}
          onConfirm={() => { setConfirmDelete(false); onDelete(hunt.id); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <div className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
        hunt.status === "found" ? "border-yellow-400/30 bg-yellow-400/5" : "border-border",
      )}>
        {entry ? (
          <SpriteImg src={spriteUrl(entry.id)} alt={hunt.speciesName} size="h-8 w-8" />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {hunt.status === "found" && <Sparkles className="h-3 w-3 shrink-0 text-yellow-500" />}
            <span className="text-sm font-medium truncate">{hunt.speciesName}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {game?.label ?? hunt.gameValue} · {hunt.count.toLocaleString()} enc.
          </p>
        </div>
        <button
          onClick={() => setConfirmDelete(true)}
          className="shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ShinyHuntTracker({ user }: { user: User | null }) {
  const [hunts, setHunts] = useState<ShinyHunt[]>(loadHunts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const didSyncRef = useRef<string | null>(null);

  // On sign-in: pull hunts from DB and merge (DB wins on conflict by updatedAt)
  useEffect(() => {
    if (!user || didSyncRef.current === user.id) return;
    didSyncRef.current = user.id;
    fetchShinyHuntsFromDB(user.id).then((remote) => {
      if (remote.length === 0) return;
      setHunts((local) => {
        const merged = [...local];
        for (const rh of remote) {
          const idx = merged.findIndex((lh) => lh.id === rh.id);
          if (idx === -1) merged.push(rh);
          else if (rh.updatedAt > merged[idx].updatedAt) merged[idx] = rh;
        }
        saveHunts(merged);
        return merged;
      });
    });
  }, [user]);

  // Reset sync ref on sign-out so next sign-in re-syncs
  useEffect(() => {
    if (!user) didSyncRef.current = null;
  }, [user]);

  const persist = useCallback((next: ShinyHunt[], changed?: ShinyHunt, deletedId?: string) => {
    setHunts(next);
    saveHunts(next);
    if (user) {
      if (deletedId) deleteShinyHunt(deletedId);
      if (changed) upsertShinyHunt(user.id, changed);
    }
  }, [user]);

  const activeHunts = useMemo(() => hunts.filter(h => h.status === "active"), [hunts]);
  const completedHunts = useMemo(
    () => hunts.filter(h => h.status !== "active").sort((a, b) => b.updatedAt - a.updatedAt),
    [hunts],
  );

  const selected = hunts.find(h => h.id === selectedId) ?? null;
  const showDetail = selected || isCreating;

  const handleAdd = (hunt: ShinyHunt) => {
    persist([hunt, ...hunts], hunt);
    setIsCreating(false);
    setSelectedId(hunt.id);
  };

  const handleUpdate = useCallback((updated: ShinyHunt) => {
    persist(hunts.map(h => h.id === updated.id ? updated : h), updated);
  }, [hunts, persist]);

  const handleDelete = useCallback((id: string) => {
    persist(hunts.filter(h => h.id !== id), undefined, id);
    if (selectedId === id) setSelectedId(null);
  }, [hunts, persist, selectedId]);

  const handleBack = () => {
    setSelectedId(null);
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col px-6 sm:h-full">
      <h1 className={cn(
        "shrink-0 text-xl font-semibold border-b border-border py-3 -mx-6 px-6",
        showDetail && "hidden sm:block",
      )}>
        Shiny Tracker
      </h1>

      <div className="flex flex-1 sm:min-h-0 sm:overflow-hidden">

        {/* Left panel */}
        <div className={cn(
          "flex w-full sm:w-72 shrink-0 flex-col gap-3 overflow-y-auto pt-3 sm:pr-6",
          showDetail && "hidden sm:flex",
          leftCollapsed && "sm:hidden",
        )}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Hunts</h2>
            <button
              onClick={() => { setIsCreating(true); setSelectedId(null); }}
              className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>

          {activeHunts.length === 0 && !isCreating && (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No active hunts</p>
              <p className="mt-1 text-xs text-muted-foreground">Start a new hunt to begin tracking.</p>
            </div>
          )}

          {activeHunts.map(h => (
            <HuntListItem
              key={h.id}
              hunt={h}
              selected={h.id === selectedId}
              onClick={() => { setSelectedId(h.id); setIsCreating(false); }}
            />
          ))}

          {/* Hunt log */}
          {completedHunts.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowLog(s => !s)}
                className="flex w-full items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground pb-2"
              >
                {showLog ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Log ({completedHunts.length})
              </button>
              {showLog && (
                <div className="flex flex-col gap-2">
                  {completedHunts.map(h => (
                    <HuntLogRow key={h.id} hunt={h} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="hidden sm:block relative shrink-0 w-6">
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
          <button
            onClick={() => setLeftCollapsed(v => !v)}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors"
            title={leftCollapsed ? "Show hunts" : "Hide hunts"}
          >
            {leftCollapsed
              ? <ChevronRight className="h-3 w-3" />
              : <ChevronLeft className="h-3 w-3" />}
          </button>
        </div>

        {/* Right panel */}
        <div className={cn(
          "flex flex-1 flex-col overflow-y-auto pt-3 pb-3 sm:pb-6",
          leftCollapsed ? "pl-2 sm:pl-4" : "pl-0 sm:pl-6",
          !showDetail && "hidden sm:flex",
        )}>
          {isCreating && (
            <NewHuntForm onAdd={handleAdd} onCancel={handleBack} />
          )}
          {!isCreating && selected && (
            <HuntDetail
              hunt={selected}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onBack={handleBack}
            />
          )}
          {!isCreating && !selected && (
            <div className="hidden sm:flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <Sparkles className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-medium">Select a hunt</p>
                <p className="mt-1 text-sm text-muted-foreground">or start a new one to get going</p>
              </div>
              <button
                onClick={() => { setIsCreating(true); setSelectedId(null); }}
                className="mt-1 flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                New Hunt
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
