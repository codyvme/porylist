import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { GAMES, GAMES_BY_VALUE } from "@/lib/games";
import { useRouteData, usePokemonList, type RouteEncounter, type RouteLocation } from "@/lib/pokeapi";
import { spriteUrl } from "@/lib/games";
import { PokemonModal } from "@/components/PokemonModal";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, formatPokemonName } from "@/lib/utils";

const VERSION_LABELS: Record<string, string> = {
  "red": "Red", "blue": "Blue", "yellow": "Yellow",
  "gold": "Gold", "silver": "Silver", "crystal": "Crystal",
  "ruby": "Ruby", "sapphire": "Sapphire", "emerald": "Emerald",
  "firered": "FireRed", "leafgreen": "LeafGreen",
  "diamond": "Diamond", "pearl": "Pearl", "platinum": "Platinum",
  "heartgold": "HeartGold", "soulsilver": "SoulSilver",
  "black": "Black", "white": "White", "black-2": "Black 2", "white-2": "White 2",
  "x": "X", "y": "Y",
  "omega-ruby": "Omega Ruby", "alpha-sapphire": "Alpha Sapphire",
  "sun": "Sun", "moon": "Moon",
  "ultra-sun": "Ultra Sun", "ultra-moon": "Ultra Moon",
  "lets-go-pikachu": "Let's Go, Pikachu!", "lets-go-eevee": "Let's Go, Eevee!",
  "scarlet": "Scarlet", "violet": "Violet",
  "legends-arceus": "Legends: Arceus",
  "brilliant-diamond": "Brilliant Diamond", "shining-pearl": "Shining Pearl",
};

const METHOD_ICONS: Record<string, string> = {
  "walk":             "🌿",
  "grass-spots":      "🌿",
  "dark-grass-spots": "🌿",
  "surf":             "🌊",
  "surf-spots":       "🌊",
  "old-rod":          "🎣",
  "good-rod":         "🎣",
  "super-rod":        "🎣",
  "super-rod-spots":  "🎣",
  "rock-smash":       "🪨",
  "headbutt":         "🌳",
  "headbutt-normal":  "🌳",
  "headbutt-special": "🌳",
  "headbutt-high":    "🌳",
  "headbutt-low":     "🌳",
  "honey-tree":       "🍯",
  "cave-spots":       "🦇",
  "bridge-spots":     "🌉",
  "gift":             "🎁",
  "gift-egg":         "🎁",
};

// Method display order
const METHOD_ORDER = ["walk", "surf", "old-rod", "good-rod", "super-rod", "rock-smash", "headbutt", "headbutt-normal", "headbutt-special", "headbutt-high", "headbutt-low", "honey-tree", "grass-spots", "dark-grass-spots", "cave-spots", "bridge-spots", "surf-spots", "super-rod-spots", "gift", "gift-egg"];

function methodOrder(method: string) {
  const i = METHOD_ORDER.indexOf(method);
  return i === -1 ? 99 : i;
}

const TIME_ICON: Record<string, string> = {
  morning: "🌅",
  day:     "☀️",
  night:   "🌙",
};

// Aggregate encounters by Pokémon+method+timeOfDay across versions (for "All" view)
function aggregateEncounters(encounters: RouteEncounter[]): RouteEncounter[] {
  const map = new Map<string, RouteEncounter>();
  for (const enc of encounters) {
    const key = `${enc.id}:${enc.method}:${enc.timeOfDay}`;
    if (!map.has(key)) {
      map.set(key, { ...enc, version: "" });
    } else {
      const ex = map.get(key)!;
      ex.minLevel = Math.min(ex.minLevel, enc.minLevel);
      ex.maxLevel = Math.max(ex.maxLevel, enc.maxLevel);
      ex.chance = Math.max(ex.chance, enc.chance);
    }
  }
  return [...map.values()];
}

