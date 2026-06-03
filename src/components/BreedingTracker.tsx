import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { SparkleBurst } from "@/components/SparkleBurst";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Egg, Pencil, Plus, RotateCcw, Settings, Archive, Star, Trash2, Trophy, X } from "lucide-react";
import { PokemonSearch } from "@/components/PokemonSearch";
import { EmptyState } from "@/components/EmptyState";
import { Select } from "@/components/ui/select";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { cn, formatPokemonName } from "@/lib/utils";
import { GAMES } from "@/lib/games";
import { spriteUrl } from "@/lib/games";
import { SpriteImg } from "@/components/SpriteImg";
import { usePokemonSummaryList, useMoveList } from "@/lib/pokeapi";
import {
  STATS,
  STAT_LABELS,
  STAT_FULL_LABELS,
  NATURES,
  NATURE_BOOSTS,
  BREEDING_GAMES,
  type BreedingProject,
  type HatchEntry,
  type StatName,
  type AbilitySlot,
  type GenderTarget,
  type BreedingStep,
  loadProjects,
  saveProjects,
  generateBreedingPlan,
  shinyOdds,
  eggsForOdds,
} from "@/lib/breeding";

import {
  fetchBreedingProjectsFromDB,
  upsertBreedingProject,
  deleteBreedingProject,
} from "@/lib/supabase";
import type { User } from "@/lib/supabase";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const BREEDING_GAME_OPTIONS = GAMES.filter((g) => BREEDING_GAMES.includes(g.value));

// ─── IV Dot Display ───────────────────────────────────────────────────────────

