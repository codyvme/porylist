import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, X } from "lucide-react";
import { GAMES_BY_VALUE, type GameOption } from "@/lib/games";
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
  "brown-grass":      "🌿",
  "surf":             "🌊",
  "surf-spots":       "🌊",
  "beach":            "🏖️",
  "puddles":          "💧",
  "old-rod":          "🎣",
  "good-rod":         "🎣",
  "super-rod":        "🎣",
  "super-rod-spots":  "🎣",
  "fish-old":         "🎣",
  "fish-good":        "🎣",
  "fish-super":       "🎣",
  "rock-smash":       "🪨",
  "headbutt":         "🌳",
  "headbutt-a":       "🌳",
  "headbutt-b":       "🌳",
  "headbutt-normal":  "🌳",
  "headbutt-special": "🌳",
  "headbutt-high":    "🌳",
  "headbutt-low":     "🌳",
  "honey-tree":       "🍯",
  "cave":             "🦇",
  "cave-spots":       "🦇",
  "bridge-spots":     "🌉",
  "building":         "🏠",
  "1f":               "🏢",
  "2f":               "🏢",
  "3f":               "🏢",
  "4f":               "🏢",
  "5f":               "🏢",
  "dirt":             "🪨",
  "sand":             "🏜️",
  "flying":           "🦅",
  "poke-radar":       "📡",
  "pokeradar":        "📡",
  "pokeradar-chain":  "📡",
  "backlot":          "🏡",
  "gift":             "🎁",
  "gift-egg":         "🎁",
  "curry":            "🍛",
  "hoenn-sound":      "📻",
  "sinnoh-sound":     "📻",
  "swarm":            "🌀",
};

// Method display order
const METHOD_ORDER = [
  "walk", "brown-grass", "surf", "beach", "puddles",
  "old-rod", "good-rod", "super-rod", "fish-old", "fish-good", "fish-super",
  "rock-smash", "headbutt", "headbutt-a", "headbutt-b", "headbutt-normal", "headbutt-special", "headbutt-high", "headbutt-low",
  "honey-tree", "grass-spots", "dark-grass-spots", "cave", "cave-spots", "bridge-spots",
  "surf-spots", "super-rod-spots", "dirt", "sand", "flying", "building", "backlot",
  "poke-radar", "pokeradar", "pokeradar-chain", "curry", "gift", "gift-egg",
  "hoenn-sound", "sinnoh-sound", "swarm",
];

function methodOrder(method: string) {
  const i = METHOD_ORDER.indexOf(method);
  return i === -1 ? 99 : i;
}

const TIME_ICON: Record<string, string> = {
  morning:      "🌅",
  day:          "☀️",
  night:        "🌙",
  // SwSh weather conditions
  clear:        "☀️",
  cloudy:       "⛅",
  rain:         "🌧️",
  thunderstorm: "⛈️",
  snow:         "❄️",
  blizzard:     "🌨️",
  sandstorm:    "🌪️",
  sun:          "🌤️",
  fog:          "🌫️",
};

// Aggregate encounters by Pokémon+method+timeOfDay across versions (for "All" view)
function aggregateEncounters(encounters: RouteEncounter[]): RouteEncounter[] {
  const map = new Map<string, RouteEncounter>();
  for (const enc of encounters) {
    const key = `${enc.id}:${enc.method}:${enc.timeOfDay}`;
    if (!map.has(key)) {
      map.set(key, { ...enc, version: "", heldItems: [...enc.heldItems] });
    } else {
      const ex = map.get(key)!;
      ex.minLevel = Math.min(ex.minLevel, enc.minLevel);
      ex.maxLevel = Math.max(ex.maxLevel, enc.maxLevel);
      ex.chance = Math.max(ex.chance, enc.chance);
      // Merge held items (deduplicate by item name)
      for (const hi of enc.heldItems) {
        if (!ex.heldItems.some((h) => h.item === hi.item)) {
          ex.heldItems.push(hi);
        }
      }
    }
  }
  return [...map.values()];
}