function PokeballIcon({ caught, size = 14 }: { caught: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 8h13" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="2.5" fill={caught ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EncounterGroup({ method, methodLabel, encounters, spriteVersion, game, caughtKey, caught, onToggleCaught, onOpen }: {
  method: string;
  methodLabel: string;
  encounters: RouteEncounter[];
  spriteVersion: string | undefined;
  game: string;
  caughtKey: string;
  caught: Record<string, string[]>;
  onToggleCaught: (name: string, gameKey: string) => void;
  onOpen: (name: string) => void;
}) {
  const sorted = [...encounters].sort((a, b) => b.chance - a.chance || a.id - b.id);
  const icon = METHOD_ICONS[method];
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon && <span className="mr-1">{icon}</span>}{methodLabel}
      </p>
      <div className="space-y-1 mb-4">
        {sorted.map((enc, i) => {
          const isCaught = (caught[caughtKey] ?? []).includes(enc.name);
          return (
            <div key={`${enc.id}-${method}-${i}`} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50">
              {game && (
                <button
                  onClick={() => onToggleCaught(enc.name, caughtKey)}
                  className={cn(
                    "flex flex-shrink-0 items-center justify-center rounded-full p-1.5 transition-colors",
                    isCaught ? "text-red-500 hover:text-red-400" : "text-muted-foreground/30 hover:text-muted-foreground",
                  )}
                  aria-label={isCaught ? `Mark ${enc.name} as not caught` : `Mark ${enc.name} as caught`}
                >
                  <PokeballIcon caught={isCaught} size={15} />
                </button>
              )}
              <img
                src={spriteUrl(enc.id, spriteVersion)}
                alt={enc.name}
                className="h-8 w-8 flex-shrink-0 object-contain sm:h-10 sm:w-10"
                loading="lazy"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.onerror = null;
                  img.src = spriteUrl(enc.id, undefined);
                }}
              />
              <button
                className="flex-1 min-w-0 truncate text-left font-medium text-sm hover:underline focus:outline-none"
                onClick={() => onOpen(enc.name)}
              >
                {formatPokemonName(enc.name)}
              </button>
              <span className="flex-shrink-0 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {enc.minLevel === enc.maxLevel ? `Lv ${enc.minLevel}` : `Lv ${enc.minLevel}–${enc.maxLevel}`}
              </span>
              <span className="hidden sm:inline flex-shrink-0 text-xs tabular-nums text-muted-foreground">{enc.chance}%</span>
              {enc.timeOfDay && (
                <Tooltip content={enc.timeOfDay.charAt(0).toUpperCase() + enc.timeOfDay.slice(1)}>
                  <span className="flex-shrink-0 cursor-default text-sm">{TIME_ICON[enc.timeOfDay]}</span>
                </Tooltip>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LocationDetail({ location, versions, selectedVersion, spriteVersion, game, caughtKey, caught, onToggleCaught, onOpen }: {
  location: RouteLocation;
  versions: string[];
  selectedVersion: string;
  spriteVersion: string | undefined;
  game: string;
  caughtKey: string;
  caught: Record<string, string[]>;
  onToggleCaught: (name: string, gameKey: string) => void;
  onOpen: (name: string) => void;
}) {
  const filtered = selectedVersion
    ? location.encounters.filter((e) => e.version === selectedVersion)
    : aggregateEncounters(location.encounters);

  const byMethod = useMemo(() => {
    const groups = new Map<string, { label: string; encounters: RouteEncounter[] }>();
    for (const enc of filtered) {
      if (!groups.has(enc.method)) {
        groups.set(enc.method, { label: enc.methodLabel, encounters: [] });
      }
      groups.get(enc.method)!.encounters.push(enc);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => methodOrder(a) - methodOrder(b));
  }, [filtered]);

  if (filtered.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No encounters found for this version.
      </p>
    );
  }

  return (
    <div>
      {versions.length > 1 && selectedVersion && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Showing {VERSION_LABELS[selectedVersion] ?? selectedVersion} encounters</span>
        </div>
      )}
      {byMethod.map(([method, { label, encounters }]) => (
        <EncounterGroup
          key={method}
          method={method}
          methodLabel={label}
          encounters={encounters}
          spriteVersion={spriteVersion}
          game={game}
          caughtKey={caughtKey}
          caught={caught}
          onToggleCaught={onToggleCaught}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function MissingModal({ title, missing, spriteVersion, onOpen, onToggleCaught, caughtKey, caught, onClose }: {
  title: string;
  missing: { id: number; name: string }[];
  spriteVersion: string | undefined;
  onOpen: (name: string) => void;
  onToggleCaught: (name: string, gameKey: string) => void;
  caughtKey: string;
  caught: Record<string, string[]>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? missing.filter((p) => formatPokemonName(p.name).toLowerCase().includes(q)) : missing;
  }, [missing, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative flex h-[80vh] w-full max-w-lg flex-col rounded-xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{filtered.length} remaining</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-36 rounded-md border bg-background py-1 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search ? "No Pokémon match your search." : "Nothing missing — you caught them all!"}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {filtered.map((p) => {
                const isCaught = (caught[caughtKey] ?? []).includes(p.name);
                return (
                  <div key={p.id} className="flex flex-col items-center gap-0.5 rounded-lg border bg-white px-2 py-2 text-center">
                    <img
                      src={spriteUrl(p.id, spriteVersion)}
                      alt={p.name}
                      className="h-12 w-12 object-contain"
                      loading="lazy"
                      onError={(e) => { const img = e.currentTarget; img.onerror = null; img.src = spriteUrl(p.id, undefined); }}
                    />
                    <button
                      className="text-xs font-medium leading-tight hover:underline focus:outline-none"
                      onClick={() => onOpen(p.name)}
                    >
                      {formatPokemonName(p.name)}
                    </button>
                    <button
                      onClick={() => onToggleCaught(p.name, caughtKey)}
                      className={cn(
                        "mt-0.5 rounded-full p-1 transition-colors",
                        isCaught ? "text-red-500 hover:text-red-400" : "text-muted-foreground/30 hover:text-muted-foreground",
                      )}
                      aria-label={isCaught ? `Mark ${p.name} as not caught` : `Mark ${p.name} as caught`}
                    >
                      <PokeballIcon caught={isCaught} size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Games that have route data (gen 8+ don't have PokeAPI encounter data)
const GAMES_WITH_ROUTES = new Set([
  "red-blue-yellow", "gold-silver-crystal", "ruby-sapphire-emerald", "firered-leafgreen",
  "diamond-pearl-platinum", "heartgold-soulsilver", "black-white", "black2-white2",
  "x-y", "omega-ruby-alpha-sapphire", "sun-moon", "ultra-sun-ultra-moon", "lets-go",
]);

export function RouteBrowser({ caught, onToggleCaught }: {
  caught: Record<string, string[]>;
  onToggleCaught: (name: string, gameKey: string) => void;
}) {
  const [game, setGame] = useState(() => new URLSearchParams(window.location.search).get("routeGame") ?? "");
  const [locationKey, setLocationKey] = useState<string | null>(() => new URLSearchParams(window.location.search).get("route"));
  const [locationSearch, setLocationSearch] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(() => new URLSearchParams(window.location.search).get("routeVersion") ?? "");
  const [selectedPokemon, setSelectedPokemon] = useState<string | null>(null);
  const [missingMode, setMissingMode] = useState<"routes" | "dex" | null>(null);

  // Keep URL in sync so refresh/share preserves the current view
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (game) params.set("routeGame", game); else params.delete("routeGame");
    if (locationKey) params.set("route", locationKey); else params.delete("route");
    if (selectedVersion) params.set("routeVersion", selectedVersion); else params.delete("routeVersion");
    const qs = params.toString();
    history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [game, locationKey, selectedVersion]);

  const selectedGame = game ? GAMES_BY_VALUE[game] : undefined;
  const spriteVersion = selectedGame?.spriteVersion;

  const routeDataQuery = useRouteData(game || null);
  const routeData = routeDataQuery.data;

  // Derive actual versions present in this game's data
  const actualVersions = useMemo(() => {
    if (!routeData) return [];
    const versionSet = new Set<string>();
    for (const loc of routeData.locations) {
      for (const enc of loc.encounters) versionSet.add(enc.version);
    }
    return [...versionSet].sort();
  }, [routeData]);

  // Auto-select the first version when data loads (no "All" option)
  useEffect(() => {
    if (actualVersions.length > 0 && !selectedVersion) {
      setSelectedVersion(actualVersions[0]);
    }
  }, [actualVersions, selectedVersion]);

  const filteredLocations = useMemo(() => {
    if (!routeData) return [];
    const q = locationSearch.trim().toLowerCase();
    if (!q) return routeData.locations;
    return routeData.locations.filter((l) => l.label.toLowerCase().includes(q));
  }, [routeData, locationSearch]);

  const selectedLocation = useMemo(
    () => routeData?.locations.find((l) => l.key === locationKey) ?? null,
    [routeData, locationKey],
  );

  const handleGameChange = (newGame: string) => {
    setGame(newGame);
    setLocationKey(null);
    setLocationSearch("");
    setSelectedVersion("");
  };

  // When a specific version is selected (e.g. "gold"), track catches under that
  // key so Gold and Crystal stay separate. When "All" is selected, use the
  // group key (e.g. "gold-silver-crystal").
  const caughtKey = selectedVersion || game;

  // Catch progress: unique Pokémon in the current location for the selected version
  const locationProgress = useMemo(() => {
    if (!selectedLocation || !game) return null;
    const caughtList = caught[caughtKey] ?? [];
    const encounters = selectedVersion
      ? selectedLocation.encounters.filter((e) => e.version === selectedVersion)
      : selectedLocation.encounters;
    const uniqueNames = [...new Set(encounters.map((e) => e.name))];
    return { count: uniqueNames.filter((n) => caughtList.includes(n)).length, total: uniqueNames.length };
  }, [selectedLocation, selectedVersion, caughtKey, caught]);

  // Catch progress: unique Pokémon catchable across all routes in this game.
  // Uses the full route data as the source of truth — no ID filtering — so
  // cross-gen Pokémon (e.g. Pidgey in Johto routes) are counted correctly.
  // Also returns dexTotal (genMax) so the footer can show X/dex alongside X/routes.
  const gameProgress = useMemo(() => {
    if (!routeData || !game || !selectedGame) return null;
    const caughtList = caught[caughtKey] ?? [];
    const uniqueNames = new Set<string>();
    for (const loc of routeData.locations) {
      for (const enc of loc.encounters) uniqueNames.add(enc.name);
    }
    const routeTotal = uniqueNames.size;
    const count = [...uniqueNames].filter((n) => caughtList.includes(n)).length;
    return { count, routeTotal, dexTotal: selectedGame.genMax };
  }, [routeData, game, selectedGame, caughtKey, caught]);

  // Full Pokémon list up to genMax — used for the "missing from dex" modal
  const pokemonListQuery = usePokemonList(selectedGame?.genMax ?? 0);

  // Missing from routes (sorted by id)
  const missingFromRoutes = useMemo(() => {
    if (!routeData) return [];
    const caughtList = caught[caughtKey] ?? [];
    const seen = new Map<string, number>();
    for (const loc of routeData.locations) {
      for (const enc of loc.encounters) {
        if (!seen.has(enc.name)) seen.set(enc.name, enc.id);
      }
    }
    return [...seen.entries()]
      .filter(([name]) => !caughtList.includes(name))
      .map(([name, id]) => ({ name, id }))
      .sort((a, b) => a.id - b.id);
  }, [routeData, caughtKey, caught]);

  // Missing from full dex (sorted by id)
  const missingFromDex = useMemo(() => {
    if (!pokemonListQuery.data || !selectedGame) return [];
    const caughtList = caught[caughtKey] ?? [];
    return pokemonListQuery.data.results
      .map((entry) => {
        const id = Number(entry.url.match(/\/(\d+)\/?$/)?.[1]);
        return { name: entry.name, id };
      })
      .filter(({ id, name }) => id > 0 && id <= selectedGame.genMax && !caughtList.includes(name))
      .sort((a, b) => a.id - b.id);
  }, [pokemonListQuery.data, selectedGame, caughtKey, caught]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">Game</label>
          <Select value={game} onChange={(e) => handleGameChange(e.target.value)} className="min-w-[260px]">
            <option value="">Select a game…</option>
            {GAMES.filter((g) => GAMES_WITH_ROUTES.has(g.value)).map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </Select>
        </div>
        {actualVersions.length > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Version:</span>
            <div className="flex rounded-md border overflow-hidden text-xs font-medium">
              {actualVersions.map((v, i) => (
                <button
                  key={v}
                  onClick={() => setSelectedVersion(v)}
                  className={cn(
                    "px-2.5 py-1 transition-colors",
                    i > 0 && "border-l",
                    selectedVersion === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {VERSION_LABELS[v] ?? v}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* No data notice for gen 8+ */}
      {game && !GAMES_WITH_ROUTES.has(game) && (
        <div className="flex-1 min-h-0 flex items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
          Route data isn't available for this game yet — PokéAPI doesn't include encounter data for Gen 8+ games.
        </div>
      )}

      {/* Main layout */}
      {!game && (
        <div className="flex-1 min-h-0 flex items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
          Select a game to browse its routes and encounter tables.
        </div>
      )}

      {game && GAMES_WITH_ROUTES.has(game) && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-md border sm:grid sm:grid-cols-[280px_1fr]">
          {/* Location list — full screen on mobile when no location selected, sidebar on sm+ */}
          <div className={cn(
            "flex flex-1 min-h-0 flex-col sm:border-r",
            selectedLocation ? "hidden sm:flex" : "flex",
          )}>
            <div className="flex-shrink-0 border-b p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  placeholder="Search locations…"
                  className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {routeDataQuery.isLoading && (
                <div className="space-y-1 p-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              )}
              {filteredLocations.map((loc) => (
                <button
                  key={loc.key}
                  onClick={() => setLocationKey(loc.key)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                    locationKey === loc.key ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {loc.label}
                </button>
              ))}
              {routeData && filteredLocations.length === 0 && (
                <p className="p-4 text-center text-sm text-muted-foreground">No locations found.</p>
              )}
            </div>
          </div>

          {/* Encounter detail — full screen on mobile when location selected, panel on sm+ */}
          <div className={cn(
            "overflow-y-auto bg-white",
            selectedLocation ? "flex flex-col" : "hidden sm:flex sm:items-center sm:justify-center",
          )}>
            {/* Back button — mobile only */}
            {selectedLocation && (
              <button
                className="sm:hidden flex items-center gap-1.5 border-b px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground w-full flex-shrink-0"
                onClick={() => setLocationKey(null)}
              >
                <ArrowLeft className="h-4 w-4" />
                All locations
              </button>
            )}
            <div className={cn(selectedLocation ? "p-4 flex-1 overflow-y-auto" : "text-sm text-muted-foreground")}>
            {!selectedLocation && (
              <span>{routeData ? "Select a location from the list." : null}</span>
            )}
            {selectedLocation && (
              <>
                <h2 className="mb-4 text-lg font-semibold">{selectedLocation.label}</h2>
                <LocationDetail
                  location={selectedLocation}
                  versions={actualVersions}
                  selectedVersion={selectedVersion}
                  spriteVersion={spriteVersion}
                  game={game}
                  caughtKey={caughtKey}
                  caught={caught}
                  onToggleCaught={onToggleCaught}
                  onOpen={setSelectedPokemon}
                />
              </>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Catch progress footer */}
      {game && GAMES_WITH_ROUTES.has(game) && (gameProgress || locationProgress) && (
        <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-0">
          {gameProgress && (
            <>
              <span className="flex items-center gap-1.5">
                <PokeballIcon caught={gameProgress.count > 0} size={13} />
                <span className="font-medium text-foreground">
                  {selectedVersion ? (VERSION_LABELS[selectedVersion] ?? selectedVersion) : selectedGame!.label}
                </span>
              </span>
              <span className="hidden sm:inline text-muted-foreground/40">·</span>
              <button
                onClick={() => setMissingMode("routes")}
                className="hover:text-foreground hover:underline transition-colors text-left"
              >
                {gameProgress.count} / {gameProgress.routeTotal} routes
              </button>
              <span className="hidden sm:inline text-muted-foreground/40">·</span>
              <button
                onClick={() => setMissingMode("dex")}
                className="hover:text-foreground hover:underline transition-colors text-left"
              >
                {gameProgress.count} / {gameProgress.dexTotal} dex
              </button>
              {locationProgress && <span className="hidden sm:inline text-muted-foreground/40">·</span>}
            </>
          )}
          {locationProgress && (
            <span>
              {locationProgress.count} / {locationProgress.total} here
            </span>
          )}
        </div>
      )}

      {missingMode && (
        <MissingModal
          title={
            missingMode === "routes"
              ? `Missing from routes — ${selectedVersion ? (VERSION_LABELS[selectedVersion] ?? selectedVersion) : selectedGame!.label}`
              : `Missing from dex — ${selectedVersion ? (VERSION_LABELS[selectedVersion] ?? selectedVersion) : selectedGame!.label}`
          }
          missing={missingMode === "routes" ? missingFromRoutes : missingFromDex}
          spriteVersion={spriteVersion}
          onOpen={(name) => { setMissingMode(null); setSelectedPokemon(name); }}
          onToggleCaught={onToggleCaught}
          caughtKey={caughtKey}
          caught={caught}
          onClose={() => setMissingMode(null)}
        />
      )}

      {selectedPokemon && (
        <PokemonModal
          pokemonName={selectedPokemon}
          game={selectedGame}
          onClose={() => setSelectedPokemon(null)}
          onNavigate={setSelectedPokemon}
          prevPokemon={null}
          nextPokemon={null}
          caughtInGame={game ? (caught[caughtKey] ?? []).includes(selectedPokemon) : false}
          onToggleCaught={game ? () => onToggleCaught(selectedPokemon, caughtKey) : undefined}
        />
      )}
    </div>
  );
}