function IVDots({
  perfectIVs,
  targetIVs,
  size = "sm",
}: {
  perfectIVs: StatName[];
  targetIVs: StatName[];
  size?: "sm" | "xs";
}) {
  const perfect = new Set(perfectIVs);
  return (
    <div className="flex items-center gap-0.5">
      {targetIVs.map((stat) => (
        <span
          key={stat}
          title={`${STAT_LABELS[stat]}: ${perfect.has(stat) ? "31 ✓" : "not perfect"}`}
          className={cn(
            "inline-flex items-center justify-center rounded font-bold",
            size === "xs" ? "h-4 w-5 text-[9px]" : "h-5 w-6 text-[10px]",
            perfect.has(stat)
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground/40",
          )}
        >
          {STAT_LABELS[stat]}
        </span>
      ))}
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  selected,
  focused,
  cardRef,
  onClick,
}: {
  project: BreedingProject;
  selected: boolean;
  focused: boolean;
  cardRef?: (el: HTMLButtonElement | null) => void;
  onClick: () => void;
}) {
  const totalEggs = project.hatches.length;
  const bestIVs = project.hatches.reduce(
    (best, h) => Math.max(best, h.perfectIVs.filter((s) => project.targetIVs.includes(s)).length),
    0,
  );
  const successHatch = project.hatches.find((h) => h.isSuccess);
  const game = GAMES.find((g) => g.value === project.gameValue);

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : focused
            ? "border-primary/60 bg-muted/50"
            : "border-border hover:border-primary/40 hover:bg-muted/50",
      )}
    >
      <div className="flex items-center gap-3">
        <img
          src={spriteUrl(0, undefined)}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
          className="hidden"
          alt=""
        />
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          <PokemonMiniSprite species={project.targetSpecies} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{project.name}</span>
            {project.status === "completed" && (
              <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            )}
            {project.shinyHunting && (
              <Star className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            )}
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {totalEggs} egg{totalEggs !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{game?.label ?? project.gameValue}</span>
            {successHatch && <span>· ✓ #{project.hatches.indexOf(successHatch) + 1}</span>}
          </div>
          {project.targetIVs.length > 0 && (
            <div className="mt-1.5">
              <IVDots
                perfectIVs={bestIVs === project.targetIVs.length
                  ? project.targetIVs
                  : (project.hatches
                      .flatMap((h) => h.perfectIVs)
                      .filter((s) => project.targetIVs.includes(s)))}
                targetIVs={project.targetIVs}
                size="xs"
              />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Mini Sprite ──────────────────────────────────────────────────────────────

function PokemonMiniSprite({ species }: { species: string }) {
  const { data: summaryList } = usePokemonSummaryList();
  const entry = summaryList?.find((s) => s.name === species);
  if (!entry) return <Egg className="h-6 w-6 text-muted-foreground/40" />;
  return (
    <SpriteImg src={spriteUrl(entry.id, undefined)} alt={species} size="h-10 w-10" />
  );
}

// ─── New Project Form ────────────────────────────────────────────────────────

function NewProjectForm({
  onSave,
  onCancel,
  initialProject,
}: {
  onSave: (project: BreedingProject) => void;
  onCancel: () => void;
  initialProject?: BreedingProject;
}) {
  const { data: summaryList } = usePokemonSummaryList();
  const { data: moveList } = useMoveList();

  const isEditing = !!initialProject;

  const [speciesSlug, setSpeciesSlug] = useState<string | null>(
    initialProject?.targetSpecies ?? null,
  );
  const [speciesName, setSpeciesName] = useState(
    initialProject?.targetSpeciesName ?? "",
  );
  const [gameValue, setGameValue] = useState(
    initialProject?.gameValue ?? (BREEDING_GAME_OPTIONS[0]?.value ?? ""),
  );
  const [targetIVs, setTargetIVs] = useState<Set<StatName>>(
    initialProject ? new Set(initialProject.targetIVs) : new Set(STATS),
  );
  const [nature, setNature] = useState<string>(initialProject?.targetNature ?? "");
  const [ability, setAbility] = useState<AbilitySlot>(initialProject?.targetAbility ?? "any");
  const [gender, setGender] = useState<GenderTarget>(initialProject?.targetGender ?? "either");
  const [masuda, setMasuda] = useState(initialProject?.masudaMethod ?? false);
  const [shiny, setShiny] = useState(initialProject?.shinyHunting ?? false);
  const [moveSearch, setMoveSearch] = useState("");

  // Abilities for the selected species
  const speciesAbilities = useMemo(() => {
    if (!speciesSlug || !summaryList) return null;
    return summaryList.find((s) => s.name === speciesSlug)?.abilities ?? null;
  }, [speciesSlug, summaryList]);
  const [eggMoves, setEggMoves] = useState<string[]>(initialProject?.targetEggMoves ?? []);
  const [showMoveDrop, setShowMoveDrop] = useState(false);

  const moveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!moveRef.current?.contains(e.target as Node)) setShowMoveDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const moveSuggestions = useMemo(() => {
    if (!moveList || moveSearch.length < 1) return [];
    const q = moveSearch.toLowerCase();
    return moveList
      .filter(
        (m) =>
          (m.name.includes(q) || m.displayName.toLowerCase().includes(q)) &&
          !eggMoves.includes(m.name),
      )
      .slice(0, 8);
  }, [moveList, moveSearch, eggMoves]);

  const toggleIV = (stat: StatName) => {
    setTargetIVs((prev) => {
      const next = new Set(prev);
      if (next.has(stat)) next.delete(stat);
      else next.add(stat);
      return next;
    });
  };

  const handleSave = () => {
    if (!speciesSlug) return;
    const ivList = STATS.filter((s) => targetIVs.has(s));
    const project: BreedingProject = {
      // Preserve originals when editing, otherwise create fresh
      id: initialProject?.id ?? newId(),
      createdAt: initialProject?.createdAt ?? Date.now(),
      status: initialProject?.status ?? "active",
      ...(initialProject?.completedAt !== undefined ? { completedAt: initialProject.completedAt } : {}),
      hatches: initialProject?.hatches ?? [],
      // Updated fields
      name: speciesName || capitalize(speciesSlug.replace(/-/g, " ")),
      updatedAt: Date.now(),
      gameValue,
      targetSpecies: speciesSlug,
      targetSpeciesName: speciesName,
      targetNature: nature || null,
      targetAbility: ability,
      targetGender: gender,
      targetIVs: ivList,
      targetEggMoves: eggMoves,
      masudaMethod: masuda,
      shinyHunting: shiny,
    };
    onSave(project);
  };

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-1">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="rounded-md p-1.5 hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold">{isEditing ? "Edit Project" : "New Breeding Project"}</h2>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Target Pokémon */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Target Pokémon</label>
          <PokemonSearch
            value={speciesSlug}
            onChange={(name) => {
              setSpeciesSlug(name);
              setSpeciesName(name ? formatPokemonName(name) : "");
            }}
            filter={(p) => p.name === p.species.name}
          />
        </div>

        {/* Game */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Game</label>
          <Select value={gameValue} onChange={(e) => setGameValue(e.target.value)} className="w-full">
            {BREEDING_GAME_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </Select>
        </div>

        {/* Target IVs */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-sm font-medium">Perfect IVs needed</label>
          <div className="flex flex-wrap gap-2">
            {STATS.map((stat) => (
              <button
                key={stat}
                onClick={() => toggleIV(stat)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-bold transition-colors",
                  targetIVs.has(stat)
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {STAT_LABELS[stat]}
              </button>
            ))}
            <button
              onClick={() =>
                setTargetIVs((prev) =>
                  prev.size === STATS.length ? new Set() : new Set(STATS),
                )
              }
              className="rounded px-2.5 py-1 text-xs text-muted-foreground underline"
            >
              {targetIVs.size === STATS.length ? "Clear all" : "Select all"}
            </button>
          </div>
        </div>

        {/* Nature */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Nature</label>
          <Select value={nature} onChange={(e) => setNature(e.target.value)} className="w-full">
            <option value="">Any nature</option>
            {NATURES.map((n) => {
              const boost = NATURE_BOOSTS[n];
              return (
                <option key={n} value={n}>
                  {capitalize(n)}{boost ? ` (+${boost.up}/-${boost.down})` : " (neutral)"}
                </option>
              );
            })}
          </Select>
        </div>

        {/* Ability */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Ability</label>
          <Select
            value={ability}
            onChange={(e) => setAbility(e.target.value as AbilitySlot)}
            className="w-full"
            disabled={!speciesSlug}
          >
            <option value="any">Any ability</option>
            {speciesAbilities ? (
              <>
                {speciesAbilities
                  .filter((a) => !a.is_hidden)
                  .sort((a, b) => a.slot - b.slot)
                  .map((a) => (
                    <option key={a.slot} value={`slot${a.slot}` as AbilitySlot}>
                      {capitalize(a.ability.name.replace(/-/g, " "))}
                    </option>
                  ))}
                {speciesAbilities.filter((a) => a.is_hidden).map((a) => (
                  <option key="hidden" value="hidden">
                    {capitalize(a.ability.name.replace(/-/g, " "))} (Hidden)
                  </option>
                ))}
              </>
            ) : (
              <>
                <option value="slot1">Ability slot 1</option>
                <option value="slot2">Ability slot 2</option>
                <option value="hidden">Hidden Ability</option>
              </>
            )}
          </Select>
        </div>

        {/* Gender */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Gender</label>
          <Select value={gender} onChange={(e) => setGender(e.target.value as GenderTarget)} className="w-full">
            <option value="either">Either</option>
            <option value="male">♂ Male</option>
            <option value="female">♀ Female</option>
          </Select>
        </div>

        {/* Egg moves */}
        <div className="flex flex-col gap-1.5" ref={moveRef}>
          <label className="text-sm font-medium">Egg moves (optional)</label>
          {eggMoves.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {eggMoves.map((m) => (
                <span key={m} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                  {m.replace(/-/g, " ")}
                  <button onClick={() => setEggMoves((prev) => prev.filter((x) => x !== m))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {eggMoves.length < 4 && (
            <div className="relative">
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search moves…"
                value={moveSearch}
                onChange={(e) => { setMoveSearch(e.target.value); setShowMoveDrop(true); }}
                onFocus={() => setShowMoveDrop(true)}
              />
              {showMoveDrop && moveSuggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-md">
                  {moveSuggestions.map((m) => (
                    <button
                      key={m.name}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                      onClick={() => {
                        setEggMoves((prev) => [...prev, m.name]);
                        setMoveSearch("");
                        setShowMoveDrop(false);
                      }}
                    >
                      {m.displayName}
                      <span className="ml-auto text-xs capitalize text-muted-foreground">{m.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3 sm:col-span-2">
          <label className="text-sm font-medium">Options</label>
          <div className="flex flex-wrap gap-6">
            <label className="flex cursor-pointer items-start gap-2">
              <input type="checkbox" checked={masuda} onChange={(e) => setMasuda(e.target.checked)} className="mt-0.5" />
              <div>
                <p className="text-sm font-medium">Masuda Method</p>
                <p className="text-xs text-muted-foreground">
                  Breed with a Pokémon from a different language game. Raises shiny odds to ~1/683 (6× the base rate).
                </p>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input type="checkbox" checked={shiny} onChange={(e) => setShiny(e.target.checked)} className="mt-0.5" />
              <div>
                <p className="text-sm font-medium">Shiny hunting</p>
                <p className="text-xs text-muted-foreground">
                  Track cumulative shiny odds in the Stats tab and flag shiny hatches in your log.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={!speciesSlug}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isEditing ? "Save Changes" : "Create Project"}
        </button>
        <button onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Breeding Plan Accordion ──────────────────────────────────────────────────

const STEP_TYPE_COLORS: Record<string, string> = {
  prerequisite: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  parent: "bg-[hsl(193_91%_34%/0.15)] text-[hsl(193_91%_25%)] dark:text-[hsl(193_75%_55%)]",
  breed: "bg-[hsl(0_100%_69%/0.15)] text-[hsl(0_70%_45%)] dark:text-[hsl(0_100%_72%)]",
  note: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
};

const STEP_TYPE_LABELS: Record<string, string> = {
  prerequisite: "Egg move",
  parent: "Acquire parent",
  breed: "Breed",
  note: "Note",
};

function PlanAccordion({ steps }: { steps: BreedingStep[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([steps[0]?.id]));

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {steps.map((step) => {
        const isOpen = expanded.has(step.id);
        return (
          <div key={step.id} className="overflow-hidden rounded-lg border">
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              onClick={() => toggle(step.id)}
            >
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  STEP_TYPE_COLORS[step.type],
                )}
              >
                {STEP_TYPE_LABELS[step.type]}
              </span>
              <span className="flex-1 text-sm font-medium">{step.title}</span>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
            {isOpen && (
              <div className="border-t px-4 py-3">
                <p className="mb-2 text-sm text-muted-foreground">{step.description}</p>
                {step.details.length > 0 && (
                  <ul className="space-y-1">
                    {step.details.map((d, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="mt-0.5 shrink-0 text-muted-foreground">•</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Quick Entry Row ──────────────────────────────────────────────────────────

function QuickEntry({
  project,
  onAdd,
}: {
  project: BreedingProject;
  onAdd: (entry: Omit<HatchEntry, "id" | "timestamp">) => void;
}) {
  const [ivs, setIvs] = useState<Set<StatName>>(new Set());
  const [nature, setNature] = useState("");
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [moves, setMoves] = useState<Set<string>>(new Set());
  const [isShiny, setIsShiny] = useState(false);
  const [sparkleKey, setSparkleKey] = useState(0);

  const reset = () => {
    setIvs(new Set());
    setNature("");
    setGender(null);
    setMoves(new Set());
    setIsShiny(false);
  };

  const toggleIV = (stat: StatName) => {
    setIvs((prev) => {
      const next = new Set(prev);
      if (next.has(stat)) next.delete(stat);
      else next.add(stat);
      return next;
    });
  };

  const handleAdd = () => {
    onAdd({
      perfectIVs: STATS.filter((s) => ivs.has(s)),
      nature: nature || null,
      gender,
      eggMoves: project.targetEggMoves.filter((m) => moves.has(m)),
      isShiny,
      notes: "",
      isSuccess: false,
    });
    reset();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3">
      {/* IV toggles */}
      <div className="flex gap-1">
        {(project.targetIVs.length > 0 ? project.targetIVs : STATS).map((stat) => (
          <button
            key={stat}
            onClick={() => toggleIV(stat)}
            title={STAT_FULL_LABELS[stat]}
            className={cn(
              "h-7 w-8 rounded text-[11px] font-bold transition-colors",
              ivs.has(stat)
                ? "bg-emerald-500 text-white"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {STAT_LABELS[stat]}
          </button>
        ))}
      </div>

      {/* Nature */}
      <Select
        value={nature}
        onChange={(e) => setNature(e.target.value)}
        className="h-7 w-28 text-xs"
      >
        <option value="">Nature…</option>
        {NATURES.map((n) => (
          <option key={n} value={n}>{capitalize(n)}</option>
        ))}
      </Select>

      {/* Gender */}
      <div className="flex overflow-hidden rounded-md border">
        <button
          onClick={() => setGender((g) => (g === "male" ? null : "male"))}
          className={cn(
            "px-2 py-1 text-sm transition-colors",
            gender === "male" ? "bg-blue-500 text-white" : "hover:bg-muted",
          )}
        >
          ♂
        </button>
        <button
          onClick={() => setGender((g) => (g === "female" ? null : "female"))}
          className={cn(
            "border-l px-2 py-1 text-sm transition-colors",
            gender === "female" ? "bg-pink-500 text-white" : "hover:bg-muted",
          )}
        >
          ♀
        </button>
      </div>

      {/* Egg moves (if project has them) */}
      {project.targetEggMoves.length > 0 && (
        <div className="flex gap-1">
          {project.targetEggMoves.map((m) => (
            <button
              key={m}
              onClick={() =>
                setMoves((prev) => {
                  const next = new Set(prev);
                  if (next.has(m)) next.delete(m);
                  else next.add(m);
                  return next;
                })
              }
              title={m.replace(/-/g, " ")}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                moves.has(m)
                  ? "bg-violet-500 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {m.replace(/-/g, " ")}
            </button>
          ))}
        </div>
      )}

      {/* Shiny */}
      {project.shinyHunting && (
        <div className="relative">
          <button
            onClick={() => {
              const activating = !isShiny;
              setIsShiny((s) => !s);
              if (activating) setSparkleKey((k) => k + 1);
            }}
            className={cn(
              "rounded px-2 py-0.5 text-xs font-medium transition-colors",
              isShiny ? "bg-amber-400 text-white" : "bg-background text-muted-foreground hover:bg-muted",
            )}
            title="Shiny?"
          >
            ✦ Shiny
          </button>
          {sparkleKey > 0 && <SparkleBurst key={sparkleKey} />}
        </div>
      )}

      <button
        onClick={handleAdd}
        className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
      >
        Log Egg
      </button>
    </div>
  );
}

// ─── Hatch Log ────────────────────────────────────────────────────────────────

function HatchLog({
  project,
  onAddHatch,
  onMarkSuccess,
  onDeleteHatch,
}: {
  project: BreedingProject;
  onAddHatch: (entry: Omit<HatchEntry, "id" | "timestamp">) => void;
  onMarkSuccess: (id: string) => void;
  onDeleteHatch: (id: string) => void;
}) {
  const hatches = [...project.hatches].reverse(); // newest first

  return (
    <div className="flex flex-col gap-3">
      <QuickEntry project={project} onAdd={onAddHatch} />

      {project.hatches.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No eggs logged yet. Use the form above to add your first hatch.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="pb-2 pr-3">#</th>
                <th className="pb-2 pr-3">IVs</th>
                <th className="pb-2 pr-3">Nature</th>
                <th className="pb-2 pr-3">Gender</th>
                {project.targetEggMoves.length > 0 && <th className="pb-2 pr-3">Moves</th>}
                {project.shinyHunting && <th className="pb-2 pr-3">Shiny</th>}
                <th className="pb-2 pr-3">Time</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {hatches.map((h) => {
                const num = project.hatches.indexOf(h) + 1;
                return (
                  <tr
                    key={h.id}
                    className={cn(
                      "border-b last:border-0",
                      h.isSuccess && "bg-emerald-500/5",
                      h.isShiny && "bg-amber-500/5",
                    )}
                  >
                    <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                      {h.isSuccess && <Trophy className="mb-0.5 mr-1 inline h-3 w-3 text-amber-500" />}
                      {num}
                    </td>
                    <td className="py-2 pr-3">
                      <IVDots
                        perfectIVs={h.perfectIVs}
                        targetIVs={project.targetIVs.length > 0 ? project.targetIVs : STATS}
                        size="xs"
                      />
                    </td>
                    <td className="py-2 pr-3 text-xs capitalize">
                      {h.nature ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {h.gender === "male" ? (
                        <span className="text-blue-500">♂</span>
                      ) : h.gender === "female" ? (
                        <span className="text-pink-500">♀</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    {project.targetEggMoves.length > 0 && (
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-0.5">
                          {project.targetEggMoves.map((m) => (
                            <span
                              key={m}
                              className={cn(
                                "rounded px-1 py-0 text-[9px] font-medium",
                                h.eggMoves.includes(m)
                                  ? "bg-violet-500/20 text-violet-700 dark:text-violet-400"
                                  : "bg-muted text-muted-foreground/40",
                              )}
                              title={m.replace(/-/g, " ")}
                            >
                              {m.replace(/-/g, " ")}
                            </span>
                          ))}
                        </div>
                      </td>
                    )}
                    {project.shinyHunting && (
                      <td className="py-2 pr-3 text-xs">
                        {h.isShiny ? <span className="text-amber-500">✦</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                    )}
                    <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(h.timestamp)}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        {!h.isSuccess && (
                          <button
                            onClick={() => onMarkSuccess(h.id)}
                            title="Mark as the successful hatch — this was the one! Records it as the project goal achieved."
                            className="rounded p-0.5 text-muted-foreground hover:text-amber-500"
                          >
                            <Trophy className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteHatch(h.id)}
                          title="Delete"
                          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Stats Panel ──────────────────────────────────────────────────────────────

function StatsPanel({ project }: { project: BreedingProject }) {
  const total = project.hatches.length;
  const successHatch = project.hatches.find((h) => h.isSuccess);
  const successNum = successHatch ? project.hatches.indexOf(successHatch) + 1 : null;

  const bestCount = project.hatches.reduce(
    (best, h) =>
      Math.max(best, h.perfectIVs.filter((s) => project.targetIVs.includes(s)).length),
    0,
  );
  const targetCount = project.targetIVs.length;

  const shinies = project.hatches.filter((h) => h.isShiny).length;
  const odds = shinyOdds(total, project.masudaMethod);
  const eggs50 = eggsForOdds(0.5, project.masudaMethod);

  // Nature distribution
  const natureCounts: Record<string, number> = {};
  for (const h of project.hatches) {
    if (h.nature) natureCounts[h.nature] = (natureCounts[h.nature] ?? 0) + 1;
  }
  const topNatures = Object.entries(natureCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // IV milestone progression (eggs to first N-IV hatch)
  const milestones: { count: number; eggNum: number }[] = [];
  for (let n = 1; n <= targetCount; n++) {
    const first = project.hatches.findIndex(
      (h) => h.perfectIVs.filter((s) => project.targetIVs.includes(s)).length >= n,
    );
    if (first >= 0) milestones.push({ count: n, eggNum: first + 1 });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Egg summary */}
      <div className="rounded-lg border p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Egg summary
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total eggs hatched</span>
            <span className="font-semibold">{total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Best hatch</span>
            <span className="font-semibold">
              {total > 0 ? `${bestCount}/${targetCount} IVs` : "—"}
            </span>
          </div>
          {successNum && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Success at egg</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                #{successNum}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* IV milestones */}
      {milestones.length > 0 && (
        <div className="rounded-lg border p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            IV milestones
          </p>
          <div className="space-y-2 text-sm">
            {milestones.map((m) => (
              <div key={m.count} className="flex justify-between">
                <span className="text-muted-foreground">First {m.count}/{targetCount} IVs</span>
                <span className="font-semibold">egg #{m.eggNum}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shiny tracking */}
      {project.shinyHunting && (
        <div className="rounded-lg border p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Shiny tracking
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span className="font-semibold">
                {project.masudaMethod ? "Masuda (1/683)" : "Standard (1/4096)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cumulative odds</span>
              <span className="font-semibold">{(odds * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">50% odds at egg</span>
              <span className="font-semibold">#{eggs50}</span>
            </div>
            {shinies > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shinies found</span>
                <span className="font-semibold text-amber-500">✦ {shinies}</span>
              </div>
            )}
          </div>
          {/* Odds bar */}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-violet-500 transition-all"
              style={{ width: `${Math.min(odds * 100, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {(odds * 100).toFixed(2)}% cumulative
          </p>
        </div>
      )}

      {/* Nature distribution */}
      {topNatures.length > 0 && (
        <div className="rounded-lg border p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nature distribution
          </p>
          <div className="space-y-1.5 text-sm">
            {topNatures.map(([name, count]) => (
              <div key={name} className="flex items-center gap-2">
                <span className="w-20 capitalize text-muted-foreground">{name}</span>
                <div className="flex-1 overflow-hidden rounded-full bg-muted" style={{ height: 6 }}>
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Project Detail ───────────────────────────────────────────────────────────

type DetailTab = "plan" | "log" | "stats";

function ProjectDetail({
  project,
  onUpdate,
  onDelete,
  onBack,
  onEdit,
}: {
  project: BreedingProject;
  onUpdate: (updated: BreedingProject) => void;
  onDelete: () => void;
  onBack: () => void;
  onEdit: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("plan");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [eggData, setEggData] = useState<Record<string, { n: string; p: string; i: number; g: string[]; l: Record<string, number> }> | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  useEffect(() => {
    import("../data/egg-parents.json").then((m) => setEggData(m.default as typeof eggData));
  }, []);

  const plan = useMemo(
    () => generateBreedingPlan(project, eggData),
    [project, eggData],
  );

  const { data: summaryList } = usePokemonSummaryList();
  const entry = summaryList?.find((s) => s.name === project.targetSpecies);
  const game = GAMES.find((g) => g.value === project.gameValue);

  const handleAddHatch = useCallback(
    (partial: Omit<HatchEntry, "id" | "timestamp">) => {
      const hatch: HatchEntry = { id: newId(), timestamp: Date.now(), ...partial };
      onUpdate({ ...project, hatches: [...project.hatches, hatch], updatedAt: Date.now() });
    },
    [project, onUpdate],
  );

  const handleMarkSuccess = useCallback(
    (id: string) => {
      const hatches = project.hatches.map((h) => ({ ...h, isSuccess: h.id === id }));
      onUpdate({ ...project, hatches, status: "completed", completedAt: Date.now(), updatedAt: Date.now() });
    },
    [project, onUpdate],
  );

  const handleDeleteHatch = useCallback(
    (id: string) => {
      onUpdate({ ...project, hatches: project.hatches.filter((h) => h.id !== id), updatedAt: Date.now() });
    },
    [project, onUpdate],
  );

  const handleArchive = () => {
    onUpdate({
      ...project,
      status: project.status === "active" ? "abandoned" : "active",
      updatedAt: Date.now(),
    });
  };

  const tabCls = (t: DetailTab) =>
    cn(
      "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
      tab === t ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto min-w-0">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <button
          onClick={onBack}
          className="mt-0.5 shrink-0 rounded-md p-1.5 hover:bg-muted sm:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {entry && (
          <SpriteImg src={spriteUrl(entry.id, undefined)} alt={project.targetSpeciesName} size="h-14 w-14" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{project.name}</h2>
            {project.status === "completed" && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Completed
              </span>
            )}
            {project.status === "abandoned" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Archived
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{game?.label}</span>
            {project.targetNature && <span className="capitalize">{project.targetNature} nature</span>}
            {project.targetAbility !== "any" && (
              <span>
                {project.targetAbility === "hidden" ? "Hidden Ability" : `Ability ${project.targetAbility.replace("slot", "")}`}
              </span>
            )}
            {project.targetGender !== "either" && (
              <span>{project.targetGender === "male" ? "♂" : "♀"}</span>
            )}
            {project.shinyHunting && <span className="text-violet-500">✦ Shiny hunting</span>}
            {project.masudaMethod && <span>Masuda</span>}
          </div>
          {project.targetIVs.length > 0 && (
            <div className="mt-1.5">
              <IVDots
                perfectIVs={project.hatches.flatMap((h) => h.perfectIVs).filter((s) => project.targetIVs.includes(s))}
                targetIVs={project.targetIVs}
              />
            </div>
          )}
        </div>

        <div className="relative shrink-0 self-start" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Project settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border bg-background shadow-lg">
              <button onClick={() => { onEdit(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                <Pencil className="h-3.5 w-3.5" />Edit
              </button>
              <button onClick={() => { handleArchive(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                {project.status === "active" ? <Archive className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                {project.status === "active" ? "Archive" : "Restore"}
              </button>
              {project.status !== "active" && (
                <button onClick={() => { onDelete(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b pb-2">
        <button className={tabCls("plan")} onClick={() => setTab("plan")}>
          Breeding Plan
        </button>
        <button className={tabCls("log")} onClick={() => setTab("log")}>
          Hatch Log
          {project.hatches.length > 0 && (
            <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">
              {project.hatches.length}
            </span>
          )}
        </button>
        <button className={tabCls("stats")} onClick={() => setTab("stats")}>
          Stats
        </button>
      </div>

      {/* Tab content */}
      {tab === "plan" && (
        plan.length > 0 ? (
          <PlanAccordion steps={plan} />
        ) : (
          <p className="text-sm text-muted-foreground">No plan steps generated. Try adding target IVs or egg moves.</p>
        )
      )}
      {tab === "log" && (
        <HatchLog
          project={project}
          onAddHatch={handleAddHatch}
          onMarkSuccess={handleMarkSuccess}
          onDeleteHatch={handleDeleteHatch}
        />
      )}
      {tab === "stats" && <StatsPanel project={project} />}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BreedingTracker({ user }: { user: User | null }) {
  const [projects, setProjects] = useState<BreedingProject[]>(loadProjects);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const didSyncRef = useRef<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // On sign-in: pull projects from DB and merge with local (DB wins on conflict)
  useEffect(() => {
    if (!user || didSyncRef.current === user.id) return;
    didSyncRef.current = user.id;
    fetchBreedingProjectsFromDB(user.id).then((remote) => {
      if (remote.length === 0) return;
      setProjects((local) => {
        const merged = [...local];
        for (const rp of remote) {
          const idx = merged.findIndex((lp) => lp.id === rp.id);
          if (idx === -1) merged.push(rp);
          else if (rp.updatedAt > merged[idx].updatedAt) merged[idx] = rp;
        }
        saveProjects(merged);
        return merged;
      });
    });
  }, [user]);

  // Reset sync ref on sign-out so next sign-in re-syncs
  useEffect(() => {
    if (!user) didSyncRef.current = null;
  }, [user]);

  const persist = useCallback((next: BreedingProject[], changed?: BreedingProject, deletedId?: string) => {
    setProjects(next);
    saveProjects(next);
    if (user) {
      if (deletedId) deleteBreedingProject(deletedId);
      if (changed) upsertBreedingProject(user.id, changed);
    }
  }, [user]);

  const handleUpdate = useCallback(
    (updated: BreedingProject) => {
      persist(projects.map((p) => (p.id === updated.id ? updated : p)), updated);
    },
    [projects, persist],
  );

  const handleSaveNew = useCallback(
    (project: BreedingProject) => {
      persist([project, ...projects], project);
      setSelectedId(project.id);
      setIsCreating(false);
    },
    [projects, persist],
  );

  const handleSaveEdit = useCallback(
    (project: BreedingProject) => {
      persist(projects.map((p) => (p.id === project.id ? project : p)), project);
      setIsEditing(false);
    },
    [projects, persist],
  );

  const handleDelete = useCallback((projectId: string) => {
    setPendingDeleteId(projectId);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!pendingDeleteId) return;
    const next = projects.filter((p) => p.id !== pendingDeleteId);
    persist(next, undefined, pendingDeleteId);
    setSelectedId(null);
    setPendingDeleteId(null);
  }, [pendingDeleteId, projects, persist]);

  const pendingDeleteProject = pendingDeleteId
    ? projects.find((p) => p.id === pendingDeleteId) ?? null
    : null;

  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const { active, archived, visibleProjects } = useMemo(() => {
    const active = projects.filter((p) => p.status === "active");
    const archived = projects.filter((p) => p.status !== "active");
    return {
      active,
      archived,
      visibleProjects: showArchived ? [...active, ...archived] : active,
    };
  }, [projects, showArchived]);

  // Reset focus when the list changes size
  useEffect(() => { setFocusedIdx(-1); }, [visibleProjects.length]);

  // Keyboard navigation for the project list
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>();
  keyHandlerRef.current = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (isCreating || isEditing) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx((i) => {
        const next = i < visibleProjects.length - 1 ? i + 1 : 0;
        visibleProjects[next] && cardRefs.current.get(visibleProjects[next].id)?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => {
        const next = i > 0 ? i - 1 : visibleProjects.length - 1;
        visibleProjects[next] && cardRefs.current.get(visibleProjects[next].id)?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "Enter" && focusedIdx >= 0) {
      const p = visibleProjects[focusedIdx];
      if (p) { setSelectedId(p.id); setIsCreating(false); }
    } else if (e.key === "Escape") {
      setSelectedId(null);
      setIsCreating(false);
      setIsEditing(false);
      setFocusedIdx(-1);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyHandlerRef.current?.(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const showDetail = (selected || isCreating || isEditing);

  return (
    <div className="flex h-full flex-col px-6">
      <h1 className="shrink-0 text-xl font-semibold border-b border-border py-3 -mx-6 px-6">Breeding Tracker</h1>
      <div className="flex flex-1 min-h-0 gap-0 overflow-hidden">
      {/* Left panel: project list */}
      <div
        className={cn(
          "flex w-72 shrink-0 flex-col gap-3 overflow-y-auto pt-3 sm:pr-6",
          showDetail && "hidden sm:flex",
          projectsCollapsed && "sm:hidden",
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Projects</h2>
          <button
            onClick={() => { setIsCreating(true); setIsEditing(false); setSelectedId(null); }}
            className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </div>

        {active.length === 0 && !isCreating && (
          <EmptyState icon={Egg} title="No active projects" description="Create a project to start tracking your breeding sessions." />
        )}

        {active.map((p) => {
          const idx = visibleProjects.indexOf(p);
          return (
            <ProjectCard
              key={p.id}
              project={p}
              selected={p.id === selectedId}
              focused={idx === focusedIdx}
              cardRef={(el) => { if (el) cardRefs.current.set(p.id, el); else cardRefs.current.delete(p.id); }}
              onClick={() => { setSelectedId(p.id); setIsCreating(false); setFocusedIdx(idx); }}
            />
          );
        })}

        {archived.length > 0 && (
          <div>
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="flex w-full items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {showArchived ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Archived ({archived.length})
            </button>
            {showArchived && (
              <div className="mt-2 flex flex-col gap-2">
                {archived.map((p) => {
                  const idx = visibleProjects.indexOf(p);
                  return (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      selected={p.id === selectedId}
                      focused={idx === focusedIdx}
                      cardRef={(el) => { if (el) cardRefs.current.set(p.id, el); else cardRefs.current.delete(p.id); }}
                      onClick={() => { setSelectedId(p.id); setIsCreating(false); setFocusedIdx(idx); }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider with collapse toggle */}
      <div className="hidden sm:block relative shrink-0 w-6">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
        <button
          onClick={() => setProjectsCollapsed((v) => !v)}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors"
          title={projectsCollapsed ? "Show projects" : "Hide projects"}
        >
          {projectsCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </div>

      {/* Right panel: detail or create form */}
      <div
        className={cn(
          "flex flex-1 flex-col overflow-y-auto overflow-x-hidden pt-3 pb-3 sm:pb-6",
          projectsCollapsed ? "pl-2 sm:pl-4" : "pl-0 sm:pl-6",
          !showDetail && "hidden sm:flex",
        )}
      >
        {isCreating && (
          <NewProjectForm onSave={handleSaveNew} onCancel={() => setIsCreating(false)} />
        )}
        {!isCreating && isEditing && selected && (
          <NewProjectForm
            initialProject={selected}
            onSave={handleSaveEdit}
            onCancel={() => setIsEditing(false)}
          />
        )}
        {!isCreating && !isEditing && selected && (
          <ProjectDetail
            project={selected}
            onUpdate={handleUpdate}
            onDelete={() => handleDelete(selected.id)}
            onBack={() => setSelectedId(null)}
            onEdit={() => setIsEditing(true)}
          />
        )}
        {!isCreating && !selected && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <Egg className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="font-medium">Select a project</p>
              <p className="mt-1 text-sm text-muted-foreground">or create a new one to get started</p>
            </div>
            <button
              onClick={() => { setIsCreating(true); setIsEditing(false); }}
              className="mt-1 flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              New Project
            </button>
          </div>
        )}
      </div>
      </div>
      {pendingDeleteProject && (
        <ConfirmDeleteModal
          title="Delete project?"
          subject={pendingDeleteProject.name}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
}
