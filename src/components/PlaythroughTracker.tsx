import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchPlaythroughsFromDB,
  upsertPlaythrough,
  deletePlaythrough,
  type User,
} from "@/lib/supabase";
import { Archive, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Circle, Pencil, Plus, RotateCcw, Settings, Skull, Swords, Trash2, Trophy, X } from "lucide-react";
import { cn, formatPokemonName } from "@/lib/utils";
import { GAMES_BY_VALUE, SPRITES_ROOT, type GameOption } from "@/lib/games";
import { TYPE_COLORS } from "@/lib/types";
import { TypeBadge } from "@/components/TypeBadge";
import { computeTypeEffectiveness, ALL_TYPES } from "@/lib/type-chart";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { RouteBrowser } from "@/components/RouteBrowser";
import {
  BADGE_TYPE_SPECIALTY,
  GAME_BADGES,
  PLAYTHROUGH_VERSIONS,
  VERSION_TO_GAME_GROUP,
  VERSION_DISPLAY_LABEL,
  DEFAULT_NUZLOCKE,
  TRIAL_GAME_GROUPS,
  currentLevelCap,
  loadPlaythroughs,
  savePlaythroughs,
  newPlaythroughId,
  type Playthrough,
  type Badge,
  type NuzlockeOptions,
} from "@/lib/playthroughs";
import { EncountersTab } from "@/components/EncountersTab";
import { EmptyState } from "@/components/EmptyState";
import { PlaythroughTeamTab } from "@/components/PlaythroughTeamTab";
import { useTrainerData, usePokemonSummaryList, useItemList, typesForGeneration, type TrainerEntry, type ItemListEntry } from "@/lib/pokeapi";
import { MoveModal } from "@/components/MoveModal";
import { PokemonModal } from "@/components/PokemonModal";
import { AbilityModal } from "@/components/AbilityModal";
import { ItemModal } from "@/components/ItemModal";
import { SpriteImg } from "@/components/SpriteImg";

// ─── Helpers ──────────────────────────────────────────────────────────────────


/** Returns the public path for the cover art for an individual version slug. */
const COVER_JPG = new Set(["diamond", "emerald", "heartgold", "pearl", "soulsilver"]);
function coverArtUrl(version: string): string {
  const ext = COVER_JPG.has(version) ? "jpg" : "png";
  return `/images/covers/${version}.${ext}`;
}

// ─── Nuzlocke Options Form (shared) ───────────────────────────────────────────

const NUZLOCKE_RULES: Array<{ key: keyof NuzlockeOptions; label: string; description: string }> = [
  { key: "firstEncounterOnly", label: "First encounter per route only",         description: "Only the first wild Pokémon encountered on each route may be caught — flee or KO it and the route is burned." },
  { key: "releaseOnFaint",     label: "Release / permanently box on faint",     description: "Any Pokémon that faints is considered dead and must be permanently boxed or released." },
  { key: "speciesClause",      label: "Species clause (no duplicate species)",  description: "No duplicate species — if you've already caught Pidgey, skip the next Pidgey encounter." },
  { key: "nicknameClause",     label: "Nickname all Pokémon",                   description: "Every caught Pokémon must be nicknamed (you'll bond with them more and feel the losses harder)." },
  { key: "setMode",            label: "Set mode (no switching after reveal)",   description: "Disable battle-style switching — no swapping after the opponent reveals their next Pokémon." },
];

