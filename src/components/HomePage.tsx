import { useMemo, useState, useEffect, useLayoutEffect, useRef } from "react";
import { PokemonModal, CryButton } from "@/components/PokemonModal";
import { Link } from "react-router-dom";
import {
  Backpack, Crosshair, Dna, Leaf, List, Scale,
  Sparkles, Swords, Trophy, Users, ArrowRight, Skull,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPokemonName } from "@/lib/utils";
import { spriteUrl, SPRITES_ROOT, type GameOption, GAMES_BY_VALUE } from "@/lib/games";
import { usePokemonSummaryList, usePokemonSpecies } from "@/lib/pokeapi";
import { TYPE_COLORS, typeStyle } from "@/lib/types";
import { loadPlaythroughs, VERSION_TO_GAME_GROUP, VERSION_DISPLAY_LABEL } from "@/lib/playthroughs";
import { loadProjects } from "@/lib/breeding";
import { loadHunts, METHOD_LABELS, shinyRate, cumulativeProb } from "@/lib/shiny-hunts";
import { fetchDashboardConfig, upsertDashboardConfig, type User } from "@/lib/supabase";
import { SparkleBurst } from "@/components/SparkleBurst";

// ─── Module config ────────────────────────────────────────────────────────────

type ModuleId = "pokemon-of-the-day" | "playthroughs" | "breeding" | "shiny-hunts" | "quick-links";

interface ModuleDef {
  id: ModuleId;
  label: string;
}

const MODULE_DEFS: ModuleDef[] = [
  { id: "pokemon-of-the-day", label: "Pokémon of the Day" },
  { id: "playthroughs",       label: "Playthroughs"       },
  { id: "breeding",           label: "Breeding Projects"  },
  { id: "shiny-hunts",        label: "Shiny Hunts"        },
  { id: "quick-links",        label: "Quick Links"        },
];

// ─── Seeded shuffle ───────────────────────────────────────────────────────────