function formatItemName(name: string): string {
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

interface MergedEncounter {
  id: number;
  name: string;
  heldItems: RouteEncounter["heldItems"];
  minLevel: number;
  maxLevel: number;
  sortChance: number; // highest chance across slots, for sorting
  timeSlots: Array<{ timeOfDay: string; chance: number }> | null;
  // null = identical across all time slots (or no time-of-day), show single %
  chance: number; // the single chance when timeSlots is null
}

function mergeEncountersByPokemon(encounters: RouteEncounter[]): MergedEncounter[] {
  const byId = new Map<number, RouteEncounter[]>();
  for (const enc of encounters) {
    if (!byId.has(enc.id)) byId.set(enc.id, []);
    byId.get(enc.id)!.push(enc);
  }

  const merged: MergedEncounter[] = [];
  for (const [id, encs] of byId) {
    const first = encs[0];
    const allSame =
      encs.length === 1 ||
      encs.every(
        (e) =>
          e.minLevel === first.minLevel &&
          e.maxLevel === first.maxLevel &&
          e.chance === first.chance,
      );

    const heldItems = first.heldItems ? [...first.heldItems] : [];
    for (const e of encs.slice(1)) {
      for (const hi of e.heldItems ?? []) {
        if (!heldItems.some((h) => h.item === hi.item)) heldItems.push(hi);
      }
    }

    const minLevel = Math.min(...encs.map((e) => e.minLevel));
    const maxLevel = Math.max(...encs.map((e) => e.maxLevel));
    const sortChance = Math.max(...encs.map((e) => e.chance));

    if (allSame) {
      // If every entry shares the same non-empty timeOfDay, preserve it as a
      // single-slot display (e.g. Hoothoot night-only → shows 🌙 85%).
      // If they span multiple different time slots at equal rates, suppress the
      // icons (e.g. Pidgey morning+day at 55% each → just show 55%).
      const sharedTime = first.timeOfDay && encs.every((e) => e.timeOfDay === first.timeOfDay)
        ? first.timeOfDay
        : null;
      merged.push({
        id,
        name: first.name,
        heldItems,
        minLevel,
        maxLevel,
        sortChance,
        timeSlots: sharedTime ? [{ timeOfDay: sharedTime, chance: first.chance }] : null,
        chance: first.chance,
      });
    } else {
      const timeSlots = encs
        .filter((e) => !!e.timeOfDay)
        .map((e) => ({ timeOfDay: e.timeOfDay!, chance: e.chance }));
      merged.push({
        id,
        name: first.name,
        heldItems,
        minLevel,
        maxLevel,
        sortChance,
        timeSlots: timeSlots.length > 0 ? timeSlots : null,
        chance: sortChance,
      });
    }
  }

  return merged;
}

function EncounterGroup({ method, methodLabel, encounters, spriteVersion, game, caughtKey, caught, onToggleCaught, onOpen, filterUncaught }: {
  method: string;
  methodLabel: string;
  encounters: RouteEncounter[];
  spriteVersion: string | undefined;
  game: string;
  caughtKey: string;
  caught: Record<string, string[]>;
  onToggleCaught: (name: string, gameKey: string) => void;
  onOpen: (name: string) => void;
  filterUncaught: boolean;
}) {
  const caughtList = caught[caughtKey] ?? [];
  const merged = mergeEncountersByPokemon(encounters);
  const sorted = merged
    .sort((a, b) => b.sortChance - a.sortChance || a.id - b.id)
    .filter((enc) => !filterUncaught || !caughtList.includes(enc.name));

  if (sorted.length === 0) return null;
  const icon = METHOD_ICONS[method];
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon && <span className="mr-1">{icon}</span>}{methodLabel}
      </p>
      <div className="space-y-1 mb-4">
        {sorted.map((enc) => {
          const isCaught = caughtList.includes(enc.name);
          return (
            <div key={`${enc.id}-${method}`} className="flex items-center gap-2 rounded-md px-2 py-0.5 hover:bg-muted/50">
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
                className="h-8 w-8 flex-shrink-0 object-contain sm:h-14 sm:w-14"
                loading="lazy"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.onerror = null;
                  img.src = spriteUrl(enc.id, undefined);
                }}
              />
              <div className="flex-1 min-w-0">
                <button
                  className="block truncate text-left font-medium text-sm hover:underline focus:outline-none max-w-full"
                  onClick={() => onOpen(enc.name)}
                >
                  {formatPokemonName(enc.name)}
                </button>
                {enc.heldItems?.length > 0 && (
                  <p className="truncate text-xs text-muted-foreground">
                    🎒 {enc.heldItems.map((h) => `${formatItemName(h.item)} (${h.rarity}%)`).join(", ")}
                  </p>
                )}
              </div>
              <span className="flex-shrink-0 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {enc.minLevel === enc.maxLevel ? `Lv ${enc.minLevel}` : `Lv ${enc.minLevel}–${enc.maxLevel}`}
              </span>
              {enc.timeSlots ? (
                <span className="hidden sm:flex flex-shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                  {enc.timeSlots.map(({ timeOfDay, chance }) => (
                    <Tooltip key={timeOfDay} content={timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1)}>
                      <span className="flex items-center gap-0.5 cursor-default">
                        <span>{TIME_ICON[timeOfDay]}</span>
                        <span>{chance}%</span>
                      </span>
                    </Tooltip>
                  ))}
                </span>
              ) : (
                <span className="hidden sm:inline flex-shrink-0 text-xs tabular-nums text-muted-foreground">{enc.chance}%</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LocationDetail({ location, selectedVersion, spriteVersion, game, caughtKey, caught, onToggleCaught, onOpen, filterUncaught }: {
  location: RouteLocation;
  selectedVersion: string;
  spriteVersion: string | undefined;
  game: string;
  caughtKey: string;
  caught: Record<string, string[]>;
  onToggleCaught: (name: string, gameKey: string) => void;
  onOpen: (name: string) => void;
  filterUncaught: boolean;
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

  const allCaught = filterUncaught && byMethod.every(([, { encounters }]) =>
    encounters.every((enc) => (caught[caughtKey] ?? []).includes(enc.name))
  );

  return (
    <div>
      {allCaught ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          You've caught everything here! 🎉
        </p>
      ) : (
        byMethod.map(([method, { label, encounters }]) => (
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
            filterUncaught={filterUncaught}
          />
        ))
      )}
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
                className="w-36 rounded-md border bg-background py-1 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                  <div key={p.id} className="flex flex-col items-center gap-0.5 rounded-lg border bg-background px-2 py-2 text-center">
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
  "brilliant-diamond-shining-pearl", "sword-shield",
]);

export function RouteBrowser({ caught, onToggleCaught, navigationTarget, game: gameProp, embedded = false, lockedVersion }: {
  caught: Record<string, string[]>;
  onToggleCaught: (name: string, gameKey: string) => void;
  navigationTarget?: { gameValue: string; locationKey: string } | null;
  game: GameOption | null;
  /** When true, suppresses the page heading and outer padding (used inside PlaythroughTracker). */
  embedded?: boolean;
  /** When set, locks the version selector to this version and hides the toggle (used inside PlaythroughTracker). */
  lockedVersion?: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [game, setGame] = useState(gameProp?.value ?? "");

  // Sync when global game prop changes
  useEffect(() => {
    setGame(gameProp?.value ?? "");
    setLocationKey(null);
    setLocationSearch("");
    setSelectedVersion(lockedVersion ?? "");
    setListMode("locations");
    setPokemonInput("");
    setPokemonQuery("");
    setShowSuggestions(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameProp]);
  const [locationKey, setLocationKey] = useState<string | null>(() => searchParams.get("route"));
  const [locationSearch, setLocationSearch] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(() => lockedVersion ?? searchParams.get("routeVersion") ?? "");
  const [selectedPokemon, setSelectedPokemon] = useState<string | null>(null);
  const [missingMode, setMissingMode] = useState<"routes" | "dex" | null>(null);
  const [filterUncaught, setFilterUncaught] = useState(false);
  const [listMode, setListMode] = useState<"locations" | "pokemon">("locations");
  const [pokemonInput, setPokemonInput] = useState("");   // text in the input
  const [pokemonQuery, setPokemonQuery] = useState("");   // confirmed selection driving results
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const pokemonSearchRef = useRef<HTMLDivElement>(null);

  // Keep URL in sync so refresh/share preserves the current view
  useEffect(() => {
    const next: Record<string, string> = {};
    if (game) next.routeGame = game;
    if (locationKey) next.route = locationKey;
    if (selectedVersion) next.routeVersion = selectedVersion;
    setSearchParams(next, { replace: true });
  }, [game, locationKey, selectedVersion, setSearchParams]);

  // Navigate to a specific game + location when triggered from outside (e.g. "Where to find" deep link)
  useEffect(() => {
    if (!navigationTarget) return;
    setGame(navigationTarget.gameValue);
    setLocationKey(navigationTarget.locationKey);
    setLocationSearch("");
    setListMode("locations");
    setSelectedVersion("");
  }, [navigationTarget]);

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

  // Auto-select the first version when data loads (no "All" option).
  // Skip when lockedVersion is set — it's already correct.
  useEffect(() => {
    if (lockedVersion) return;
    if (actualVersions.length > 0 && !selectedVersion) {
      setSelectedVersion(actualVersions[0]);
    }
  }, [actualVersions, selectedVersion, lockedVersion]);

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

  // Unique sorted Pokémon list for the current game — drives autocomplete
  const gamePokemonList = useMemo(() => {
    if (!routeData) return [];
    const seen = new Set<string>();
    const list: { name: string; id: number }[] = [];
    for (const loc of routeData.locations) {
      for (const enc of loc.encounters) {
        if (!seen.has(enc.name)) {
          seen.add(enc.name);
          list.push({ name: enc.name, id: enc.id });
        }
      }
    }
    return list.sort((a, b) => formatPokemonName(a.name).localeCompare(formatPokemonName(b.name)));
  }, [routeData]);

  // Autocomplete suggestions filtered by current input
  const suggestions = useMemo(() => {
    if (!pokemonInput.trim()) return [];
    const q = pokemonInput.trim().toLowerCase();
    return gamePokemonList
      .filter((p) => p.name.includes(q) || formatPokemonName(p.name).toLowerCase().includes(q))
      .slice(0, 10);
  }, [gamePokemonList, pokemonInput]);

  // Reset keyboard highlight whenever suggestions change
  useEffect(() => { setSuggestionIndex(-1); }, [suggestions]);

  // Close suggestions when clicking outside the search container
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pokemonSearchRef.current && !pokemonSearchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Pokémon search: find all locations containing the confirmed Pokémon query
  const pokemonSearchResults = useMemo(() => {
    if (!routeData || !pokemonQuery) return [];
    const q = pokemonQuery.toLowerCase();
    const results: { location: RouteLocation; encounters: RouteEncounter[] }[] = [];
    for (const loc of routeData.locations) {
      const encounters = selectedVersion
        ? loc.encounters.filter((e) => e.version === selectedVersion)
        : aggregateEncounters(loc.encounters);
      const matching = encounters.filter((e) => e.name.toLowerCase() === q);
      if (matching.length === 0) continue;
      // Deduplicate by method+timeOfDay, keeping best chance
      const deduped = new Map<string, RouteEncounter>();
      for (const enc of matching) {
        const key = `${enc.method}:${enc.timeOfDay}`;
        if (!deduped.has(key) || enc.chance > deduped.get(key)!.chance) deduped.set(key, enc);
      }
      results.push({ location: loc, encounters: [...deduped.values()].sort((a, b) => methodOrder(a.method) - methodOrder(b.method)) });
    }
    return results;
  }, [routeData, pokemonQuery, selectedVersion]);

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

  // Ordered unique Pokémon in the current location — used for prev/next in the modal
  const locationPokemonList = useMemo(() => {
    if (!selectedLocation) return [];
    const encounters = selectedVersion
      ? selectedLocation.encounters.filter((e) => e.version === selectedVersion)
      : aggregateEncounters(selectedLocation.encounters);
    // Mirror display order: group by method (method order), within each method sort by chance desc then id asc
    const byMethod = new Map<string, RouteEncounter[]>();
    for (const enc of encounters) {
      if (!byMethod.has(enc.method)) byMethod.set(enc.method, []);
      byMethod.get(enc.method)!.push(enc);
    }
    const seen = new Set<string>();
    const ordered: { name: string; id: number }[] = [];
    const sortedMethods = [...byMethod.entries()].sort(([a], [b]) => methodOrder(a) - methodOrder(b));
    for (const [, encs] of sortedMethods) {
      const sorted = [...encs].sort((a, b) => b.chance - a.chance || a.id - b.id);
      for (const enc of sorted) {
        if (!seen.has(enc.name)) {
          seen.add(enc.name);
          ordered.push({ name: enc.name, id: enc.id });
        }
      }
    }
    return ordered;
  }, [selectedLocation, selectedVersion]);

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
    <div className={cn("flex h-full flex-col gap-4", embedded ? "px-6" : "px-6")}>
      {!embedded && <h1 className="shrink-0 text-xl font-semibold border-b border-border py-3 -mx-6 px-6">Catch Tracker</h1>}
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4">
        {actualVersions.length > 1 && !lockedVersion && (
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
        embedded ? (
          /* Compact embedded layout — dropdown top bar + full-width encounter panel */
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-md border">
            {/* Compact top bar: mode toggle + location select or Pokémon search */}
            <div className="shrink-0 border-b px-2 py-2 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {/* Mode toggle pills */}
                <div className="flex w-full overflow-hidden rounded-md border text-xs font-medium sm:w-auto">
                  <button
                    onClick={() => setListMode("locations")}
                    className={cn(
                      "flex-1 whitespace-nowrap px-2.5 py-1.5 transition-colors sm:flex-none",
                      listMode === "locations" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    Locations
                  </button>
                  <button
                    onClick={() => setListMode("pokemon")}
                    className={cn(
                      "flex-1 whitespace-nowrap border-l px-2.5 py-1.5 transition-colors sm:flex-none",
                      listMode === "pokemon" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    Find Pokémon
                  </button>
                </div>
                {/* Location select dropdown */}
                {listMode === "locations" && (
                  <select
                    value={locationKey ?? ""}
                    onChange={(e) => setLocationKey(e.target.value || null)}
                    className="flex-1 min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select a location…</option>
                    {filteredLocations.map((loc) => (
                      <option key={loc.key} value={loc.key}>{loc.label}</option>
                    ))}
                  </select>
                )}
                {/* Pokémon search input */}
                {listMode === "pokemon" && (
                  <div ref={pokemonSearchRef} className="relative flex-1 min-w-0">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={pokemonInput}
                      onChange={(e) => {
                        setPokemonInput(e.target.value);
                        setPokemonQuery("");
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onKeyDown={(e) => {
                        if (!showSuggestions || suggestions.length === 0) return;
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setSuggestionIndex((i) => (i + 1) % suggestions.length);
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setSuggestionIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          const pick = suggestions[suggestionIndex] ?? suggestions[0];
                          if (pick) {
                            setPokemonInput(formatPokemonName(pick.name));
                            setPokemonQuery(pick.name);
                            setShowSuggestions(false);
                          }
                        } else if (e.key === "Escape") {
                          setShowSuggestions(false);
                        }
                      }}
                      placeholder="e.g. Ralts, Pikachu…"
                      className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      autoComplete="off"
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-background shadow-lg">
                        {suggestions.map((p, i) => (
                          <button
                            key={p.name}
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                              i === suggestionIndex ? "bg-muted" : "hover:bg-muted",
                            )}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setPokemonInput(formatPokemonName(p.name));
                              setPokemonQuery(p.name);
                              setShowSuggestions(false);
                            }}
                            onMouseEnter={() => setSuggestionIndex(i)}
                          >
                            <img
                              src={spriteUrl(p.id, spriteVersion)}
                              alt={p.name}
                              className="h-6 w-6 flex-shrink-0 object-contain"
                            />
                            {formatPokemonName(p.name)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Find Pokémon results */}
              {listMode === "pokemon" && pokemonQuery && (
                pokemonSearchResults.length === 0 ? (
                  <p className="px-1 text-xs text-muted-foreground">Not found in any location for this game.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto divide-y rounded-md border">
                    {pokemonSearchResults.map(({ location, encounters }) => (
                      <button
                        key={location.key}
                        onClick={() => { setLocationKey(location.key); setListMode("locations"); }}
                        className={cn(
                          "w-full px-3 py-1.5 text-left transition-colors hover:bg-muted",
                          locationKey === location.key ? "bg-muted" : "",
                        )}
                      >
                        <span className="block text-xs font-medium">{location.label}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {encounters.map((e) => {
                            const icon = METHOD_ICONS[e.method] ?? "";
                            const level = e.minLevel === e.maxLevel ? `Lv ${e.minLevel}` : `Lv ${e.minLevel}–${e.maxLevel}`;
                            return `${icon} ${level}`.trim();
                          }).join(" · ")}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              )}
              {listMode === "pokemon" && !pokemonQuery && pokemonInput.trim() && (
                <p className="px-1 text-xs text-muted-foreground">Select a Pokémon from the suggestions above.</p>
              )}
            </div>

            {/* Encounter panel — full width */}
            <div className="flex-1 overflow-y-auto">
              {routeDataQuery.isLoading && (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              )}
              {!routeDataQuery.isLoading && !selectedLocation && (
                <div className="flex h-full items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">{routeData ? "Select a location above." : null}</p>
                </div>
              )}
              {selectedLocation && (
                <div className="p-4">
                  <div className="mb-4 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                    <h2 className="text-base font-semibold">{selectedLocation.label}</h2>
                    <div className="flex shrink-0 items-center gap-2">
                      {locationProgress && (
                        <span className="text-xs text-muted-foreground">
                          {locationProgress.count} / {locationProgress.total} caught
                        </span>
                      )}
                      {game && (
                        <button
                          onClick={() => setFilterUncaught((v) => !v)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            filterUncaught
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                          )}
                        >
                          <PokeballIcon caught={filterUncaught} size={11} />
                          Uncaught only
                        </button>
                      )}
                    </div>
                  </div>
                  <LocationDetail
                    location={selectedLocation}
                    selectedVersion={selectedVersion}
                    spriteVersion={spriteVersion}
                    game={game}
                    caughtKey={caughtKey}
                    caught={caught}
                    onToggleCaught={onToggleCaught}
                    onOpen={setSelectedPokemon}
                    filterUncaught={filterUncaught}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Standard two-column layout */
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-md border sm:grid sm:grid-cols-[280px_1fr]">
            {/* Location list — full screen on mobile when no location selected, sidebar on sm+ */}
            <div className={cn(
              "flex flex-1 min-h-0 flex-col sm:border-r",
              selectedLocation ? "hidden sm:flex" : "flex",
            )}>
              {/* Mode toggle */}
              <div className="flex-shrink-0 border-b">
                <div className="flex text-xs font-medium">
                  <button
                    onClick={() => setListMode("locations")}
                    className={cn(
                      "flex-1 py-2 transition-colors",
                      listMode === "locations" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Locations
                  </button>
                  <button
                    onClick={() => setListMode("pokemon")}
                    className={cn(
                      "flex-1 py-2 transition-colors",
                      listMode === "pokemon" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Find Pokémon
                  </button>
                </div>
                <div className="p-2">
                  <div className="relative">
                    {listMode === "locations" && <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />}
                    {listMode === "locations" ? (
                      <input
                        type="text"
                        value={locationSearch}
                        onChange={(e) => setLocationSearch(e.target.value)}
                        placeholder="Search locations…"
                        className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    ) : (
                      <div ref={pokemonSearchRef} className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={pokemonInput}
                          onChange={(e) => {
                            setPokemonInput(e.target.value);
                            setPokemonQuery("");
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          onKeyDown={(e) => {
                            if (!showSuggestions || suggestions.length === 0) return;
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              setSuggestionIndex((i) => (i + 1) % suggestions.length);
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              setSuggestionIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                            } else if (e.key === "Enter") {
                              e.preventDefault();
                              const pick = suggestions[suggestionIndex] ?? suggestions[0];
                              if (pick) {
                                setPokemonInput(formatPokemonName(pick.name));
                                setPokemonQuery(pick.name);
                                setShowSuggestions(false);
                              }
                            } else if (e.key === "Escape") {
                              setShowSuggestions(false);
                            }
                          }}
                          placeholder="e.g. Ralts, Pikachu…"
                          className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                          autoComplete="off"
                        />
                        {showSuggestions && suggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-background shadow-lg">
                            {suggestions.map((p, i) => (
                              <button
                                key={p.name}
                                className={cn(
                                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                                  i === suggestionIndex ? "bg-muted" : "hover:bg-muted",
                                )}
                                onMouseDown={(e) => {
                                  e.preventDefault(); // keep input focused
                                  setPokemonInput(formatPokemonName(p.name));
                                  setPokemonQuery(p.name);
                                  setShowSuggestions(false);
                                }}
                                onMouseEnter={() => setSuggestionIndex(i)}
                              >
                                <img
                                  src={spriteUrl(p.id, spriteVersion)}
                                  alt={p.name}
                                  className="h-6 w-6 flex-shrink-0 object-contain"
                                />
                                {formatPokemonName(p.name)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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

                {/* Locations mode */}
                {listMode === "locations" && (
                  <>
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
                  </>
                )}

                {/* Find Pokémon mode */}
                {listMode === "pokemon" && (
                  <>
                    {!pokemonQuery && (
                      <p className="p-4 text-center text-sm text-muted-foreground">
                        {pokemonInput.trim() ? "Select a Pokémon from the list." : "Type a Pokémon name to find where it appears."}
                      </p>
                    )}
                    {pokemonQuery && pokemonSearchResults.length === 0 && (
                      <p className="p-4 text-center text-sm text-muted-foreground">
                        Not found in any location for this game.
                      </p>
                    )}
                    {pokemonSearchResults.map(({ location, encounters }) => (
                      <button
                        key={location.key}
                        onClick={() => { setLocationKey(location.key); setListMode("locations"); }}
                        className={cn(
                          "w-full px-3 py-2 text-left transition-colors hover:bg-muted",
                          locationKey === location.key ? "bg-muted" : "",
                        )}
                      >
                        <span className="block text-sm font-medium text-foreground">{location.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {encounters.map((e) => {
                            const icon = METHOD_ICONS[e.method] ?? "";
                            const level = e.minLevel === e.maxLevel ? `Lv ${e.minLevel}` : `Lv ${e.minLevel}–${e.maxLevel}`;
                            return `${icon} ${level}`.trim();
                          }).join(" · ")}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Encounter detail — full screen on mobile when location selected, panel on sm+ */}
            <div className={cn(
              "overflow-y-auto bg-background",
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
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">{selectedLocation.label}</h2>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {locationProgress && (
                        <span className="text-xs text-muted-foreground">
                          {locationProgress.count} / {locationProgress.total} caught
                        </span>
                      )}
                      {game && (
                        <button
                          onClick={() => setFilterUncaught((v) => !v)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            filterUncaught
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                          )}
                        >
                          <PokeballIcon caught={filterUncaught} size={11} />
                          Uncaught only
                        </button>
                      )}
                    </div>
                  </div>
                  <LocationDetail
                    location={selectedLocation}
                    selectedVersion={selectedVersion}
                    spriteVersion={spriteVersion}
                    game={game}
                    caughtKey={caughtKey}
                    caught={caught}
                    onToggleCaught={onToggleCaught}
                    onOpen={setSelectedPokemon}
                    filterUncaught={filterUncaught}
                  />
                </>
              )}
              </div>
            </div>
          </div>
        )
      )}

      {/* Catch progress footer */}
      {game && GAMES_WITH_ROUTES.has(game) && gameProgress && (
        <div className="flex items-center gap-x-2 gap-y-0 flex-wrap text-sm text-muted-foreground">
          <PokeballIcon caught={gameProgress.count > 0} size={13} />
          <button
            onClick={() => setMissingMode("routes")}
            className="hover:text-foreground hover:underline transition-colors"
          >
            {gameProgress.count} / {gameProgress.routeTotal} routes
          </button>
          <span className="text-muted-foreground/40">·</span>
          <button
            onClick={() => setMissingMode("dex")}
            className="hover:text-foreground hover:underline transition-colors"
          >
            {gameProgress.count} / {gameProgress.dexTotal} dex
          </button>
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

      {selectedPokemon && (() => {
        const idx = locationPokemonList.findIndex((p) => p.name === selectedPokemon);
        const prevPokemon = idx > 0 ? locationPokemonList[idx - 1] : null;
        const nextPokemon = idx !== -1 && idx < locationPokemonList.length - 1 ? locationPokemonList[idx + 1] : null;
        return (
          <PokemonModal
            pokemonName={selectedPokemon}
            game={selectedGame}
            onClose={() => setSelectedPokemon(null)}
            onNavigate={setSelectedPokemon}
            prevPokemon={prevPokemon}
            nextPokemon={nextPokemon}
          />
        );
      })()}
    </div>
  );
}