function NuzlockeOptionsForm({
  nuzlocke,
  onChange,
}: {
  nuzlocke: NuzlockeOptions;
  onChange: (n: NuzlockeOptions) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Nuzlocke</label>
      <label className="flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/50">
        <input
          type="checkbox"
          checked={nuzlocke.enabled}
          onChange={(e) => onChange({ ...nuzlocke, enabled: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <div>
          <p className="text-sm font-medium">Enable Nuzlocke mode</p>
          <p className="text-xs text-muted-foreground">Track this run with Nuzlocke rules</p>
        </div>
      </label>
      {nuzlocke.enabled && (
        <div className="ml-1 flex flex-col gap-1.5 border-l-2 border-primary/30 pl-3">
          {NUZLOCKE_RULES.map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={nuzlocke[key] as boolean}
                onChange={(e) => onChange({ ...nuzlocke, [key]: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Playthrough Card ─────────────────────────────────────────────────────────

function PlaythroughCard({
  playthrough,
  selected,
  onClick,
  onComplete,
  onArchive,
  onEdit,
  onDelete,
}: {
  playthrough: Playthrough;
  selected: boolean;
  onClick: () => void;
  onComplete: () => void;
  onArchive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const group = VERSION_TO_GAME_GROUP[playthrough.gameValue] ?? playthrough.gameValue;
  const dexTotal = GAMES_BY_VALUE[group]?.genMax ?? 0;
  const versionLabel = VERSION_DISPLAY_LABEL[playthrough.gameValue] ?? GAMES_BY_VALUE[group]?.label ?? playthrough.gameValue;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      className={cn(
        "relative w-full rounded-lg border transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted/50",
      )}
    >
      {/* Main clickable area */}
      <button onClick={onClick} className="w-full p-3 text-left">
        <div className="flex items-start gap-3 pr-6">
          {/* Cover art */}
          <div className="shrink-0 w-10 h-14 rounded overflow-hidden bg-muted flex items-center justify-center">
            <img
              src={coverArtUrl(playthrough.gameValue)}
              alt={versionLabel}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{playthrough.name}</span>
              {playthrough.status === "completed" && (
                <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              )}
              {playthrough.nuzlocke.enabled && (
                <span title="Nuzlocke"><Skull className="h-3.5 w-3.5 shrink-0 text-red-500" /></span>
              )}
            </div>
            {dexTotal > 0 && (
              <div className="mt-2">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{playthrough.caught.length}/{dexTotal} Pokédex</span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(playthrough.caught.length / dexTotal) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Gear menu */}
      <div className="absolute top-2 right-2" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Playthrough options"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border bg-background shadow-lg">
            {playthrough.status === "active" && (
              <button onClick={() => { onComplete(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                <CheckCircle2 className="h-3.5 w-3.5" />Complete
              </button>
            )}
            <button onClick={() => { onArchive(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
              {playthrough.status === "active" ? <Archive className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {playthrough.status === "active" ? "Archive" : "Restore"}
            </button>
            <button onClick={() => { onEdit(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" />Edit
            </button>
            {playthrough.status !== "active" && (
              <button onClick={() => { onDelete(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" />Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── New Playthrough Form ─────────────────────────────────────────────────────

function NewPlaythroughForm({
  onSave,
  onCancel,
}: {
  onSave: (p: Playthrough) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [gameValue, setGameValue] = useState(PLAYTHROUGH_VERSIONS[0]?.value ?? "");
  const [nuzlocke, setNuzlocke] = useState<NuzlockeOptions>({ ...DEFAULT_NUZLOCKE });

  const selectedVersion = PLAYTHROUGH_VERSIONS.find((v) => v.value === gameValue);

  const handleSave = () => {
    const playthrough: Playthrough = {
      id: newPlaythroughId(),
      name: name.trim() || `${selectedVersion?.label ?? gameValue} Run`,
      gameValue,
      status: "active",
      earnedBadges: [],
      caught: [],
      nuzlocke,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onSave(playthrough);
  };

  // Group versions by generation for <optgroup> sections
  const GEN_GROUPS: Array<{ label: string; groups: string[] }> = [
    { label: "Generation I",    groups: ["red-blue-yellow"] },
    { label: "Generation II",   groups: ["gold-silver-crystal"] },
    { label: "Generation III",  groups: ["ruby-sapphire-emerald", "firered-leafgreen"] },
    { label: "Generation IV",   groups: ["diamond-pearl-platinum", "heartgold-soulsilver"] },
    { label: "Generation V",    groups: ["black-white", "black2-white2"] },
    { label: "Generation VI",   groups: ["x-y", "omega-ruby-alpha-sapphire"] },
    { label: "Generation VII",  groups: ["sun-moon", "ultra-sun-ultra-moon", "lets-go"] },
    { label: "Generation VIII", groups: ["sword-shield", "brilliant-diamond-shining-pearl", "legends-arceus"] },
    { label: "Generation IX",   groups: ["scarlet-violet"] },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-1 pb-[calc(env(safe-area-inset-bottom)_+_3.5rem)] sm:pb-8">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="rounded-md p-1.5 hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold">New Playthrough</h2>
      </div>

      <div className="flex flex-col gap-4 max-w-sm">
        {/* Game */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Game</label>
          <Select value={gameValue} onChange={(e) => setGameValue(e.target.value)} className="w-full">
            {GEN_GROUPS.map((gen) => (
              <optgroup key={gen.label} label={gen.label}>
                {PLAYTHROUGH_VERSIONS.filter((v) => gen.groups.includes(v.group)).map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Name <span className="text-muted-foreground font-normal">(optional)</span></label>
          <input
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={`${selectedVersion?.label ?? ""} Run`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            autoFocus
          />
        </div>

        {/* Nuzlocke */}
        <NuzlockeOptionsForm nuzlocke={nuzlocke} onChange={setNuzlocke} />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Start Playthrough
        </button>
        <button onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Edit Playthrough Form ────────────────────────────────────────────────────

function EditPlaythroughForm({
  playthrough,
  onSave,
  onCancel,
}: {
  playthrough: Playthrough;
  onSave: (p: Playthrough) => void;
  onCancel: () => void;
}) {
  const versionLabel = VERSION_DISPLAY_LABEL[playthrough.gameValue] ?? playthrough.gameValue;
  const [name, setName] = useState(playthrough.name);
  const [nuzlocke, setNuzlocke] = useState<NuzlockeOptions>(playthrough.nuzlocke);

  const handleSave = () => {
    onSave({ ...playthrough, name: name.trim() || playthrough.name, nuzlocke, updatedAt: Date.now() });
  };

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-1 pb-[calc(env(safe-area-inset-bottom)_+_3.5rem)] sm:pb-8">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="rounded-md p-1.5 hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold">Edit Playthrough</h2>
      </div>

      <div className="flex flex-col gap-4 max-w-sm">
        {/* Game — read-only */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Game</label>
          <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
            {versionLabel}
          </div>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Name</label>
          <input
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            autoFocus
          />
        </div>

        {/* Nuzlocke */}
        <NuzlockeOptionsForm nuzlocke={nuzlocke} onChange={setNuzlocke} />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Save Changes
        </button>
        <button onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Badge Grid ───────────────────────────────────────────────────────────────

// ─── Trainer Team Modal ───────────────────────────────────────────────────────

function formatSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function TrainerTeamModal({ trainer, game, onClose }: { trainer: TrainerEntry; game: GameOption | undefined; onClose: () => void }) {
  const { data: summaryList = [] } = usePokemonSummaryList();
  const summaryByName = useMemo(() => {
    const map = new Map<string, typeof summaryList[number]>();
    for (const p of summaryList) map.set(p.name, p);
    return map;
  }, [summaryList]);

  const { data: itemList = [] } = useItemList();
  const itemBySlug = useMemo(() => {
    const map = new Map<string, ItemListEntry>();
    for (const item of itemList) map.set(item.name, item);
    return map;
  }, [itemList]);

  const [activeMove, setActiveMove] = useState<string | null>(null);
  const [activePokemon, setActivePokemon] = useState<string | null>(null);
  const [activeAbility, setActiveAbility] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ItemListEntry | null>(null);
  const closingMoveViaButtonRef = useRef(false);
  const closingPokemonViaButtonRef = useRef(false);
  const closingAbilityViaButtonRef = useRef(false);
  const closingItemViaButtonRef = useRef(false);

  // Escape: close inner modals first, then trainer modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (activePokemon) closePokemon();
      else if (activeMove) closeMove();
      else if (activeAbility) closeAbility();
      else if (activeItem) closeItem();
      else onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, activeMove, activePokemon, activeAbility, activeItem]); // eslint-disable-line react-hooks/exhaustive-deps

  const makePopstateHandler = (closingRef: React.MutableRefObject<boolean>, setter: (v: null) => void) => () => {
    if (!closingRef.current) setter(null);
    closingRef.current = false;
  };

  useEffect(() => {
    if (!activeMove) return;
    const handler = makePopstateHandler(closingMoveViaButtonRef, setActiveMove);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [activeMove]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activePokemon) return;
    const handler = makePopstateHandler(closingPokemonViaButtonRef, setActivePokemon);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [activePokemon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeAbility) return;
    const handler = makePopstateHandler(closingAbilityViaButtonRef, setActiveAbility);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [activeAbility]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeItem) return;
    const handler = makePopstateHandler(closingItemViaButtonRef, setActiveItem);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [activeItem]); // eslint-disable-line react-hooks/exhaustive-deps

  const openSubModal = (open: () => void) => {
    history.pushState(null, "", window.location.href);
    open();
  };
  const closeSubModal = (closingRef: React.MutableRefObject<boolean>, close: () => void) => {
    closingRef.current = true;
    close();
    history.back();
  };

  const openMove = (slug: string) => openSubModal(() => setActiveMove(slug));
  const closeMove = () => closeSubModal(closingMoveViaButtonRef, () => setActiveMove(null));
  const openPokemon = (species: string) => openSubModal(() => setActivePokemon(species));
  const closePokemon = () => closeSubModal(closingPokemonViaButtonRef, () => setActivePokemon(null));
  const openAbility = (slug: string) => openSubModal(() => setActiveAbility(slug));
  const closeAbility = () => closeSubModal(closingAbilityViaButtonRef, () => setActiveAbility(null));
  const openItem = (slug: string) => { const entry = itemBySlug.get(slug); if (entry) openSubModal(() => setActiveItem(entry)); };
  const closeItem = () => closeSubModal(closingItemViaButtonRef, () => setActiveItem(null));

  const isSubModalOpen = !!(activeMove || activePokemon || activeAbility || activeItem);

  return (
    <>
    {activeMove && <MoveModal name={activeMove} onClose={closeMove} />}
    {activePokemon && (
      <PokemonModal
        pokemonName={activePokemon}
        game={game}
        onClose={closePokemon}
        onNavigate={(name) => { history.replaceState(null, "", window.location.href); setActivePokemon(name); }}
        prevPokemon={null}
        nextPokemon={null}
      />
    )}
    {activeAbility && <AbilityModal name={activeAbility} game={game} onClose={closeAbility} />}
    {activeItem && <ItemModal item={activeItem} onClose={closeItem} />}
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", isSubModalOpen && "hidden")} onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border bg-background shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{trainer.class}</p>
            <h2 className="text-xl font-semibold">{trainer.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Team */}
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {trainer.team.map((mon, i) => {
            const spriteUrl = mon.ndex ? `${SPRITES_ROOT}/${mon.ndex}.png` : null;
            const displayName = formatPokemonName(mon.species);
            const summary = summaryByName.get(mon.species);
            const types = summary ? typesForGeneration(summary, game?.generation ?? 9) : [];
            const primaryColor = types[0] ? (TYPE_COLORS[types[0]] ?? null) : null;

            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border p-3"
                style={primaryColor ? {
                  borderColor: `${primaryColor}40`,
                  background: `linear-gradient(135deg, ${primaryColor}18 0%, transparent 60%)`,
                } : undefined}
              >
                {/* Sprite */}
                {spriteUrl ? (
                  <SpriteImg src={spriteUrl} alt={displayName} size="h-14 w-14" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center">
                    <span className="text-2xl">?</span>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <button
                      onClick={() => openPokemon(mon.species)}
                      className="font-semibold text-primary hover:underline transition-colors text-left"
                    >
                      {displayName}
                    </button>
                    {mon.level && (
                      <span className="text-xs text-muted-foreground">Lv. {mon.level}</span>
                    )}
                  </div>
                  {types.length > 0 && (
                    <div className="flex items-center gap-1 mt-0.5 mb-1.5">
                      {types.map(t => (
                        <TypeBadge key={t} type={t} size="sm" className="font-bold uppercase tracking-wide" />
                      ))}
                    </div>
                  )}
                  {mon.ability && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-bold">Ability: </span>
                      <button onClick={() => openAbility(mon.ability!)} className="text-primary hover:underline transition-colors">
                        {formatSlug(mon.ability)}
                      </button>
                    </p>
                  )}
                  {mon.heldItem && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-bold">Item: </span>
                      {itemBySlug.get(mon.heldItem) ? (
                        <button onClick={() => openItem(mon.heldItem!)} className="text-primary hover:underline transition-colors">
                          {formatSlug(mon.heldItem)}
                        </button>
                      ) : <span className="text-primary">{formatSlug(mon.heldItem)}</span>}
                    </p>
                  )}
                  {mon.moves.length > 0 && (
                    <div className="mt-2 flex flex-col gap-0.5">
                      {mon.moves.map((m, mi) => {
                        const moveColor = m.type ? (TYPE_COLORS[m.type] ?? null) : null;
                        return (
                          <button
                            key={mi}
                            onClick={() => openMove(m.name)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-opacity hover:opacity-70"
                            style={moveColor ? { backgroundColor: `${moveColor}18` } : undefined}
                          >
                            {m.type && (
                              <span
                                className="w-14 shrink-0 rounded-full py-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-white"
                                style={{ backgroundColor: moveColor ?? undefined }}
                              >
                                {m.type}
                              </span>
                            )}
                            <span className="text-xs font-medium capitalize">{formatSlug(m.name)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
}

function BadgesTab({
  playthrough,
  onUpdate,
}: {
  playthrough: Playthrough;
  onUpdate: (p: Playthrough) => void;
}) {
  const group = VERSION_TO_GAME_GROUP[playthrough.gameValue] ?? playthrough.gameValue;
  const game = GAMES_BY_VALUE[group];
  const badges: Badge[] = GAME_BADGES[group] ?? [];
  const earned = new Set(playthrough.earnedBadges);
  const [activeTrainer, setActiveTrainer] = useState<TrainerEntry | null>(null);

  const { data: trainerData } = useTrainerData(group);
  const trainersByBadge = useMemo(() => {
    const map = new Map<string, TrainerEntry>();
    for (const t of trainerData?.trainers ?? []) {
      if (t.badgeId) map.set(t.badgeId, t);
    }
    return map;
  }, [trainerData]);

  const eliteFour = useMemo(
    () => trainerData?.trainers.filter(t => t.class === "Elite Four" || t.class === "Champion") ?? [],
    [trainerData],
  );

  if (badges.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No badge data available for this game.
      </div>
    );
  }

  const toggle = (badge: Badge) => {
    const next = earned.has(badge.id)
      ? playthrough.earnedBadges.filter((id) => id !== badge.id)
      : [...playthrough.earnedBadges, badge.id];
    onUpdate({ ...playthrough, earnedBadges: next, updatedAt: Date.now() });
  };

  return (
    <>
      {activeTrainer && (
        <TrainerTeamModal trainer={activeTrainer} game={game} onClose={() => setActiveTrainer(null)} />
      )}
      <div className="flex flex-col gap-1">
        {badges.map((badge) => {
          const isEarned = earned.has(badge.id);
          const specialty = BADGE_TYPE_SPECIALTY[group]?.[badge.id];
          const trainer = trainersByBadge.get(badge.id);
          const subtitle = [badge.leader, badge.location, badge.aceLevel ? `Ace Lv. ${badge.aceLevel}` : null]
            .filter(Boolean).join(" · ");
          return (
            <div
              key={badge.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                isEarned ? "border-primary/30 bg-primary/5" : "border-border",
              )}
            >
              {/* Badge image */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                {badge.image ? (
                  <img
                    src={badge.image}
                    alt={badge.name}
                    className={cn("h-9 w-9 object-contain", !isEarned && "opacity-25 grayscale")}
                  />
                ) : (
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2",
                    isEarned ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                  )}>
                    {isEarned ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4 opacity-40" />}
                  </div>
                )}
              </div>

              {/* Badge + leader info */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn("text-sm font-semibold truncate", isEarned && "text-primary")}>
                    {badge.name}
                  </span>
                  {specialty && (
                    <TypeBadge type={specialty} size="sm" className="shrink-0" />
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground mt-1">{subtitle}</p>
              </div>

              {/* Buttons — icon-only to stay compact */}
              <div className="flex shrink-0 items-center gap-1.5">
                {trainer && (
                  <Tooltip content={`View ${trainer.name}'s team`} side="top">
                    <button
                      onClick={() => setActiveTrainer(trainer)}
                      className="flex items-center justify-center rounded-lg border p-2 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                    >
                      <Swords className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                )}
                <Tooltip content={isEarned ? "Mark as not earned" : "Mark as earned"} side="top">
                  <button
                    onClick={() => toggle(badge)}
                    className={cn(
                      "flex items-center justify-center rounded-lg border p-2 transition-colors",
                      isEarned
                        ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/50",
                    )}
                  >
                    {isEarned ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                  </button>
                </Tooltip>
              </div>
            </div>
          );
        })}

        {/* Elite Four & Champion */}
        {eliteFour.length > 0 && (
          <>
            <p className="mt-4 mb-1 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Elite Four &amp; Champion
            </p>
            {eliteFour.map((trainer) => (
              <div
                key={trainer.slug}
                className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
              >
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  trainer.class === "Champion" ? "bg-yellow-400/15 text-yellow-500" : "bg-primary/10 text-primary",
                )}>
                  {trainer.class === "Champion" ? <Trophy className="h-5 w-5" /> : <Swords className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{trainer.name}</p>
                  <p className="text-xs text-muted-foreground">{trainer.class} · {trainer.team.length} Pokémon</p>
                </div>
                <button
                  onClick={() => setActiveTrainer(trainer)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                >
                  <Swords className="h-3.5 w-3.5" />
                  Team
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}

// ─── Pokédex Tab (embedded RouteBrowser) ──────────────────────────────────────

function PokedexTab({
  playthrough,
  onUpdate,
  navigationTarget,
  game,
}: {
  playthrough: Playthrough;
  onUpdate: (p: Playthrough) => void;
  navigationTarget?: { gameValue: string; locationKey: string } | null;
  game: GameOption;
}) {
  // RouteBrowser's caughtKey = selectedVersion || gameValue.
  // With lockedVersion set, selectedVersion = the individual version (e.g. "emerald"),
  // so we map that version key and also the group key as a fallback.
  const group = VERSION_TO_GAME_GROUP[playthrough.gameValue] ?? playthrough.gameValue;
  const caughtForBrowser = useMemo(() => ({
    [playthrough.gameValue]: playthrough.caught,
    [group]: playthrough.caught,
  }), [playthrough.gameValue, playthrough.caught, group]);

  const handleToggleCaught = useCallback(
    (name: string, _key: string) => {
      const caught = playthrough.caught.includes(name)
        ? playthrough.caught.filter((n) => n !== name)
        : [...playthrough.caught, name];
      onUpdate({ ...playthrough, caught, updatedAt: Date.now() });
    },
    [playthrough, onUpdate],
  );

  return (
    <div className="flex flex-col -mx-6 -mt-1 sm:mt-0 sm:flex-1 sm:min-h-0">
      <RouteBrowser
        caught={caughtForBrowser}
        onToggleCaught={handleToggleCaught}
        game={game}
        navigationTarget={navigationTarget}
        embedded
        lockedVersion={playthrough.gameValue}
        teamOverride={(playthrough.team ?? []).map((m) => m.species)}
      />
    </div>
  );
}

// ─── Rules Tab ────────────────────────────────────────────────────────────────

function RulesTab({ playthrough, onUpdate }: { playthrough: Playthrough; onUpdate: (p: Playthrough) => void }) {
  const toggle = (key: keyof NuzlockeOptions) => {
    if (key === "enabled") return;
    onUpdate({
      ...playthrough,
      nuzlocke: { ...playthrough.nuzlocke, [key]: !playthrough.nuzlocke[key] },
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="flex flex-col gap-2 overflow-y-auto pt-3 pb-[calc(env(safe-area-inset-bottom)_+_3.5rem)] sm:pb-8">
      <p className="text-xs text-muted-foreground">
        Toggle Nuzlocke clauses for this run. Some clauses affect what the Encounters tab enforces (route burning, species duplicates).
      </p>
      {NUZLOCKE_RULES.map((rule) => {
        const active = playthrough.nuzlocke[rule.key] as boolean;
        return (
          <button
            key={rule.key}
            onClick={() => toggle(rule.key)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              active
                ? "border-red-500/40 bg-red-500/5 hover:bg-red-500/10"
                : "border-border bg-card hover:bg-muted/50",
            )}
            aria-pressed={active}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                active ? "border-red-500 bg-red-500 text-white" : "border-muted-foreground/40",
              )}
            >
              {active && <CheckCircle2 className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className={cn("text-sm font-medium", active ? "text-red-700 dark:text-red-300" : "text-foreground")}>
                {rule.label}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{rule.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Playthrough Detail ───────────────────────────────────────────────────────

type DetailTab = "badges" | "pokedex" | "encounters" | "team" | "rules";

function PlaythroughDetail({
  playthrough,
  onUpdate,
  onDelete,
  onBack,
  navigationTarget,
  startEditing = false,
  onEditConsumed,
}: {
  playthrough: Playthrough;
  onUpdate: (p: Playthrough) => void;
  onDelete: () => void;
  onBack: () => void;
  navigationTarget?: { gameValue: string; locationKey: string } | null;
  startEditing?: boolean;
  onEditConsumed?: () => void;
}) {
  const group = VERSION_TO_GAME_GROUP[playthrough.gameValue] ?? playthrough.gameValue;
  const game = GAMES_BY_VALUE[group];
  const badges = GAME_BADGES[group] ?? [];

  const [tab, setTab] = useState<DetailTab>("pokedex");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (startEditing) {
      setIsEditing(true);
      onEditConsumed?.();
    }
  }, [startEditing, onEditConsumed]);

  const handleArchive = () => {
    onUpdate({
      ...playthrough,
      status: playthrough.status === "active" ? "abandoned" : "active",
      updatedAt: Date.now(),
    });
  };

  const handleComplete = () => {
    onUpdate({ ...playthrough, status: "completed", updatedAt: Date.now() });
  };

  const tabCls = (t: DetailTab) =>
    cn(
      "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
      tab === t ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
    );

  const earned = playthrough.earnedBadges.length;
  const total = badges.length;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div className="flex flex-1 flex-col gap-2 sm:min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Back button — mobile only */}
        <button onClick={onBack} className="shrink-0 rounded-md p-1.5 hover:bg-muted sm:hidden">
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Name + info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold truncate sm:text-lg">{playthrough.name}</h2>
            {playthrough.nuzlocke.enabled && (
              <span className="shrink-0 flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                <Skull className="h-3 w-3" />Nuzlocke
              </span>
            )}
            {(() => {
              const cap = currentLevelCap(playthrough);
              if (!cap) return null;
              const recommended = cap.typeSpecialty
                ? (() => {
                    const eff = computeTypeEffectiveness([cap.typeSpecialty!], game?.generation ?? 9);
                    return ALL_TYPES.filter((t) => (eff[t] ?? 1) >= 2);
                  })()
                : [];
              const baseTitle = `Next: ${cap.nextBadge.leader ?? cap.nextBadge.name} — ace Lv ${cap.cap}`;
              const fullTitle = recommended.length > 0 && cap.typeSpecialty
                ? `${baseTitle}\n${cap.typeSpecialty} specialist — strong against ${cap.typeSpecialty} with: ${recommended.join(", ")}`
                : baseTitle;
              return (
                <span
                  className="shrink-0 flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300"
                  title={fullTitle}
                >
                  Lvl cap {cap.cap}
                </span>
              );
            })()}
            {playthrough.status === "completed" && (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">Completed</span>
            )}
            {playthrough.status === "abandoned" && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Archived</span>
            )}
          </div>
        </div>

        {/* Gear menu — all screen sizes */}
        <div className="relative shrink-0 self-start" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Playthrough settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border bg-background shadow-lg">
              {playthrough.status === "active" && (
                <button onClick={() => { handleComplete(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                  <CheckCircle2 className="h-3.5 w-3.5" />Complete
                </button>
              )}
              <button onClick={() => { handleArchive(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                {playthrough.status === "active" ? <Archive className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                {playthrough.status === "active" ? "Archive" : "Restore"}
              </button>
              <button onClick={() => { setIsEditing(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                <Pencil className="h-3.5 w-3.5" />Edit
              </button>
              {playthrough.status !== "active" && (
                <button onClick={() => { onDelete(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit form — replaces tabs when active */}
      {isEditing && (
        <EditPlaythroughForm
          playthrough={playthrough}
          onSave={(updated) => { onUpdate(updated); setIsEditing(false); }}
          onCancel={() => setIsEditing(false)}
        />
      )}

      {/* Tabs + tab content */}
      {!isEditing && (
        <>
          <div className="flex gap-1 shrink-0 flex-wrap">
            <button className={tabCls("pokedex")} onClick={() => setTab("pokedex")}>
              Pokédex
              {playthrough.caught.length > 0 && game && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">
                  {playthrough.caught.length}/{game.genMax}
                </span>
              )}
            </button>
            <button className={tabCls("badges")} onClick={() => setTab("badges")}>
              {TRIAL_GAME_GROUPS.has(group) ? "Trials" : "Badges"}
              {total > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">
                  {earned}/{total}
                </span>
              )}
            </button>
            {playthrough.nuzlocke.enabled && (
              <button className={tabCls("encounters")} onClick={() => setTab("encounters")}>
                Encounters
                {(playthrough.encounters?.length ?? 0) > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">
                    {playthrough.encounters?.length}
                  </span>
                )}
              </button>
            )}
            <button className={tabCls("team")} onClick={() => setTab("team")}>
              Team
              {(playthrough.team?.length ?? 0) > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">
                  {playthrough.team?.length}/6
                </span>
              )}
            </button>
            {playthrough.nuzlocke.enabled && (() => {
              const activeRulesCount = [
                playthrough.nuzlocke.firstEncounterOnly,
                playthrough.nuzlocke.releaseOnFaint,
                playthrough.nuzlocke.speciesClause,
                playthrough.nuzlocke.nicknameClause,
                playthrough.nuzlocke.setMode,
              ].filter(Boolean).length;
              return (
                <button className={tabCls("rules")} onClick={() => setTab("rules")}>
                  Rules
                  {activeRulesCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">
                      {activeRulesCount}
                    </span>
                  )}
                </button>
              );
            })()}
          </div>

          {tab === "badges" && (
            <div className="flex-1 overflow-y-auto pt-3 pr-1 pb-[calc(env(safe-area-inset-bottom)_+_3.5rem)] sm:pb-8">
              <BadgesTab playthrough={playthrough} onUpdate={onUpdate} />
            </div>
          )}
          {tab === "pokedex" && game && (
            <PokedexTab
              playthrough={playthrough}
              onUpdate={onUpdate}
              navigationTarget={navigationTarget}
              game={game}
            />
          )}
          {tab === "pokedex" && !game && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Unknown game.
            </div>
          )}
          {tab === "encounters" && game && (
            <EncountersTab
              playthrough={playthrough}
              game={game}
              routeDataKey={group}
              onUpdate={onUpdate}
            />
          )}
          {tab === "team" && (
            <PlaythroughTeamTab
              playthrough={playthrough}
              game={game}
              onUpdate={onUpdate}
            />
          )}
          {tab === "rules" && (
            <RulesTab playthrough={playthrough} onUpdate={onUpdate} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PlaythroughTracker({
  navigationTarget,
  user,
}: {
  navigationTarget?: { gameValue: string; locationKey: string } | null;
  user: User | null;
}) {
  const [searchParams] = useSearchParams();
  const [playthroughs, setPlaythroughs] = useState<Playthrough[]>(loadPlaythroughs);
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("run"));
  const [isCreating, setIsCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [runsCollapsed, setRunsCollapsed] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const didSyncRef = useRef<string | null>(null);

  // On sign-in: pull playthroughs from DB and merge (newer updatedAt wins)
  useEffect(() => {
    if (!user || didSyncRef.current === user.id) return;
    didSyncRef.current = user.id;
    fetchPlaythroughsFromDB(user.id).then((remote) => {
      if (remote.length === 0) return;
      setPlaythroughs((local) => {
        const merged = [...local];
        for (const rp of remote) {
          const idx = merged.findIndex((lp) => lp.id === rp.id);
          if (idx === -1) merged.push(rp);
          else if (rp.updatedAt > merged[idx].updatedAt) merged[idx] = rp;
        }
        savePlaythroughs(merged);
        return merged;
      });
    });
  }, [user]);

  // Reset sync ref on sign-out so the next sign-in re-syncs
  useEffect(() => {
    if (!user) didSyncRef.current = null;
  }, [user]);

  // Auto-select a playthrough matching the navigationTarget's game
  const didAutoSelectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!navigationTarget) return;
    const key = `${navigationTarget.gameValue}:${navigationTarget.locationKey}`;
    if (didAutoSelectRef.current === key) return;
    didAutoSelectRef.current = key;

    const match = playthroughs.find(
      (p) => p.gameValue === navigationTarget.gameValue && p.status === "active",
    );
    if (match) {
      setSelectedId(match.id);
      setIsCreating(false);
    }
  }, [navigationTarget, playthroughs]);

  const persist = useCallback((next: Playthrough[], changed?: Playthrough, deletedId?: string) => {
    setPlaythroughs(next);
    savePlaythroughs(next);
    if (user) {
      if (deletedId) deletePlaythrough(deletedId);
      if (changed) upsertPlaythrough(user.id, changed);
    }
  }, [user]);

  const handleSaveNew = useCallback(
    (p: Playthrough) => {
      persist([p, ...playthroughs], p);
      setSelectedId(p.id);
      setIsCreating(false);
    },
    [playthroughs, persist],
  );

  const handleUpdate = useCallback(
    (updated: Playthrough) => {
      persist(playthroughs.map((p) => (p.id === updated.id ? updated : p)), updated);
    },
    [playthroughs, persist],
  );

  const handleDelete = useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!pendingDeleteId) return;
    persist(playthroughs.filter((p) => p.id !== pendingDeleteId), undefined, pendingDeleteId);
    setSelectedId(null);
    setPendingDeleteId(null);
  }, [pendingDeleteId, playthroughs, persist]);

  const pendingDeletePlaythrough = pendingDeleteId
    ? playthroughs.find((p) => p.id === pendingDeleteId) ?? null
    : null;

  const active = playthroughs.filter((p) => p.status === "active");
  const archived = playthroughs.filter((p) => p.status !== "active");
  const selected = playthroughs.find((p) => p.id === selectedId) ?? null;
  const showDetail = selected || isCreating;

  return (
    <div className="flex flex-col px-6 sm:h-full">
      <h1 className={cn("shrink-0 text-xl font-semibold border-b border-border py-3 -mx-6 px-6", showDetail && "hidden sm:block")}>Playthroughs</h1>

      <div className="flex flex-1 min-w-0 overflow-hidden sm:min-h-0">
        {/* Left panel */}
        <div
          className={cn(
            "flex w-full sm:w-72 shrink-0 flex-col gap-3 overflow-y-auto pt-3 sm:pr-6",
            showDetail && "hidden sm:flex",
            runsCollapsed && "sm:hidden",
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Runs</h2>
            <button
              onClick={() => { setIsCreating(true); setSelectedId(null); }}
              className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>

          {active.length === 0 && !isCreating && (
            <EmptyState icon={Trophy} title="No active playthroughs" description="Start a new run to track your progress." />
          )}

          {active.map((p) => (
            <PlaythroughCard
              key={p.id}
              playthrough={p}
              selected={p.id === selectedId}
              onClick={() => { setSelectedId(p.id); setIsCreating(false); }}
              onComplete={() => handleUpdate({ ...p, status: "completed", updatedAt: Date.now() })}
              onArchive={() => handleUpdate({ ...p, status: p.status === "active" ? "abandoned" : "active", updatedAt: Date.now() })}
              onEdit={() => { setSelectedId(p.id); setIsCreating(false); setEditingId(p.id); }}
              onDelete={() => handleDelete(p.id)}
            />
          ))}

          {archived.length > 0 && (
            <div>
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="flex w-full items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <span>{showArchived ? "▾" : "▸"}</span>
                Archived ({archived.length})
              </button>
              {showArchived && (
                <div className="mt-2 flex flex-col gap-2">
                  {archived.map((p) => (
                    <PlaythroughCard
                      key={p.id}
                      playthrough={p}
                      selected={p.id === selectedId}
                      onClick={() => { setSelectedId(p.id); setIsCreating(false); }}
                      onComplete={() => handleUpdate({ ...p, status: "completed", updatedAt: Date.now() })}
                      onArchive={() => handleUpdate({ ...p, status: "active", updatedAt: Date.now() })}
                      onEdit={() => { setSelectedId(p.id); setIsCreating(false); setEditingId(p.id); }}
                      onDelete={() => handleDelete(p.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider with collapse toggle */}
        <div className="hidden sm:block relative shrink-0 w-6">
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
          <button
            onClick={() => setRunsCollapsed((v) => !v)}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors"
            title={runsCollapsed ? "Show runs" : "Hide runs"}
          >
            {runsCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </div>

        {/* Right panel */}
        <div
          className={cn(
            "flex flex-1 min-w-0 flex-col sm:overflow-y-auto pt-2 pb-3 sm:pt-3 sm:pb-6",
            runsCollapsed ? "pl-2 sm:pl-4" : "pl-0 sm:pl-6",
            !showDetail && "hidden sm:flex",
          )}
        >
          {isCreating && (
            <NewPlaythroughForm onSave={handleSaveNew} onCancel={() => setIsCreating(false)} />
          )}
          {!isCreating && selected && (
            <PlaythroughDetail
              playthrough={selected}
              onUpdate={handleUpdate}
              onDelete={() => handleDelete(selected.id)}
              onBack={() => setSelectedId(null)}
              navigationTarget={navigationTarget}
              startEditing={editingId === selected.id}
              onEditConsumed={() => setEditingId(null)}
            />
          )}
          {!isCreating && !selected && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-medium">Select a playthrough</p>
                <p className="mt-1 text-sm text-muted-foreground">or start a new run to get going</p>
              </div>
              <button
                onClick={() => setIsCreating(true)}
                className="mt-1 flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                New Playthrough
              </button>
            </div>
          )}
        </div>
      </div>
      {pendingDeletePlaythrough && (
        <ConfirmDeleteModal
          title="Delete playthrough?"
          subject={pendingDeletePlaythrough.name}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
}