/** Fisher-Yates shuffle with a fixed seed (LCG) — same scrambled order every time. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = Math.imul(s, 1664525) + 1013904223 | 0;
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const POTD_SEED = 0x504f5459; // "POTY" in hex — fixed, never changes

const STORAGE_KEY = "porylist-dashboard-v1";

// ─── Shiny Hunts dashboard section ───────────────────────────────────────────

function ShinySection() {
  const hunts = useMemo(() => loadHunts(), []);
  const active = hunts.filter(h => h.status === "active");

  if (active.length === 0) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <span>No active hunts</span>
        <Link to="/shiny" className="flex items-center gap-1 text-xs text-primary hover:underline">
          Start one <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {active.slice(0, 3).map(hunt => {
        const game = GAMES_BY_VALUE[hunt.gameValue];
        const generation = game?.generation ?? 6;
        const p = shinyRate(hunt, generation);
        const cumPct = (cumulativeProb(p, hunt.count) * 100).toFixed(1);
        return (
          <Link
            key={hunt.id}
            to="/shiny"
            className="flex items-center gap-3 rounded-xl border p-3 hover:border-primary/40 hover:bg-muted/50 transition-colors"
          >
            <Sparkles className="h-5 w-5 shrink-0 text-yellow-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{hunt.speciesName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {METHOD_LABELS[hunt.method]} · {hunt.count.toLocaleString()} encounters
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold tabular-nums">{cumPct}%</p>
              <p className="text-[10px] text-muted-foreground">cumulative</p>
            </div>
          </Link>
        );
      })}
      {active.length > 3 && (
        <Link to="/shiny" className="text-xs text-muted-foreground hover:text-foreground text-center py-1">
          +{active.length - 3} more active hunt{active.length - 3 !== 1 ? "s" : ""}
        </Link>
      )}
    </div>
  );
}

function loadModuleConfig(): Record<ModuleId, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultConfig(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultConfig();
}

function defaultConfig(): Record<ModuleId, boolean> {
  return { "pokemon-of-the-day": true, playthroughs: true, breeding: true, "shiny-hunts": true, "quick-links": true };
}

function saveModuleConfig(cfg: Record<ModuleId, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

// ─── Module toggle dropdown ───────────────────────────────────────────────────

function ModuleToggle({
  config,
  onChange,
}: {
  config: Record<ModuleId, boolean>;
  onChange: (id: ModuleId, val: boolean) => void;
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
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Customize dashboard"
      >
        <Settings className="h-3.5 w-3.5" />
        Customize
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border bg-background shadow-lg">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Modules
          </p>
          {MODULE_DEFS.map(({ id, label }) => (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <input
                type="checkbox"
                checked={config[id]}
                onChange={(e) => onChange(id, e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pokémon of the Day ────────────────────────────────────────────────────────

const STAT_LABELS: Record<string, string> = {
  hp: "HP", attack: "Atk", defense: "Def",
  "special-attack": "SpA", "special-defense": "SpD", speed: "Spe",
};

function statColor(val: number): string {
  if (val >= 100) return "bg-green-500";
  if (val >= 60)  return "bg-yellow-500";
  return "bg-red-400";
}

function PokemonOfTheDay({ game }: { game: GameOption | null }) {
  const { data: pokemonList = [] } = usePokemonSummaryList();
  const [modalOpen, setModalOpen] = useState(false);
  const [showShiny, setShowShiny] = useState(false);
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const heroImgRef = useRef<HTMLImageElement>(null);

  const [sparkleKey, setSparkleKey] = useState(0);
  // Allow the modal to navigate to another species (e.g. via the evolution
  // chain) — when the user clicks a sibling Pokémon, swap the modal target.
  const [overrideName, setOverrideName] = useState<string | null>(null);

  const pokemon = useMemo(() => {
    if (pokemonList.length === 0) return null;
    // Pick from base species only — skip alt forms like "koraidon-limited-build",
    // "deoxys-attack", or Mega/regional variants. Each PokemonSummary's
    // canonical species entry has name === species.name.
    const baseSpecies = pokemonList.filter((p) => p.name === p.species.name);
    const shuffled = seededShuffle(baseSpecies, POTD_SEED);
    const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return shuffled[day % shuffled.length];
  }, [pokemonList]);

  useLayoutEffect(() => {
    const alreadyLoaded = heroImgRef.current?.complete && (heroImgRef.current.naturalWidth ?? 0) > 0;
    setSpriteLoaded(!!alreadyLoaded);
  }, [pokemon?.id]);

  const speciesName = pokemon?.species?.name ?? pokemon?.name ?? null;
  const { data: species } = usePokemonSpecies(speciesName);

  const flavorText = useMemo(() => {
    if (!species) return null;
    const english = species.flavor_text_entries.filter((e) => e.language.name === "en");
    if (game) {
      const gameVersions = new Set(game.value.split("-"));
      const entry = [...english].reverse().find((e) => gameVersions.has(e.version.name));
      if (entry) return entry.flavor_text.replace(/[\n\f]/g, " ");
    }
    return english[english.length - 1]?.flavor_text.replace(/[\n\f]/g, " ") ?? null;
  }, [species, game]);

  const primaryType = pokemon?.types[0]?.type.name ?? "normal";
  const typeColor = TYPE_COLORS[primaryType] ?? "#A8A8A8";

  if (!pokemon) return <div className="rounded-xl border bg-muted/30 h-48 animate-pulse" />;

  return (
    <>
      {modalOpen && (
        <PokemonModal
          pokemonName={overrideName ?? pokemon.name}
          game={game ?? undefined}
          onClose={() => { setModalOpen(false); setOverrideName(null); }}
          onNavigate={(name) => setOverrideName(name)}
          prevPokemon={null}
          nextPokemon={null}
        />
      )}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${typeColor}18 0%, transparent 60%)` }}
      >
        <div className="flex flex-col sm:flex-row gap-4 p-5">
          <div className="flex shrink-0 flex-col items-center gap-3">
            {(() => {
              const useGameSprite = game && pokemon.id <= game.genMax && game.spriteVersion;
              const normalSrc = useGameSprite
                ? `${SPRITES_ROOT}/versions/${game!.spriteVersion}/${pokemon.id}.png`
                : `${SPRITES_ROOT}/other/home/${pokemon.id}.png`;
              const shinySrc = useGameSprite
                ? `${SPRITES_ROOT}/versions/${game!.spriteVersion}/shiny/${pokemon.id}.png`
                : `${SPRITES_ROOT}/other/home/shiny/${pokemon.id}.png`;
              return (
                <div key={pokemon.id} className="relative h-36 w-36 animate-bounce-in">
                  {!spriteLoaded && <div className="absolute inset-0 skeleton-shimmer rounded-lg" />}
                  <img
                    ref={heroImgRef}
                    src={normalSrc}
                    alt={formatPokemonName(pokemon.name)}
                    onLoad={() => setSpriteLoaded(true)}
                    className={cn("absolute inset-0 h-36 w-36 object-contain drop-shadow-sm transition-opacity duration-200", showShiny ? "opacity-0" : "opacity-100")}
                  />
                  <img
                    src={shinySrc}
                    alt={`${formatPokemonName(pokemon.name)} shiny`}
                    className={cn("absolute inset-0 h-36 w-36 object-contain drop-shadow-sm transition-opacity duration-200", showShiny ? "opacity-100" : "opacity-0")}
                  />
                </div>
              );
            })()}
            <div className="relative">
              <button
                onClick={() => {
                  const activating = !showShiny;
                  setShowShiny((s) => !s);
                  if (activating) setSparkleKey((k) => k + 1);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  showShiny
                    ? "border-yellow-400 bg-yellow-400/10 text-yellow-500"
                    : "border-muted-foreground/30 text-muted-foreground hover:border-yellow-400 hover:text-yellow-500",
                )}
                aria-pressed={showShiny}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Shiny
              </button>
              {sparkleKey > 0 && <SparkleBurst key={sparkleKey} />}
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3 min-w-0">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Pokémon of the Day
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <button onClick={() => setModalOpen(true)} className="group inline-flex items-center">
                  <h2 className="text-2xl font-bold text-primary group-hover:underline underline-offset-2">
                    {formatPokemonName(pokemon.name)}
                  </h2>
                </button>
                <CryButton
                  id={pokemon.id}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {pokemon.types.map((t) => (
                  <span
                    key={t.type.name}
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize text-white"
                    style={typeStyle(t.type.name)}
                  >
                    {t.type.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {pokemon.stats.map((s, i) => (
                <div key={s.stat.name} className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-[11px] font-semibold text-muted-foreground">
                    {STAT_LABELS[s.stat.name] ?? s.stat.name}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full animate-stat-fill", statColor(s.base_stat))}
                      style={{ width: `${Math.min(100, (s.base_stat / 255) * 100)}%`, animationDelay: `${i * 60}ms` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {s.base_stat}
                  </span>
                </div>
              ))}
            </div>
            {flavorText && (
              <p className="text-xs italic text-muted-foreground leading-relaxed line-clamp-2">
                "{flavorText}"
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Playthroughs ─────────────────────────────────────────────────────────────

const COVER_JPG = new Set(["diamond", "emerald", "heartgold", "pearl", "soulsilver"]);
function coverArtUrl(version: string) {
  return `/images/covers/${version}.${COVER_JPG.has(version) ? "jpg" : "png"}`;
}

function PlaythroughsSection() {
  const playthroughs = useMemo(() => loadPlaythroughs().filter((p) => p.status === "active"), []);

  if (playthroughs.length === 0) return (
    <div className="rounded-xl border border-dashed p-6 text-center">
      <Trophy className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium text-muted-foreground">No active playthroughs</p>
      <p className="mt-1 text-xs text-muted-foreground/60">
        <Link to="/routes" className="underline underline-offset-2 hover:text-foreground">Start a run</Link> to track your progress.
      </p>
    </div>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {playthroughs.map((p) => {
        const group = VERSION_TO_GAME_GROUP[p.gameValue] ?? p.gameValue;
        const game = GAMES_BY_VALUE[group];
        const dexTotal = game?.genMax ?? 0;
        const pct = dexTotal > 0 ? (p.caught.length / dexTotal) * 100 : 0;
        const versionLabel = VERSION_DISPLAY_LABEL[p.gameValue] ?? game?.label ?? p.gameValue;
        return (
          <Link
            key={p.id}
            to={`/routes?run=${p.id}`}
            className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/50 transition-colors"
          >
            <div className="shrink-0 w-9 h-12 rounded overflow-hidden bg-muted flex items-center justify-center">
              <img
                src={coverArtUrl(p.gameValue)}
                alt={versionLabel}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-sm font-semibold truncate">{p.name}</span>
                {p.nuzlocke.enabled && <Skull className="h-3 w-3 shrink-0 text-red-500" />}
              </div>
              <p className="text-xs text-muted-foreground">{versionLabel}</p>
              {dexTotal > 0 && (
                <div className="mt-1.5">
                  <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                    {p.caught.length}/{dexTotal} caught
                  </p>
                </div>
              )}
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
          </Link>
        );
      })}
    </div>
  );
}

// ─── Breeding Projects ────────────────────────────────────────────────────────

function BreedingSection() {
  const projects = useMemo(() => loadProjects().filter((p) => p.status === "active"), []);

  if (projects.length === 0) return (
    <div className="rounded-xl border border-dashed p-6 text-center">
      <Dna className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium text-muted-foreground">No active breeding projects</p>
      <p className="mt-1 text-xs text-muted-foreground/60">
        <Link to="/breeding" className="underline underline-offset-2 hover:text-foreground">Start a project</Link> to track your breeding.
      </p>
    </div>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => {
        const eggCount = p.hatches.length;
        const bestIVs = p.hatches.reduce(
          (best, h) => Math.max(best, h.perfectIVs.filter((s) => p.targetIVs.includes(s)).length),
          0,
        );
        return (
          <Link
            key={p.id}
            to="/breeding"
            className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/50 transition-colors"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted overflow-hidden">
              <img
                src={spriteUrl(0)}
                alt={p.targetSpeciesName}
                onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.display = "block"; }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  (e.currentTarget.parentElement as HTMLElement).innerHTML = `<span class="text-lg">${p.targetSpeciesName[0] ?? "?"}</span>`;
                }}
                className="hidden h-10 w-10 object-contain"
              />
              <span className="text-sm font-bold text-muted-foreground">
                {p.targetSpeciesName.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {p.targetIVs.length > 0 ? `${p.targetIVs.length}IV` : ""}
                {p.targetNature ? ` · ${p.targetNature}` : ""}
                {p.shinyHunting ? " · Shiny" : ""}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                {eggCount} egg{eggCount !== 1 ? "s" : ""} hatched
                {bestIVs > 0 ? ` · best ${bestIVs}/${p.targetIVs.length} IVs` : ""}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
          </Link>
        );
      })}
    </div>
  );
}

// ─── Quick Links ──────────────────────────────────────────────────────────────

const REFERENCE_LINKS = [
  { to: "/pokedex",   Icon: List,     label: "Pokédex",    desc: "Browse every Pokémon" },
  { to: "/moves",     Icon: Swords,   label: "Moves",      desc: "Move data and learnsets" },
  { to: "/abilities", Icon: Sparkles, label: "Abilities",  desc: "All abilities and their effects" },
  { to: "/natures",   Icon: Leaf,     label: "Natures",    desc: "Nature stat modifiers" },
  { to: "/items",     Icon: Backpack, label: "Items",      desc: "Held items and their effects" },
];

const TOOL_LINKS = [
  { to: "/catch",    Icon: Crosshair, label: "Catch Calculator", desc: "Simulate catch probabilities" },
  { to: "/compare",  Icon: Scale,     label: "Compare",          desc: "Compare Pokémon side by side" },
  { to: "/team",     Icon: Users,     label: "Team Builder",     desc: "Build and analyze your team" },
  { to: "/breeding", Icon: Dna,       label: "Breeding Tracker", desc: "Track your breeding projects" },
  { to: "/routes",   Icon: Trophy,    label: "Playthroughs",     desc: "Track your game progress" },
];

function QuickLinks() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Reference</h3>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {REFERENCE_LINKS.map(({ to, Icon, label, desc }) => (
            <Link key={to} to={to} className="flex flex-col gap-2 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/50 transition-colors">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tools</h3>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {TOOL_LINKS.map(({ to, Icon, label, desc }) => (
            <Link key={to} to={to} className="flex flex-col gap-2 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/50 transition-colors">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HomePage({ game, user }: { game: GameOption | null; user: User | null }) {
  const [moduleConfig, setModuleConfig] = useState<Record<ModuleId, boolean>>(loadModuleConfig);
  const didSyncRef = useRef<string | null>(null);

  // On sign-in, pull config from DB and merge (DB wins over local)
  useEffect(() => {
    if (!user || didSyncRef.current === user.id) return;
    didSyncRef.current = user.id;
    fetchDashboardConfig(user.id).then((remote) => {
      if (!remote) return;
      setModuleConfig((local) => {
        const merged = { ...local, ...remote };
        saveModuleConfig(merged);
        return merged;
      });
    });
  }, [user]);

  // Reset sync ref on sign-out
  useEffect(() => {
    if (!user) didSyncRef.current = null;
  }, [user]);

  const toggleModule = (id: ModuleId, val: boolean) => {
    setModuleConfig((prev) => {
      const next = { ...prev, [id]: val };
      saveModuleConfig(next);
      if (user) upsertDashboardConfig(user.id, next);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-5 px-4 sm:px-6 pt-4 pb-6">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0 border-b border-border py-3 -mx-4 sm:-mx-6 px-4 sm:px-6 -mt-4">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <ModuleToggle config={moduleConfig} onChange={toggleModule} />
      </div>

      {moduleConfig["pokemon-of-the-day"] && (
        <PokemonOfTheDay game={game} />
      )}

      {moduleConfig["playthroughs"] && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Your Playthroughs</h2>
            <Link to="/routes" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View all
            </Link>
          </div>
          <PlaythroughsSection />
        </section>
      )}

      {moduleConfig["breeding"] && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Breeding Projects</h2>
            <Link to="/breeding" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View all
            </Link>
          </div>
          <BreedingSection />
        </section>
      )}

      {moduleConfig["shiny-hunts"] && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Shiny Hunts</h2>
            <Link to="/shiny" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View all
            </Link>
          </div>
          <ShinySection />
        </section>
      )}

      {moduleConfig["quick-links"] && (
        <section>
          <h2 className="text-base font-semibold mb-3">Quick Links</h2>
          <QuickLinks />
        </section>
      )}

    </div>
  );
}
