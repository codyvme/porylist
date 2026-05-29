import { useMemo, useState } from "react";
import { PokemonModal } from "@/components/PokemonModal";
import { Link } from "react-router-dom";
import {
  Backpack, Crosshair, Dna, Leaf, List, Scale,
  Sparkles, Swords, Trophy, Users, ArrowRight, Skull, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPokemonName } from "@/lib/utils";
import { spriteUrl, type GameOption } from "@/lib/games";
import { usePokemonSummaryList, usePokemonSpecies } from "@/lib/pokeapi";
import { TYPE_COLORS, typeStyle } from "@/lib/types";
import { loadPlaythroughs, VERSION_TO_GAME_GROUP, VERSION_DISPLAY_LABEL } from "@/lib/playthroughs";
import { GAMES_BY_VALUE } from "@/lib/games";

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

  const pokemon = useMemo(() => {
    if (pokemonList.length === 0) return null;
    const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return pokemonList[day % pokemonList.length];
  }, [pokemonList]);

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

  if (!pokemon) return (
    <div className="rounded-xl border bg-muted/30 h-48 animate-pulse" />
  );

  return (
    <>
      {modalOpen && (
        <PokemonModal
          pokemonName={pokemon.name}
          game={game ?? undefined}
          onClose={() => setModalOpen(false)}
          onNavigate={() => {}}
          prevPokemon={null}
          nextPokemon={null}
        />
      )}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${typeColor}18 0%, transparent 60%)` }}
      >
      <div className="flex flex-col sm:flex-row gap-4 p-5">

        {/* Sprite */}
        <div className="flex shrink-0 items-center justify-center sm:items-start">
          <img
            src={spriteUrl(pokemon.id, game?.spriteVersion)}
            alt={formatPokemonName(pokemon.name)}
            className="h-36 w-36 object-contain drop-shadow-sm"
          />
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-3 min-w-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Pokémon of the Day
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="group mt-0.5 inline-flex items-center gap-1.5"
            >
              <h2 className="text-2xl font-bold text-primary group-hover:underline underline-offset-2">
                {formatPokemonName(pokemon.name)}
              </h2>
              <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
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

          {/* Stats */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {pokemon.stats.map((s) => (
              <div key={s.stat.name} className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-[11px] font-semibold text-muted-foreground">
                  {STAT_LABELS[s.stat.name] ?? s.stat.name}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", statColor(s.base_stat))}
                    style={{ width: `${Math.min(100, (s.base_stat / 255) * 100)}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {s.base_stat}
                </span>
              </div>
            ))}
          </div>

          {/* Flavor text + link */}
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
      <Trophy className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
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
            to="/routes"
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
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
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
            <Link
              key={to}
              to={to}
              className="flex flex-col gap-2 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/50 transition-colors"
            >
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
            <Link
              key={to}
              to={to}
              className="flex flex-col gap-2 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/50 transition-colors"
            >
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

export function HomePage({ game }: { game: GameOption | null }) {
  return (
    <div className="flex flex-col gap-8 px-4 sm:px-6 py-6 max-w-4xl">
      <PokemonOfTheDay game={game} />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Your Playthroughs</h2>
          <Link to="/routes" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View all
          </Link>
        </div>
        <PlaythroughsSection />
      </section>

      <section>
        <h2 className="text-base font-semibold mb-3">Quick Links</h2>
        <QuickLinks />
      </section>
    </div>
  );
}
