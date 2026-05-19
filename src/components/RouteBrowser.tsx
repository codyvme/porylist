import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import { GAMES, GAMES_BY_VALUE, isInRanges } from "@/lib/games";
import { useRouteData, type RouteEncounter, type RouteLocation } from "@/lib/pokeapi";
import { spriteUrl } from "@/lib/games";
import { PokemonModal } from "@/components/PokemonModal";
import { Switch } from "@/components/ui/switch";
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
  "honey-tree":       "🍯",
  "cave-spots":       "🦇",
  "bridge-spots":     "🌉",
  "gift":             "🎁",
  "gift-egg":         "🎁",
};

// Method display order
const METHOD_ORDER = ["walk", "surf", "old-rod", "good-rod", "super-rod", "rock-smash", "headbutt", "headbutt-normal", "headbutt-special", "honey-tree", "grass-spots", "dark-grass-spots", "cave-spots", "bridge-spots", "surf-spots", "super-rod-spots", "gift", "gift-egg"];

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
            <div key={`${enc.id}-${method}-${i}`} className="flex items-center gap-3 rounded-md px-2 py-1 hover:bg-muted/50">
              {game && (
                <button
                  onClick={() => onToggleCaught(enc.name, caughtKey)}
                  className={cn(
                    "flex items-center justify-center rounded-full p-1.5 transition-colors",
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
                className="h-10 w-10 flex-shrink-0 object-contain"
                loading="lazy"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.onerror = null;
                  img.src = spriteUrl(enc.id, undefined);
                }}
              />
              <button
                className="text-left font-medium text-sm hover:underline focus:outline-none min-w-[140px]"
                onClick={() => onOpen(enc.name)}
              >
                {formatPokemonName(enc.name)}
              </button>
              <span className="text-xs text-muted-foreground tabular-nums min-w-[56px]">
                {enc.minLevel === enc.maxLevel ? `Lv ${enc.minLevel}` : `Lv ${enc.minLevel}–${enc.maxLevel}`}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground min-w-[32px]">{enc.chance}%</span>
              {enc.timeOfDay && (
                <Tooltip content={enc.timeOfDay.charAt(0).toUpperCase() + enc.timeOfDay.slice(1)}>
                  <span className="cursor-default text-sm">{TIME_ICON[enc.timeOfDay]}</span>
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
  const [showNational, setShowNational] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState<string | null>(null);

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
    setShowNational(false);
  };

  // When a specific version is selected (e.g. "gold"), track catches under that
  // key so Gold and Crystal stay separate. When "All" is selected, use the
  // group key (e.g. "gold-silver-crystal").
  const caughtKey = selectedVersion || game;

  // Catch progress: unique Pokémon in the current location
  const locationProgress = useMemo(() => {
    if (!selectedLocation || !game) return null;
    const caughtList = caught[caughtKey] ?? [];
    const uniqueNames = [...new Set(selectedLocation.encounters.map((e) => e.name))];
    return { count: uniqueNames.filter((n) => caughtList.includes(n)).length, total: uniqueNames.length };
  }, [selectedLocation, caughtKey, caught]);

  // Catch progress: unique Pokémon catchable across all routes in this game
  const gameProgress = useMemo(() => {
    if (!routeData || !game || !selectedGame) return null;
    const caughtList = caught[caughtKey] ?? [];
    const uniqueEntries = new Map<string, number>(); // name → id
    for (const loc of routeData.locations) {
      for (const enc of loc.encounters) {
        if (!uniqueEntries.has(enc.name)) uniqueEntries.set(enc.name, enc.id);
      }
    }
    const filtered = [...uniqueEntries.entries()].filter(([, id]) =>
      showNational ? id <= selectedGame.genMax : isInRanges(id, selectedGame.nativeRanges),
    );
    const total = filtered.length;
    const count = filtered.filter(([name]) => caughtList.includes(name)).length;
    return { count, total };
  }, [routeData, caughtKey, caught, selectedGame, showNational]);

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
        <label
          className={cn(
            "flex items-center gap-2 text-sm font-medium",
            game
              ? "cursor-pointer text-foreground"
              : "cursor-not-allowed text-muted-foreground/60",
          )}
        >
          <Switch
            checked={showNational}
            onChange={(e) => setShowNational(e.target.checked)}
            disabled={!game}
          />
          National Dex
        </label>
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
        <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr] overflow-hidden rounded-md border">
          {/* Location list */}
          <div className="flex min-h-0 flex-col border-r">
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

          {/* Encounter detail */}
          <div className="overflow-y-auto bg-white p-4">
            {!selectedLocation && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {routeData ? "Select a location from the list." : null}
              </div>
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
      )}

      {/* Catch progress footer */}
      {game && GAMES_WITH_ROUTES.has(game) && (gameProgress || locationProgress) && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          {gameProgress ? (
            <span className="flex items-center gap-1.5">
              <PokeballIcon caught={gameProgress.count > 0} size={13} />
              <span>
                <span className="font-medium text-foreground">
                  {selectedVersion ? (VERSION_LABELS[selectedVersion] ?? selectedVersion) : selectedGame!.label}
                </span>
                {": "}
                {gameProgress.count.toLocaleString()} / {gameProgress.total.toLocaleString()} caught via routes
              </span>
            </span>
          ) : <span />}
          {locationProgress && (
            <span className="flex items-center gap-1.5">
              <PokeballIcon caught={locationProgress.count > 0} size={13} />
              {locationProgress.count} / {locationProgress.total} in this location
            </span>
          )}
        </div>
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
