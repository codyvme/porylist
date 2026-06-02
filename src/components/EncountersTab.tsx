import { useCallback, useMemo, useState } from "react";
import { Check, Pencil, Plus, Skull, Trash2, X } from "lucide-react";
import {
  newEncounterId,
  type EncounterRecord,
  type Playthrough,
} from "@/lib/playthroughs";
import { usePokemonSummaryList, useRouteData } from "@/lib/pokeapi";
import { SpriteImg } from "@/components/SpriteImg";
import { spriteUrl, type GameOption } from "@/lib/games";
import { formatPokemonName, cn } from "@/lib/utils";

type Status = EncounterRecord["status"];

const STATUS_META: Record<Status, { label: string; className: string }> = {
  team:    { label: "Team",    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" },
  boxed:   { label: "Boxed",   className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40" },
  fainted: { label: "Fainted", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40" },
  missed:  { label: "Missed",  className: "bg-muted text-muted-foreground border-border" },
};

interface Props {
  playthrough: Playthrough;
  game: GameOption;
  routeDataKey: string;
  onUpdate: (p: Playthrough) => void;
}

export function EncountersTab({ playthrough, game, routeDataKey, onUpdate }: Props) {
  const { data: routeData } = useRouteData(routeDataKey);
  const { data: pokemonList } = usePokemonSummaryList();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const encounters = playthrough.encounters ?? [];
  const enforceFirstOnly = playthrough.nuzlocke.firstEncounterOnly;
  const enforceSpeciesClause = playthrough.nuzlocke.speciesClause;

  // Routes already burned (have an encounter logged)
  const burnedRoutes = useMemo(() => {
    const set = new Set<string>();
    for (const e of encounters) set.add(e.locationKey);
    return set;
  }, [encounters]);

  // Species clause: an encounter is a clause violation if a non-missed entry
  // already exists with the same evolutionary line. We use species slug as a
  // cheap proxy — formal evolution-line checks would need extra data.
  const caughtSpecies = useMemo(() => {
    const set = new Set<string>();
    for (const e of encounters) {
      if (e.status !== "missed" && e.species) set.add(e.species);
    }
    return set;
  }, [encounters]);

  const pokemonById = useMemo(() => {
    const map = new Map<string, { id: number; name: string }>();
    if (!pokemonList) return map;
    for (const p of pokemonList) map.set(p.name, { id: p.id, name: p.name });
    return map;
  }, [pokemonList]);

  const handleAdd = useCallback((draft: Omit<EncounterRecord, "id" | "createdAt" | "updatedAt">) => {
    const now = Date.now();
    const rec: EncounterRecord = {
      ...draft,
      id: newEncounterId(),
      createdAt: now,
      updatedAt: now,
    };
    onUpdate({
      ...playthrough,
      encounters: [...encounters, rec],
      updatedAt: now,
    });
    setShowAdd(false);
  }, [playthrough, encounters, onUpdate]);

  const handleSave = useCallback((id: string, patch: Partial<EncounterRecord>) => {
    const next = encounters.map((e) =>
      e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e
    );
    onUpdate({ ...playthrough, encounters: next, updatedAt: Date.now() });
    setEditingId(null);
  }, [playthrough, encounters, onUpdate]);

  const handleDelete = useCallback((id: string) => {
    const next = encounters.filter((e) => e.id !== id);
    onUpdate({ ...playthrough, encounters: next, updatedAt: Date.now() });
  }, [playthrough, encounters, onUpdate]);

  const liveEncounters = encounters.filter((e) => e.status === "team" || e.status === "boxed");
  const cemetery = encounters.filter((e) => e.status === "fainted");
  const missed = encounters.filter((e) => e.status === "missed");

  return (
    <div className="flex flex-col gap-5 overflow-y-auto pt-3 pb-8">
      {/* Add button + summary */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showAdd ? "Cancel" : "Log encounter"}
        </button>
        <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
          <span>{liveEncounters.length} alive</span>
          <span>{cemetery.length} fainted</span>
          <span>{missed.length} missed</span>
          <span>{burnedRoutes.size} routes burned</span>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <EncounterForm
          locations={routeData?.locations ?? []}
          burnedRoutes={burnedRoutes}
          caughtSpecies={caughtSpecies}
          enforceFirstOnly={enforceFirstOnly}
          enforceSpeciesClause={enforceSpeciesClause}
          pokemonList={pokemonList ?? []}
          onSubmit={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Active encounters */}
      {liveEncounters.length > 0 && (
        <Section title="Team & Box" count={liveEncounters.length}>
          {liveEncounters.map((e) => (
            <EncounterRow
              key={e.id}
              encounter={e}
              pokemonSummary={pokemonById.get(e.species) ?? null}
              isEditing={editingId === e.id}
              onEdit={() => setEditingId(e.id)}
              onCancel={() => setEditingId(null)}
              onSave={(patch) => handleSave(e.id, patch)}
              onDelete={() => handleDelete(e.id)}
            />
          ))}
        </Section>
      )}

      {/* Cemetery */}
      {cemetery.length > 0 && (
        <Section
          title="Cemetery"
          count={cemetery.length}
          headerExtra={<Skull className="h-3.5 w-3.5 text-red-500" />}
        >
          {cemetery.map((e) => (
            <EncounterRow
              key={e.id}
              encounter={e}
              pokemonSummary={pokemonById.get(e.species) ?? null}
              isEditing={editingId === e.id}
              onEdit={() => setEditingId(e.id)}
              onCancel={() => setEditingId(null)}
              onSave={(patch) => handleSave(e.id, patch)}
              onDelete={() => handleDelete(e.id)}
            />
          ))}
        </Section>
      )}

      {/* Missed */}
      {missed.length > 0 && (
        <Section title="Missed" count={missed.length}>
          {missed.map((e) => (
            <EncounterRow
              key={e.id}
              encounter={e}
              pokemonSummary={pokemonById.get(e.species) ?? null}
              isEditing={editingId === e.id}
              onEdit={() => setEditingId(e.id)}
              onCancel={() => setEditingId(null)}
              onSave={(patch) => handleSave(e.id, patch)}
              onDelete={() => handleDelete(e.id)}
            />
          ))}
        </Section>
      )}

      {encounters.length === 0 && !showAdd && (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No encounters logged yet for <strong className="font-medium">{game.label}</strong>.
          Click <em>Log encounter</em> above to record your first.
        </div>
      )}
    </div>
  );
}

// ─── Add / Edit form ─────────────────────────────────────────────────────────

interface FormProps {
  locations: { key: string; label: string }[];
  burnedRoutes: Set<string>;
  caughtSpecies: Set<string>;
  enforceFirstOnly: boolean;
  enforceSpeciesClause: boolean;
  pokemonList: { id: number; name: string }[];
  initial?: Partial<EncounterRecord>;
  submitLabel?: string;
  onSubmit: (rec: Omit<EncounterRecord, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}

function EncounterForm({
  locations, burnedRoutes, caughtSpecies, enforceFirstOnly, enforceSpeciesClause,
  pokemonList, initial, submitLabel = "Add", onSubmit, onCancel,
}: FormProps) {
  const [locationKey, setLocationKey] = useState(initial?.locationKey ?? "");
  const [species, setSpecies] = useState(initial?.species ?? "");
  const [speciesQuery, setSpeciesQuery] = useState("");
  const [status, setStatus] = useState<Status>(initial?.status ?? "team");
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [level, setLevel] = useState<string>(initial?.level != null ? String(initial.level) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const selectedLocation = locations.find((l) => l.key === locationKey);
  const routeAlreadyBurned = enforceFirstOnly && locationKey && burnedRoutes.has(locationKey) && locationKey !== initial?.locationKey;
  const speciesAlreadyCaught = enforceSpeciesClause && species && status !== "missed" && caughtSpecies.has(species) && species !== initial?.species;

  const speciesSuggestions = useMemo(() => {
    const q = speciesQuery.trim().toLowerCase();
    if (!q) return [];
    return pokemonList
      .filter((p) => p.name.includes(q) || formatPokemonName(p.name).toLowerCase().includes(q))
      .slice(0, 8);
  }, [speciesQuery, pokemonList]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationKey || !selectedLocation) return;
    if (status !== "missed" && !species) return;
    onSubmit({
      locationKey,
      locationName: selectedLocation.label,
      species,
      nickname: nickname.trim() || undefined,
      level: level.trim() ? Number(level) : undefined,
      status,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Route</span>
          <select
            value={locationKey}
            onChange={(e) => setLocationKey(e.target.value)}
            required
            className="h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm"
          >
            <option value="">Select a route…</option>
            {locations.map((l) => (
              <option key={l.key} value={l.key} disabled={enforceFirstOnly && burnedRoutes.has(l.key) && l.key !== initial?.locationKey}>
                {l.label}{enforceFirstOnly && burnedRoutes.has(l.key) ? " (burned)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm"
          >
            <option value="team">Team</option>
            <option value="boxed">Boxed</option>
            <option value="fainted">Fainted</option>
            <option value="missed">Missed (fled / KO'd by mistake)</option>
          </select>
        </label>

        <label className="relative flex flex-col gap-1 text-xs sm:col-span-2">
          <span className="font-medium text-muted-foreground">
            Pokémon{status === "missed" ? " (optional)" : ""}
          </span>
          <input
            value={species ? formatPokemonName(species) : speciesQuery}
            onChange={(e) => { setSpecies(""); setSpeciesQuery(e.target.value); }}
            placeholder="Type to search…"
            className="h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm"
          />
          {!species && speciesSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border bg-background shadow-lg">
              {speciesSuggestions.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => { setSpecies(p.name); setSpeciesQuery(""); }}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <SpriteImg src={spriteUrl(p.id)} alt="" size="h-7 w-7" />
                  {formatPokemonName(p.name)}
                </button>
              ))}
            </div>
          )}
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Nickname (optional)</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Level (optional)</span>
          <input
            type="number"
            min="1"
            max="100"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs sm:col-span-2">
          <span className="font-medium text-muted-foreground">Notes (optional)</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. died to Whitney's Miltank rollout"
            className="h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm"
          />
        </label>
      </div>

      {(routeAlreadyBurned || speciesAlreadyCaught) && (
        <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {routeAlreadyBurned && <div>⚠ This route already has an encounter logged.</div>}
          {speciesAlreadyCaught && <div>⚠ Species clause: you already have this species on the team/box.</div>}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!locationKey || (status !== "missed" && !species)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────

function EncounterRow({
  encounter,
  pokemonSummary,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  encounter: EncounterRecord;
  pokemonSummary: { id: number; name: string } | null;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<EncounterRecord>) => void;
  onDelete: () => void;
}) {
  const [nickname, setNickname] = useState(encounter.nickname ?? "");
  const [status, setStatus] = useState<Status>(encounter.status);
  const [level, setLevel] = useState<string>(encounter.level != null ? String(encounter.level) : "");
  const [faintedAtLevel, setFaintedAtLevel] = useState<string>(encounter.faintedAtLevel != null ? String(encounter.faintedAtLevel) : "");
  const [faintedTo, setFaintedTo] = useState(encounter.faintedTo ?? "");
  const [notes, setNotes] = useState(encounter.notes ?? "");

  const meta = STATUS_META[encounter.status];
  const displayName = encounter.nickname || (encounter.species ? formatPokemonName(encounter.species) : "—");
  const speciesLabel = encounter.species ? formatPokemonName(encounter.species) : "Missed";

  if (isEditing) {
    return (
      <div className="rounded-lg border border-primary/40 bg-card p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">Nickname</span>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm">
              <option value="team">Team</option>
              <option value="boxed">Boxed</option>
              <option value="fainted">Fainted</option>
              <option value="missed">Missed</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">Level (when caught)</span>
            <input type="number" min="1" max="100" value={level} onChange={(e) => setLevel(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm" />
          </label>
          {status === "fainted" && (
            <>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Level when fainted</span>
                <input type="number" min="1" max="100" value={faintedAtLevel} onChange={(e) => setFaintedAtLevel(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                <span className="font-medium text-muted-foreground">Killed by</span>
                <input value={faintedTo} onChange={(e) => setFaintedTo(e.target.value)} placeholder="e.g. Whitney's Miltank" className="h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm" />
              </label>
            </>
          )}
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="font-medium text-muted-foreground">Notes</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm" />
          </label>
        </div>
        <div className="mt-3 flex justify-between gap-2">
          <button
            onClick={onDelete}
            className="flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
          <div className="flex gap-2">
            <button onClick={onCancel} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">Cancel</button>
            <button
              onClick={() => onSave({
                nickname: nickname.trim() || undefined,
                status,
                level: level.trim() ? Number(level) : undefined,
                faintedAtLevel: faintedAtLevel.trim() ? Number(faintedAtLevel) : undefined,
                faintedTo: faintedTo.trim() || undefined,
                notes: notes.trim() || undefined,
              })}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <Check className="h-3 w-3" />
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
      {pokemonSummary ? (
        <SpriteImg
          src={spriteUrl(pokemonSummary.id)}
          alt=""
          size="h-12 w-12"
          className={encounter.status === "fainted" ? "grayscale opacity-70" : undefined}
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded bg-muted text-muted-foreground">
          <X className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold">{displayName}</span>
          {encounter.nickname && encounter.species && (
            <span className="text-xs text-muted-foreground">{speciesLabel}</span>
          )}
          {encounter.level != null && (
            <span className="text-xs text-muted-foreground">Lv {encounter.level}</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {encounter.locationName}
          {encounter.faintedTo && <> · KO'd by <em>{encounter.faintedTo}</em></>}
          {encounter.notes && <> · {encounter.notes}</>}
        </div>
      </div>
      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", meta.className)}>
        {meta.label}
      </span>
      <button
        onClick={onEdit}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Edit"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Section({ title, count, headerExtra, children }: { title: string; count: number; headerExtra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {headerExtra}
        {title}
        <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium">{count}</span>
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
