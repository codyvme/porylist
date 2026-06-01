import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { SparkleBurst } from "@/components/SparkleBurst";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Sparkles, Volume2, X } from "lucide-react";

export function CryButton({ id, generation, className, title: titleProp }: { id: number; generation?: number; className?: string; title?: string }) {
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  function handleClick() {
    if (loading) return;
    const audio = new Audio(cryUrl(id, generation));
    audioRef.current = audio;
    audio.volume = 0.5;
    if (audio.readyState >= 4) {
      audio.play().catch(() => {});
    } else {
      setLoading(true);
      audio.addEventListener("canplay", () => { setLoading(false); audio.play().catch(() => {}); }, { once: true });
      audio.addEventListener("error", () => setLoading(false), { once: true });
    }
  }
  return (
    <button onClick={handleClick} disabled={loading} aria-label="Play cry" title={titleProp ?? "Play cry"} className={className}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}


import { Badge } from "@/components/ui/badge";
import { TYPE_COLORS, typeStyle } from "@/lib/types";
import { computeTypeEffectiveness } from "@/lib/type-chart";
import { GAME_VERSION_GROUPS, GAME_VERSIONS, GAMES, SPRITES_ROOT, spriteUrl, cryUrl, type GameOption } from "@/lib/games";
import {
  typesForGeneration,
  useSinglePokemon,
  usePokemonSpecies,
  usePokemonFormData,
  useMoveDetails,
  useAbilityDetails,
  useMachineDetails,
  usePokemonEncounters,
  useEvolutionChain,
  extractIdFromUrl,
  VERSION_GROUP_TO_GEN,
  type MoveDetail,
  type AbilityDetail,
  type LocationAreaEncounter,
  type ChainLink,
  type EvolutionDetail,
} from "@/lib/pokeapi";
import { cn, formatPokemonName } from "@/lib/utils";

// ── Encounter helpers ────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  "walk": "Walking",
  "old-rod": "Old Rod",
  "good-rod": "Good Rod",
  "super-rod": "Super Rod",
  "surf": "Surfing",
  "rock-smash": "Rock Smash",
  "headbutt": "Headbutt",
  "dark-grass": "Dark Grass",
  "tall-grass": "Tall Grass",
  "cave": "Cave",
  "gift": "Gift",
  "gift-egg": "Gift (Egg)",
  "only-one": "Static encounter",
  "pokemon-radar": "PokéRadar",
  "pokeradar": "PokéRadar",
  "roaming-grass": "Roaming",
  "roaming-water": "Roaming",
  "overworld-special": "Overworld",
  "special": "Special",
  "island-scan": "Island Scan",
  "sos-encounter": "SOS Battle",
  "grass-spots": "Tall Grass",
  "dark-grass-spots": "Dark Grass",
  "cave-spots": "Cave",
  "bridge-spots": "Bridge Shadow",
  "surf-spots": "Surfing",
  "super-rod-spots": "Super Rod",
  "honey-tree": "Honey Tree",
  "headbutt-normal": "Headbutt",
  "headbutt-special": "Headbutt",
};

const CONDITION_LABELS: Record<string, string> = {
  "time-morning": "Morning",
  "time-day": "Day",
  "time-night": "Night",
  "swarm": "Swarm",
  "radar-on": "PokéRadar",
  "slot2-ruby": "Ruby in GBA slot",
  "slot2-sapphire": "Sapphire in GBA slot",
  "slot2-emerald": "Emerald in GBA slot",
  "slot2-firered": "FireRed in GBA slot",
  "slot2-leafgreen": "LeafGreen in GBA slot",
  "sos-magnet-pull": "Magnet Pull SOS",
  "sos-static": "Static SOS",
};

const SKIP_CONDITIONS = new Set([
  "no-swarm",
  "slot2-none",
  "using-old-rod",
  "using-good-rod",
  "using-super-rod",
  // Story-progress gates aren't useful to display verbatim
  "story-progress-beat-red",
  "story-progress-beat-champion",
  "story-progress-post-game",
]);

function formatConditionLabel(condition: string): string {
  if (CONDITION_LABELS[condition]) return CONDITION_LABELS[condition];
  // story-progress-* → drop silently (handled by SKIP_CONDITIONS, but fallback just in case)
  if (condition.startsWith("story-progress-")) return "";
  // Generic: title-case the hyphenated key
  return condition.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatLocationName(apiName: string): string {
  let name = apiName
    .replace(/-area$/, "")
    .replace(/-/g, " ");
  // B1F, 1F floor notation
  name = name.replace(/\bb(\d+)f\b/gi, (_, n) => `B${n}F`);
  name = name.replace(/\b(\d+)f\b/gi, (_, n) => `${n}F`);
  // Capitalize words
  name = name.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  // Fix abbreviations
  name = name.replace(/\bMt\b/g, "Mt.").replace(/\bSs\b/g, "SS");
  return name;
}

type MethodData = {
  method: string;
  minLevel: number;
  maxLevel: number;
  chance: number;
  conditions: string[];
};

interface ProcessedLocation {
  key: string;   // raw PokeAPI location_area name (e.g. "viridian-forest-area")
  name: string;  // human-readable label
  /** versions: [] means the entry applies to all game versions */
  methods: Array<MethodData & { versions: string[] }>;
}

function formatVersionName(name: string): string {
  return name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const VERSION_COLORS: Record<string, string> = {
  "red":               "DA3914",
  "blue":              "2E50D8",
  "yellow":            "FFD733",
  "gold":              "DAA520",
  "silver":            "C0C0C0",
  "crystal":           "4FD9FF",
  "ruby":              "CD2236",
  "sapphire":          "3D51A7",
  "emerald":           "009652",
  "firered":           "F15C01",
  "leafgreen":         "9FDC00",
  "diamond":           "90BEED",
  "pearl":             "DD7CB1",
  "platinum":          "A0A08D",
  "heartgold":         "E8B502",
  "soulsilver":        "AAB9CF",
  "black":             "444444",
  "white":             "E1E1E1",
  "black-2":           "303E51",
  "white-2":           "EBC5C3",
  "x":                 "025DA6",
  "y":                 "EA1A3E",
  "omega-ruby":        "AB2813",
  "alpha-sapphire":    "26649C",
  "sun":               "F1912B",
  "moon":              "5599CA",
  "ultra-sun":         "E95B2B",
  "ultra-moon":        "226DB5",
  "lets-go-pikachu":   "F5DA26",
  "lets-go-eevee":     "D4924B",
  "sword":             "00A1E9",
  "shield":            "BF004F",
  "brilliant-diamond": "44BAE5",
  "shining-pearl":     "DA7D99",
  "legends-arceus":    "36597B",
  "scarlet":           "F34134",
  "violet":            "8334B7",
};

function versionTextColor(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  // WCAG relative luminance — threshold at 0.4 biases toward white text for
  // medium-luminance colors (Platinum, Pearl, Shining Pearl, etc.)
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.4 ? "#000000" : "#ffffff";
}

function VersionBadge({ version }: { version: string }) {
  const hex = VERSION_COLORS[version];
  if (!hex) return <span className="text-xs text-muted-foreground">{formatVersionName(version)}</span>;
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `#${hex}`, color: versionTextColor(hex) }}
    >
      {formatVersionName(version)}
    </span>
  );
}

function buildMethodMap(details: LocationAreaEncounter["version_details"][number]["encounter_details"]): Map<string, MethodData> {
  const map = new Map<string, MethodData>();
  for (const detail of details) {
    const conditions = detail.condition_values
      .map((cv) => cv.name)
      .filter((c) => !SKIP_CONDITIONS.has(c));
    const key = `${detail.method.name}|${conditions.sort().join(",")}`;
    const existing = map.get(key);
    if (existing) {
      existing.minLevel = Math.min(existing.minLevel, detail.min_level);
      existing.maxLevel = Math.max(existing.maxLevel, detail.max_level);
      existing.chance += detail.chance;
    } else {
      map.set(key, {
        method: detail.method.name,
        minLevel: detail.min_level,
        maxLevel: detail.max_level,
        chance: detail.chance,
        conditions,
      });
    }
  }
  // Merge entries that differ only by time-of-day condition but have identical stats
  const TIME_CONDITIONS = new Set(["time-morning", "time-day", "time-night"]);
  const groups = new Map<string, { keys: string[]; entries: MethodData[] }>();
  for (const [key, data] of map) {
    const nonTime = data.conditions.filter((c) => !TIME_CONDITIONS.has(c));
    const groupKey = `${data.method}|${nonTime.sort().join(",")}`;
    const g = groups.get(groupKey);
    if (g) { g.keys.push(key); g.entries.push(data); }
    else groups.set(groupKey, { keys: [key], entries: [data] });
  }
  for (const { keys, entries } of groups.values()) {
    if (entries.length < 2) continue;
    const first = entries[0];
    const allSame = entries.every(
      (e) => e.minLevel === first.minLevel && e.maxLevel === first.maxLevel && e.chance === first.chance,
    );
    if (allSame) {
      for (const k of keys) map.delete(k);
      const nonTime = first.conditions.filter((c) => !TIME_CONDITIONS.has(c));
      const mergedKey = `${first.method}|${nonTime.join(",")}`;
      map.set(mergedKey, { ...first, conditions: nonTime });
    }
  }

  return map;
}

function processEncounters(
  encounters: LocationAreaEncounter[],
  gameVersions: string[],
): ProcessedLocation[] {
  const locations: ProcessedLocation[] = [];

  for (const enc of encounters) {
    // Build a method map for every matching version
    const perVersion: Array<{ version: string; methods: Map<string, MethodData> }> = [];
    for (const vd of enc.version_details) {
      if (!gameVersions.includes(vd.version.name)) continue;
      const methods = buildMethodMap(vd.encounter_details);
      if (methods.size > 0) perVersion.push({ version: vd.version.name, methods });
    }
    if (perVersion.length === 0) continue;

    // Collect all method keys across all versions
    const allKeys = new Set<string>();
    for (const { methods } of perVersion) for (const k of methods.keys()) allKeys.add(k);

    const result: ProcessedLocation["methods"] = [];

    for (const key of allKeys) {
      const entries = perVersion
        .filter(({ methods }) => methods.has(key))
        .map(({ version, methods }) => ({ version, data: methods.get(key)! }));

      // Group entries that share identical data (level range + chance)
      const dataGroups = new Map<string, { data: MethodData; versions: string[] }>();
      for (const { version, data } of entries) {
        const sig = `${data.minLevel}|${data.maxLevel}|${data.chance}`;
        const g = dataGroups.get(sig);
        if (g) g.versions.push(version);
        else dataGroups.set(sig, { data, versions: [version] });
      }

      for (const { data, versions } of dataGroups.values()) {
        result.push({
          ...data,
          // Empty = shared across every matching version for this location
          versions: versions.length === perVersion.length ? [] : versions,
        });
      }
    }

    if (result.length === 0) continue;
    locations.push({ key: enc.location_area.name, name: formatLocationName(enc.location_area.name), methods: result });
  }

  return locations.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

interface PokemonModalProps {
  pokemonName: string;
  game: GameOption | undefined;
  onClose: () => void;
  onNavigate: (name: string) => void;
  prevPokemon: { name: string; id: number } | null;
  nextPokemon: { name: string; id: number } | null;
  onOpenInCatchTracker?: (gameValue: string, locationKey: string) => void;
}

const STAT_LABELS: Record<string, string> = {
  hp: "HP",
  attack: "Atk",
  defense: "Def",
  "special-attack": "Sp. Atk",
  "special-defense": "Sp. Def",
  speed: "Spd",
};

const STAT_LABELS_GEN1: Record<string, string> = {
  hp: "HP",
  attack: "Atk",
  defense: "Def",
  "special-attack": "Special",
  speed: "Spd",
};

function statBarColor(value: number): string {
  if (value < 50) return "bg-red-500";
  if (value < 80) return "bg-orange-400";
  if (value < 110) return "bg-yellow-400";
  return "bg-green-500";
}

function moveName(apiName: string, detail: MoveDetail | undefined): string {
  if (detail) {
    const eng = detail.names.find((n) => n.language.name === "en")?.name;
    if (eng) return eng;
  }
  return apiName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function moveShortEffect(detail: MoveDetail): string {
  const entry = detail.effect_entries.find((e) => e.language.name === "en");
  if (!entry) return "";
  let text = entry.short_effect;
  if (detail.effect_chance != null) {
    text = text.replace(/\$effect_chance%/g, `${detail.effect_chance}%`);
  }
  return text;
}

function moveDescription(detail: MoveDetail, versionGroups: string[]): string {
  const english = detail.flavor_text_entries.filter((e) => e.language.name === "en");
  for (const vg of versionGroups) {
    const entry = english.find((e) => e.version_group.name === vg);
    if (entry) return entry.flavor_text.replace(/[\n\f]/g, " ");
  }
  return moveShortEffect(detail);
}

function abilityDescription(detail: AbilityDetail, versionGroups: string[]): string {
  const english = detail.flavor_text_entries.filter((e) => e.language.name === "en");
  for (const vg of versionGroups) {
    const entry = english.find((e) => e.version_group.name === vg);
    if (entry) return entry.flavor_text.replace(/[\n\f]/g, " ");
  }
  return detail.effect_entries.find((e) => e.language.name === "en")?.short_effect ?? "";
}

const CATEGORY_COLORS: Record<string, string> = {
  physical: "#C92112",
  special:  "#4F5870",
  status:   "#8C888C",
};

function DamageCategoryBadge({ category }: { category: string }) {
  const bg = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.status;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium capitalize text-white"
      style={{ backgroundColor: bg }}
    >
      {category}
    </span>
  );
}

type MoveTab = "level-up" | "egg" | "machine" | "tutor";

interface FilteredMove {
  name: string;
  level: number;
}

interface MoveTableProps {
  moves: FilteredMove[];
  moveDetailsMap: Record<string, MoveDetail>;
  showLevel: boolean;
  machineNumberMap?: Record<string, string>;
  eggParentMap?: Record<string, Array<{ name: string; pokeApiName: string; id: number }>> | null;
  eggDataLoaded?: boolean;
  hasGeneration?: boolean;
  expandedMove: string | null;
  onToggleExpand: (name: string) => void;
  onNavigate: (name: string) => void;
  versionGroups: string[];
}

function parseMachineNum(label: string): number {
  const m = label.match(/\d+$/);
  return m ? parseInt(m[0], 10) : 9999;
}

function MoveTable({ moves, moveDetailsMap, showLevel, machineNumberMap, eggParentMap, eggDataLoaded, hasGeneration, expandedMove, onToggleExpand, onNavigate, versionGroups }: MoveTableProps) {
  const showMachineNum = machineNumberMap != null;
  const showExtraCol = showLevel || showMachineNum;
  // On mobile: chevron + (extra?) + name + type + category = 4 or 5 cols
  const mobileColCount = showExtraCol ? 5 : 4;

  const displayMoves = useMemo(() => {
    if (!showMachineNum || Object.keys(machineNumberMap).length === 0) return moves;
    return [...moves].sort((a, b) => {
      const na = machineNumberMap[a.name];
      const nb = machineNumberMap[b.name];
      if (!na && !nb) return 0;
      if (!na) return 1;
      if (!nb) return -1;
      // HMs after TMs, then by number
      const aIsHM = na.startsWith("HM");
      const bIsHM = nb.startsWith("HM");
      if (aIsHM !== bIsHM) return aIsHM ? 1 : -1;
      return parseMachineNum(na) - parseMachineNum(nb);
    });
  }, [moves, showMachineNum, machineNumberMap]);

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-medium text-muted-foreground">
            <th className="w-6 pb-2" />
            {showLevel && <th className="pb-2 pr-4 text-right">Lv.</th>}
            {showMachineNum && <th className="pb-2 pr-4">No.</th>}
            <th className="pb-2 pr-4">Name</th>
            <th className="pb-2 pr-4">Type</th>
            <th className="pb-2 pr-4">Cat.</th>
            <th className="hidden pb-2 pr-4 text-right sm:table-cell">Power</th>
            <th className="hidden pb-2 pr-4 text-right sm:table-cell">Acc.</th>
            <th className="hidden pb-2 text-right sm:table-cell">PP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {displayMoves.map((move) => {
            const detail = moveDetailsMap[move.name];
            const isExpanded = expandedMove === move.name;
            const effect = detail ? moveDescription(detail, versionGroups) : "";
            const machineNum = machineNumberMap?.[move.name];
            return (
              <Fragment key={move.name}>
                <tr
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => onToggleExpand(move.name)}
                >
                  <td className="py-1.5 pl-1 text-muted-foreground">
                    {isExpanded
                      ? <ChevronDown className="h-3.5 w-3.5" />
                      : <ChevronRight className="h-3.5 w-3.5" />}
                  </td>
                  {showLevel && (
                    <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-muted-foreground">
                      {move.level === 0 ? "—" : move.level}
                    </td>
                  )}
                  {showMachineNum && (
                    <td className="py-1.5 pr-4 font-mono tabular-nums text-muted-foreground">
                      {machineNum ?? (
                        <div className="h-4 w-10 skeleton-shimmer rounded" />
                      )}
                    </td>
                  )}
                  <td className="py-1.5 pr-4 font-medium">
                    {moveName(move.name, detail)}
                  </td>
                  <td className="py-1.5 pr-4">
                    {detail ? (
                      <Badge
                        variant="default"
                        className="capitalize !px-2"
                        style={typeStyle(detail.type.name)}
                      >
                        {detail.type.name}
                      </Badge>
                    ) : (
                      <div className="h-5 w-16 skeleton-shimmer rounded" />
                    )}
                  </td>
                  <td className="py-1.5 pr-4">
                    {detail ? (
                      <DamageCategoryBadge category={detail.damage_class.name} />
                    ) : (
                      <div className="h-5 w-14 skeleton-shimmer rounded" />
                    )}
                  </td>
                  <td className="hidden py-1.5 pr-4 text-right font-mono tabular-nums sm:table-cell">
                    {detail ? (
                      detail.power ?? "—"
                    ) : (
                      <div className="ml-auto h-4 w-6 skeleton-shimmer rounded" />
                    )}
                  </td>
                  <td className="hidden py-1.5 pr-4 text-right font-mono tabular-nums sm:table-cell">
                    {detail ? (
                      detail.accuracy != null ? `${detail.accuracy}%` : "—"
                    ) : (
                      <div className="ml-auto h-4 w-8 skeleton-shimmer rounded" />
                    )}
                  </td>
                  <td className="hidden py-1.5 text-right font-mono tabular-nums sm:table-cell">
                    {detail ? (
                      detail.pp ?? "—"
                    ) : (
                      <div className="ml-auto h-4 w-6 skeleton-shimmer rounded" />
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${move.name}-desc`} className="bg-muted/20">
                    <td /> {/* chevron column */}
                    {showExtraCol && <td />}
                    <td colSpan={mobileColCount - (showExtraCol ? 2 : 1)} className="py-2 pr-4 text-xs text-muted-foreground">
                      <div className="space-y-2">
                        {effect ? (
                          <p>{effect}</p>
                        ) : (
                          <div className="h-3 w-48 skeleton-shimmer rounded" />
                        )}
                        {eggParentMap !== undefined && (
                          <div>
                            {!hasGeneration ? (
                              <p className="italic">Select a game to see breeding parents.</p>
                            ) : !eggDataLoaded ? (
                              <div className="h-3 w-32 skeleton-shimmer rounded" />
                            ) : eggParentMap === null ? null : (
                              (() => {
                                const parents = eggParentMap[move.name] ?? [];
                                return parents.length === 0 ? (
                                  <p className="italic">No compatible parents found.</p>
                                ) : (
                                  <div className="pt-1">
                                    <span className="font-semibold text-foreground">Parents:</span>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                      {parents.map((p) => (
                                        <button
                                          key={p.pokeApiName}
                                          onClick={(e) => { e.stopPropagation(); onNavigate(p.pokeApiName); }}
                                          className="flex flex-col items-center gap-0.5 rounded-lg p-1 hover:bg-muted/50"
                                          title={p.name}
                                        >
                                          <img
                                            src={`${SPRITES_ROOT}/${p.id}.png`}
                                            alt={p.name}
                                            className="h-10 w-10 object-contain"
                                          />
                                          <span className="max-w-[56px] truncate text-[10px] leading-tight text-muted-foreground">
                                            {p.name}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GameSpriteThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={src}
        alt={alt}
        className="h-16 w-16 object-contain"
        onError={() => setFailed(true)}
      />
      <span className="text-xs text-muted-foreground">In-game</span>
    </div>
  );
}

// ── Evolution helpers ────────────────────────────────────────────────────────

const GEN_MAX_DEX: Record<number, number> = {
  1: 151, 2: 251, 3: 386, 4: 493, 5: 649,
  6: 721, 7: 809, 8: 905, 9: 1025,
};

function formatItemName(name: string): string {
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEvolutionMethod(detail: EvolutionDetail): string {
  const trigger = detail.trigger.name;
  const parts: string[] = [];

  switch (trigger) {
    case "level-up":
      if (detail.min_level) parts.push(`Level ${detail.min_level}`);
      else if (detail.min_happiness) parts.push("High Friendship");
      else if (detail.min_beauty) parts.push("High Beauty");
      else if (detail.min_affection) parts.push("High Affection");
      else if (detail.known_move) parts.push(`Know ${formatItemName(detail.known_move.name)}`);
      else if (detail.known_move_type) parts.push(`Know a ${formatItemName(detail.known_move_type.name)}-type move`);
      else if (detail.location) parts.push(`At ${formatLocationName(detail.location.name)}`);
      else parts.push("Level up");
      if (detail.time_of_day === "day") parts.push("(Day)");
      else if (detail.time_of_day === "night") parts.push("(Night)");
      if (detail.needs_overworld_rain) parts.push("(Rain)");
      if (detail.gender === 1) parts.push("(♀)");
      if (detail.gender === 2) parts.push("(♂)");
      if (detail.relative_physical_stats === 1) parts.push("(Atk > Def)");
      else if (detail.relative_physical_stats === -1) parts.push("(Atk < Def)");
      else if (detail.relative_physical_stats === 0) parts.push("(Atk = Def)");
      if (detail.turn_upside_down) parts.push("(Upside down)");
      break;
    case "use-item":
      parts.push(`Use ${formatItemName(detail.item?.name ?? "item")}`);
      break;
    case "trade":
      if (detail.held_item) parts.push(`Trade holding ${formatItemName(detail.held_item.name)}`);
      else if (detail.trade_species) parts.push(`Trade for ${formatItemName(detail.trade_species.name)}`);
      else parts.push("Trade");
      break;
    case "shed": parts.push("Level 20 + empty party slot"); break;
    case "three-critical-hits": parts.push("3 critical hits in one battle"); break;
    case "take-damage": parts.push("Travel after taking damage"); break;
    case "agile-style-move": parts.push("Use agile style 20 times"); break;
    case "strong-style-move": parts.push("Use strong style 20 times"); break;
    case "recoil-damage": parts.push("Take 294+ recoil damage"); break;
    case "tower-of-darkness": parts.push("Tower of Darkness"); break;
    case "tower-of-waters": parts.push("Tower of Waters"); break;
    default: parts.push(trigger.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
  }

  return parts.join(" ");
}

interface ChainNode {
  speciesName: string;
  speciesId: number;
  /** Evolution methods to reach this node (empty for the base stage). */
  methods: string[];
}

function buildChainStages(chain: ChainLink, maxDexId: number | null): ChainNode[][] {
  const stages: ChainNode[][] = [];
  function traverse(link: ChainLink, depth: number) {
    const id = extractIdFromUrl(link.species.url);
    if (maxDexId !== null && id > maxDexId) return;
    if (!stages[depth]) stages[depth] = [];
    stages[depth].push({
      speciesName: link.species.name,
      speciesId: id,
      methods: depth === 0 ? [] : [...new Set(link.evolution_details.map(formatEvolutionMethod))],
    });
    for (const next of link.evolves_to) traverse(next, depth + 1);
  }
  traverse(chain, 0);
  return stages;
}

export function PokemonModal({ pokemonName, game, onClose, onNavigate, prevPokemon, nextPokemon, onOpenInCatchTracker }: PokemonModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<MoveTab>("level-up");
  const [showShiny, setShowShiny] = useState(false);
  const [sparkleKey, setSparkleKey] = useState(0);
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const [expandedMove, setExpandedMove] = useState<string | null>(null);
  const [locationsGameValue, setLocationsGameValue] = useState<string | null>(game?.value ?? null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && prevPokemon) onNavigate(prevPokemon.name);
      if (e.key === "ArrowRight" && nextPokemon) onNavigate(nextPokemon.name);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onNavigate, prevPokemon, nextPokemon]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    setExpandedMove(null);
  }, [activeTab]);

  useEffect(() => {
    setSpriteLoaded(false);
  }, [pokemonName]);

  const { data: pokemon, isLoading } = useSinglePokemon(pokemonName);
  const { data: formDataMap } = usePokemonFormData([pokemonName]);
  const { data: species } = usePokemonSpecies(pokemon?.species.name ?? null);
  const { data: evolutionChain } = useEvolutionChain(species?.evolution_chain.url ?? null);
  const { data: encounterData, isLoading: encountersLoading } = usePokemonEncounters(pokemon?.id ?? null);

  // Fetch the base form's data to inherit egg moves (PokeAPI only lists egg moves on the base form)
  const baseSpeciesName = evolutionChain?.chain.species.name ?? null;
  const isBaseForm = baseSpeciesName === pokemon?.species.name;
  const { data: basePokemon } = useSinglePokemon(!isBaseForm ? baseSpeciesName : null);

  const generation = game?.generation;

  const versionGroups = useMemo(() => {
    if (!game) return ["scarlet-violet"];
    return GAME_VERSION_GROUPS[game.value] ?? ["scarlet-violet"];
  }, [game]);

  // All games where this Pokémon has wild encounters, in game release order
  const allGamesLocations = useMemo(() => {
    if (!encounterData) return [];
    return GAMES
      .map((g) => {
        const versions = GAME_VERSIONS[g.value];
        if (!versions) return null;
        const locations = processEncounters(encounterData, versions);
        if (locations.length === 0) return null;
        return { game: g, locations };
      })
      .filter((x): x is { game: GameOption; locations: ProcessedLocation[] } => x !== null);
  }, [encounterData]);

  // Keep locationsGameValue pointing at a valid game; prefer the active game, fall back to first available
  const resolvedLocationsGameValue = useMemo(() => {
    if (allGamesLocations.length === 0) return null;
    const available = new Set(allGamesLocations.map((x) => x.game.value));
    if (locationsGameValue && available.has(locationsGameValue)) return locationsGameValue;
    if (game && available.has(game.value)) return game.value;
    return allGamesLocations[0].game.value;
  }, [allGamesLocations, locationsGameValue, game]);

  const types = useMemo(
    () => (pokemon ? typesForGeneration(pokemon, generation) : []),
    [pokemon, generation],
  );

  const typeEffectiveness = useMemo(() => {
    if (types.length === 0) return null;
    const chart = computeTypeEffectiveness(types, generation ?? 9);
    const immune: string[] = [];
    const quarter: string[] = [];
    const half: string[] = [];
    const double: string[] = [];
    const quadruple: string[] = [];
    for (const [atk, mult] of Object.entries(chart)) {
      if (mult === 0) immune.push(atk);
      else if (mult === 0.25) quarter.push(atk);
      else if (mult === 0.5) half.push(atk);
      else if (mult === 2) double.push(atk);
      else if (mult === 4) quadruple.push(atk);
    }
    return { immune, quarter, half, double, quadruple };
  }, [types]);

  const abilities = useMemo(() => {
    if (!pokemon) return [];
    if (generation != null && generation <= 2) return [];
    return pokemon.abilities
      .filter((a) => {
        if (a.is_hidden) return generation == null || generation >= 5;
        return true;
      })
      .sort((a, b) => a.slot - b.slot);
  }, [pokemon, generation]);

  const abilityNames = useMemo(() => abilities.map((a) => a.ability.name), [abilities]);
  const abilityDetailsQueries = useAbilityDetails(abilityNames);
  const abilityDetailsMap = useMemo(() => {
    const map: Record<string, AbilityDetail> = {};
    abilityDetailsQueries.forEach((q, i) => {
      if (q.data && abilityNames[i]) map[abilityNames[i]] = q.data;
    });
    return map;
  }, [abilityDetailsQueries, abilityNames]);

  const statLabels = generation === 1 ? STAT_LABELS_GEN1 : STAT_LABELS;

  const stats = useMemo(() => {
    if (!pokemon) return [];
    return pokemon.stats
      .filter((s) => statLabels[s.stat.name] != null)
      .map((s) => ({ name: s.stat.name, label: statLabels[s.stat.name], value: s.base_stat }));
  }, [pokemon, statLabels]);

  const bst = useMemo(() => stats.reduce((sum, s) => sum + s.value, 0), [stats]);

  const flavorText = useMemo(() => {
    if (!species) return null;
    const english = species.flavor_text_entries.filter((e) => e.language.name === "en");
    const preferredVersions = game
      ? (GAME_VERSIONS[game.value] ?? [])
      : ["scarlet", "violet"];
    for (const version of preferredVersions) {
      const entry = english.find((e) => e.version.name === version);
      if (entry) return { text: entry.flavor_text.replace(/[\n\f]/g, " "), version: entry.version };
    }
    if (!game && english.length > 0) {
      const entry = english[english.length - 1];
      return { text: entry.flavor_text.replace(/[\n\f]/g, " "), version: entry.version };
    }
    return null;
  }, [species, game]);

  const chainStages = useMemo(() => {
    if (!evolutionChain || !pokemon) return null;
    const maxDex = generation != null ? GEN_MAX_DEX[generation] : null;
    const stages = buildChainStages(evolutionChain.chain, maxDex ?? null);
    // Only return stages if there's actually more than one stage (i.e. the Pokémon evolves at all)
    return stages.length > 1 ? stages : null;
  }, [evolutionChain, pokemon, generation]);

  const activeVGs = useMemo(() => {
    if (game || !pokemon) return versionGroups;
    const hasInSV = pokemon.moves.some((m) =>
      m.version_group_details.some((vgd) => vgd.version_group.name === "scarlet-violet"),
    );
    if (hasInSV) return versionGroups;
    let bestGen = -1;
    const bestVGs: string[] = [];
    for (const m of pokemon.moves) {
      for (const vgd of m.version_group_details) {
        const gen = VERSION_GROUP_TO_GEN[vgd.version_group.name] ?? 0;
        if (gen > bestGen) {
          bestGen = gen;
          bestVGs.length = 0;
          bestVGs.push(vgd.version_group.name);
        } else if (gen === bestGen && !bestVGs.includes(vgd.version_group.name)) {
          bestVGs.push(vgd.version_group.name);
        }
      }
    }
    return bestVGs;
  }, [game, pokemon, versionGroups]);

  const filteredMoves = useMemo(() => {
    if (!pokemon) return { levelUp: [], egg: [], machine: [], tutor: [] };

    const levelUpMap = new Map<string, FilteredMove>();
    const eggSet = new Set<string>();
    const machineSet = new Set<string>();
    const tutorSet = new Set<string>();

    for (const m of pokemon.moves) {
      for (const vgd of m.version_group_details) {
        if (!activeVGs.includes(vgd.version_group.name)) continue;
        switch (vgd.move_learn_method.name) {
          case "level-up":
            levelUpMap.set(m.move.name, { name: m.move.name, level: vgd.level_learned_at });
            break;
          case "egg": eggSet.add(m.move.name); break;
          case "machine": machineSet.add(m.move.name); break;
          case "tutor": tutorSet.add(m.move.name); break;
        }
        break;
      }
    }

    // Inherit egg moves from the base form — PokeAPI only lists them on the first evolution
    if (basePokemon) {
      for (const m of basePokemon.moves) {
        for (const vgd of m.version_group_details) {
          if (!activeVGs.includes(vgd.version_group.name)) continue;
          if (vgd.move_learn_method.name === "egg") eggSet.add(m.move.name);
          break;
        }
      }
    }

    const levelUp = [...levelUpMap.values()];
    const egg = [...eggSet].map((name) => ({ name, level: 0 }));
    const machine = [...machineSet].map((name) => ({ name, level: 0 }));
    const tutor = [...tutorSet].map((name) => ({ name, level: 0 }));

    levelUp.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    egg.sort((a, b) => a.name.localeCompare(b.name));
    machine.sort((a, b) => a.name.localeCompare(b.name));
    tutor.sort((a, b) => a.name.localeCompare(b.name));

    return { levelUp, egg, machine, tutor };
  }, [pokemon, activeVGs, basePokemon]);

  const activeMoves = useMemo(() => {
    switch (activeTab) {
      case "level-up": return filteredMoves.levelUp;
      case "egg":      return filteredMoves.egg;
      case "machine":  return filteredMoves.machine;
      case "tutor":    return filteredMoves.tutor;
    }
  }, [filteredMoves, activeTab]);

  const activeMoveNames = useMemo(() => activeMoves.map((m) => m.name), [activeMoves]);

  const moveDetailsQueries = useMoveDetails(activeMoveNames);

  const moveDetailsMap = useMemo(() => {
    const map: Record<string, MoveDetail> = {};
    moveDetailsQueries.forEach((q, i) => {
      if (q.data && activeMoveNames[i]) map[activeMoveNames[i]] = q.data;
    });
    return map;
  }, [moveDetailsQueries, activeMoveNames]);

  const machineUrls = useMemo(() => {
    if (activeTab !== "machine") return [];
    const urls: string[] = [];
    for (const move of filteredMoves.machine) {
      const detail = moveDetailsMap[move.name];
      if (!detail?.machines?.length) continue;
      const match = detail.machines.find((m) => activeVGs.includes(m.version_group.name));
      if (match) urls.push(match.machine.url);
    }
    return urls;
  }, [activeTab, filteredMoves.machine, moveDetailsMap, activeVGs]);

  const machineDetailsQueries = useMachineDetails(machineUrls);

  const machineNumberMap = useMemo(() => {
    if (activeTab !== "machine") return undefined;
    const map: Record<string, string> = {};
    for (const q of machineDetailsQueries) {
      if (!q.data) continue;
      const { move, item } = q.data;
      map[move.name] = item.name.toUpperCase();
    }
    return map;
  }, [activeTab, machineDetailsQueries]);

  // Egg parent data — lazy loaded only when egg tab is active
  const [eggData, setEggData] = useState<Record<string, { n: string; p: string; i: number; g: string[]; l: Record<string, number> }> | null>(null);
  useEffect(() => {
    if (activeTab !== "egg" || eggData !== null) return;
    import("../data/egg-parents.json").then((m) => setEggData(m.default));
  }, [activeTab, eggData]);

  const speciesEggGroups = useMemo(() => {
    if (!eggData || !pokemon) return null;
    const smogonName = pokemon.species.name.replace(/-/g, "");
    return eggData[smogonName]?.g ?? null;
  }, [eggData, pokemon]);

  // moveName (PokeAPI) → sorted list of parents { name, pokeApiName }
  const eggParentMap = useMemo(() => {
    if (!eggData || !speciesEggGroups || !generation) return null;
    const genMask = 1 << (generation - 1);
    const selfSmogon = pokemon?.species.name.replace(/-/g, "");
    const map: Record<string, Array<{ name: string; pokeApiName: string; id: number }>> = {};
    for (const move of filteredMoves.egg) {
      const smogonMove = move.name.replace(/-/g, "");
      const parents: Array<{ name: string; pokeApiName: string; id: number }> = [];
      for (const [sid, data] of Object.entries(eggData)) {
        if (sid === selfSmogon) continue;
        if (!data.g.some((g) => speciesEggGroups.includes(g))) continue;
        if (!((data.l[smogonMove] ?? 0) & genMask)) continue;
        parents.push({ name: data.n, pokeApiName: data.p, id: data.i });
      }
      parents.sort((a, b) => a.name.localeCompare(b.name));
      map[move.name] = parents;
    }
    return map;
  }, [eggData, speciesEggGroups, generation, filteredMoves.egg, pokemon]);

  // Both normal and shiny URLs always defined so the browser fetches both
  // as soon as the modal opens — no delay when toggling the Shiny button.
  const homeSpriteNormal = pokemon ? `${SPRITES_ROOT}/other/home/${pokemon.id}.png` : null;
  const homeSpriteShiny  = pokemon ? `${SPRITES_ROOT}/other/home/shiny/${pokemon.id}.png` : null;
  const homeSprite = showShiny ? homeSpriteShiny : homeSpriteNormal;

  const gameSpriteNormal =
    game?.spriteVersion && pokemon ? spriteUrl(pokemon.id, game.spriteVersion) : null;
  const gameSpriteShiny =
    game?.spriteVersion && pokemon
      ? `${SPRITES_ROOT}/versions/${game.spriteVersion}/shiny/${pokemon.id}.png`
      : null;
  const gameSprite = showShiny ? gameSpriteShiny : gameSpriteNormal;
  const showGameSprite = gameSprite && gameSprite !== homeSprite;

  const formEnglishName = formDataMap?.[pokemonName]?.names.find((n) => n.language.name === "en")?.name;
  const displayName = formEnglishName ?? formatPokemonName(pokemonName);

  const tabs: Array<{ id: MoveTab; label: string; count: number }> = [
    { id: "level-up", label: "Level Up",    count: filteredMoves.levelUp.length },
    { id: "egg",      label: "Egg Moves",   count: filteredMoves.egg.length },
    { id: "machine",  label: "TM / HM",     count: filteredMoves.machine.length },
    { id: "tutor",    label: "Move Tutor",  count: filteredMoves.tutor.length },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-start justify-center px-4 py-8">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal */}
        <div
          className="relative z-10 w-full max-w-4xl rounded-xl border bg-background overflow-hidden"
          style={types[0] ? {
            boxShadow: `0 0 0 1px ${TYPE_COLORS[types[0]]}30, 0 25px 60px ${TYPE_COLORS[types[0]]}30, 0 8px 24px rgba(0,0,0,0.4)`,
          } : { boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}
        >
          {/* Header */}
          <div
            className="flex flex-col border-b sm:flex-row sm:items-center sm:justify-between"
            style={types[0] ? { background: `linear-gradient(135deg, ${TYPE_COLORS[types[0]]}40 0%, ${TYPE_COLORS[types[0]]}10 50%, transparent 100%)` } : undefined}
          >
            {/* Row 1: identity + close */}
            <div className="flex items-center gap-2 px-4 py-3 sm:min-w-0 sm:flex-1 sm:gap-6 sm:px-6 sm:py-4">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {pokemon && (() => {
                  // Alternate forms have IDs > 10000; extract the national dex number
                  // from the species URL (e.g. .../pokemon-species/6/) instead.
                  const speciesIdMatch = pokemon.species.url.match(/\/(\d+)\/?$/);
                  const dexNum = speciesIdMatch ? Number(speciesIdMatch[1]) : pokemon.id;
                  return (
                    <span className="shrink-0 font-mono text-sm text-muted-foreground">
                      #{String(dexNum).padStart(4, "0")}
                    </span>
                  );
                })()}
                <h2 className="text-xl font-bold">{displayName}</h2>
                {pokemon && (
                  <CryButton
                    id={pokemon.id}
                    generation={game?.generation}
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title={game ? `Play ${game.label} cry` : "Play cry"}
                  />
                )}
                <div className="flex shrink-0 items-center gap-1.5">
                  {types.map((t) => (
                    <Badge key={t} variant="default" className="capitalize !px-2" style={typeStyle(t)}>{t}</Badge>
                  ))}
                </div>
              </div>
              {/* Close — top-right on mobile, right side on desktop */}
              <button
                onClick={onClose}
                className="shrink-0 rounded-md border border-border bg-background p-1.5 hover:bg-muted sm:hidden"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Row 2 on mobile / right-side buttons on desktop */}
            <div className="flex items-center gap-2 border-t px-4 pb-3 pt-2 sm:border-0 sm:shrink-0 sm:px-6 sm:py-4 sm:pb-0 sm:pt-0">
              <div className="flex items-center rounded-md border border-border overflow-hidden bg-background">
                <button
                  onClick={() => prevPokemon && onNavigate(prevPokemon.name)}
                  disabled={!prevPokemon}
                  className="flex items-center gap-1.5 pl-2 pr-3 py-1 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Previous Pokémon"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" />
                  {prevPokemon && (
                    <>
                      <img src={`${SPRITES_ROOT}/${prevPokemon.id}.png`} alt={prevPokemon.name} className="h-6 w-6 object-contain" />
                      <span className="max-w-[80px] truncate text-xs">{formatPokemonName(prevPokemon.name)}</span>
                    </>
                  )}
                </button>
                <div className="w-px self-stretch bg-border" />
                <button
                  onClick={() => nextPokemon && onNavigate(nextPokemon.name)}
                  disabled={!nextPokemon}
                  className="flex items-center gap-1.5 pl-3 pr-2 py-1 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Next Pokémon"
                >
                  {nextPokemon && (
                    <>
                      <span className="max-w-[80px] truncate text-xs">{formatPokemonName(nextPokemon.name)}</span>
                      <img src={`${SPRITES_ROOT}/${nextPokemon.id}.png`} alt={nextPokemon.name} className="h-6 w-6 object-contain" />
                    </>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              </div>
              {/* Close — desktop only */}
              <button
                onClick={onClose}
                className="hidden shrink-0 rounded-md border border-border bg-background p-1.5 hover:bg-muted sm:block"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              Loading…
            </div>
          ) : (
            <>
              {/* Pokédex entry */}
              {flavorText && (
                <div className="border-b px-6 py-4">
                  <blockquote className="border-l-[3px] border-primary/50 pl-3">
                    <p className="text-sm italic leading-relaxed text-foreground/75">
                      {flavorText.text}
                    </p>
                    {game && (
                      <cite className="mt-1.5 block text-xs capitalize not-italic text-muted-foreground/60">
                        — {flavorText.version.name.replace(/-/g, " ")}
                      </cite>
                    )}
                  </blockquote>
                </div>
              )}

              {/* Sprite + info */}
              <div className="flex flex-col gap-6 p-6 sm:flex-row">
                {/* Left: sprite */}
                <div className="flex flex-shrink-0 flex-col items-center gap-3">
                  {/* Crossfading sprite pair — both load immediately so the
                      shiny image is already cached when the button is clicked */}
                  {homeSpriteNormal && homeSpriteShiny && (
                    <div className="relative h-36 w-36 sm:h-48 sm:w-48">
                      {/* Shimmer shown until the normal sprite has loaded */}
                      <div className={cn(
                        "absolute inset-4 skeleton-shimmer rounded-lg transition-opacity duration-300",
                        spriteLoaded ? "opacity-0 pointer-events-none" : "opacity-100",
                      )} />
                      <img
                        src={homeSpriteNormal}
                        alt={displayName}
                        onLoad={() => setSpriteLoaded(true)}
                        className={cn(
                          "absolute inset-0 h-full w-full object-contain transition-opacity duration-200",
                          showShiny ? "opacity-0" : "opacity-100",
                        )}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          if (pokemon) img.src = `${SPRITES_ROOT}/${pokemon.id}.png`;
                        }}
                      />
                      <img
                        src={homeSpriteShiny}
                        alt={`${displayName} shiny`}
                        className={cn(
                          "absolute inset-0 h-full w-full object-contain transition-opacity duration-200",
                          showShiny ? "opacity-100" : "opacity-0",
                        )}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          if (pokemon) img.src = `${SPRITES_ROOT}/${pokemon.id}.png`;
                        }}
                      />
                    </div>
                  )}
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
                  {showGameSprite && (
                    <GameSpriteThumb key={gameSprite} src={gameSprite} alt={`${displayName} in-game`} />
                  )}
                  {/* Hidden preload for the shiny game sprite */}
                  {gameSpriteShiny && gameSpriteShiny !== gameSpriteNormal && (
                    <img src={gameSpriteShiny} alt="" className="hidden" aria-hidden="true" />
                  )}
                </div>

                {/* Right: abilities + stats */}
                <div className="flex flex-1 flex-col gap-6 sm:flex-row">
                  {/* Abilities */}
                  <div className="sm:min-w-[160px] sm:max-w-[220px]">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Abilities
                    </h3>
                    {generation != null && generation <= 2 ? (
                      <p className="text-sm italic text-muted-foreground">
                        Abilities were introduced in Generation III.
                      </p>
                    ) : abilities.length === 0 ? (
                      <p className="text-sm italic text-muted-foreground">None</p>
                    ) : (
                      <ul className="space-y-3">
                        {abilities.map((a) => {
                          const detail = abilityDetailsMap[a.ability.name];
                          const desc = detail ? abilityDescription(detail, versionGroups) : null;
                          return (
                            <li key={a.slot} className="text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => navigate(`/abilities?ability=${a.ability.name}`)}
                                  className="font-bold capitalize text-primary hover:underline"
                                >
                                  {a.ability.name.replace(/-/g, " ")}
                                </button>
                                {a.is_hidden && (
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                    Hidden
                                  </span>
                                )}
                              </div>
                              {desc != null ? (
                                desc && (
                                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                    {desc}
                                  </p>
                                )
                              ) : (
                                <div className="mt-1 h-3 w-32 skeleton-shimmer rounded" />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex-1">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Base Stats
                    </h3>
                    <div key={pokemonName} className="space-y-1.5">
                      {stats.map((s, i) => (
                        <div key={s.name} className="flex items-center gap-2">
                          <span className="w-16 text-right text-xs text-muted-foreground">
                            {s.label}
                          </span>
                          <span className="w-8 text-right font-mono text-sm tabular-nums">
                            {s.value}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full animate-stat-fill",
                                statBarColor(s.value),
                              )}
                              style={{
                                width: `${Math.min(100, (s.value / 255) * 100)}%`,
                                animationDelay: `${i * 60}ms`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="w-16 text-right text-xs font-semibold text-muted-foreground">
                          BST
                        </span>
                        <span className="w-8 text-right font-mono text-sm font-bold tabular-nums">
                          {bst}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pokédex Data */}
              {(pokemon || species) && (() => {
                const GROWTH_RATE_LABELS: Record<string, string> = {
                  "slow": "Slow",
                  "medium": "Medium",
                  "fast": "Fast",
                  "medium-slow": "Medium Slow",
                  "slow-then-very-fast": "Erratic",
                  "fast-then-very-slow": "Fluctuating",
                };
                const EV_STAT_LABELS: Record<string, string> = {
                  "hp": "HP", "attack": "Atk", "defense": "Def",
                  "special-attack": "Sp. Atk", "special-defense": "Sp. Def", "speed": "Spd",
                };
                const evYields = pokemon?.stats
                  .filter((s) => s.effort > 0)
                  .map((s) => `${s.effort} ${EV_STAT_LABELS[s.stat.name] ?? s.stat.name}`)
                  .join(", ");

                const genderRate = species?.gender_rate;
                const femalePct = genderRate != null && genderRate !== -1 ? (genderRate / 8) * 100 : null;
                const malePct = femalePct != null ? 100 - femalePct : null;

                const genus = species?.genera.find((g) => g.language.name === "en")?.genus;
                const textRows = [
                  { label: "EV Yield", value: evYields || "—" },
                  { label: "Growth Rate", value: species ? (GROWTH_RATE_LABELS[species.growth_rate.name] ?? species.growth_rate.name) : "—" },
                  { label: "Color", value: species ? species.color.name : "—" },
                  { label: "Catch Rate", value: species != null ? `${species.capture_rate}/255` : "—" },
                  { label: "Base Friendship", value: species != null ? String(species.base_happiness) : "—" },
                  { label: "Egg Groups", value: species ? species.egg_groups.map((g) => g.name.replace(/-/g, " ")).join(", ") : "—" },
                ];

                const genderCell = genderRate != null && (
                  <div className="flex items-center gap-2">
                    <dt className="shrink-0 text-xs text-muted-foreground">Gender</dt>
                    <dd className="flex flex-1 items-center gap-1.5">
                      {genderRate === -1 ? (
                        <span className="text-sm font-medium text-muted-foreground">Genderless</span>
                      ) : (
                        <>
                          <span className="text-xs font-medium text-blue-400">♂{malePct}%</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full">
                            <div className="flex h-full">
                              {malePct! > 0 && <div className="h-full bg-blue-400" style={{ width: `${malePct}%` }} />}
                              {femalePct! > 0 && <div className="h-full bg-pink-400" style={{ width: `${femalePct}%` }} />}
                            </div>
                          </div>
                          <span className="text-xs font-medium text-pink-400">♀{femalePct}%</span>
                        </>
                      )}
                    </dd>
                  </div>
                );

                return (
                  <div className="border-t px-6 py-5">
                    <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-3 sm:gap-x-6">
                      {/* Row 0: Category (full width) */}
                      {genus && (
                        <div className="flex items-baseline gap-2 sm:col-span-3">
                          <dt className="shrink-0 text-xs text-muted-foreground">Category</dt>
                          <dd className="text-sm font-medium">{genus}</dd>
                        </div>
                      )}
                      {/* Row 1: Gender, EV Yield, Growth Rate */}
                      {genderCell}
                      {textRows.slice(0, 2).map(({ label, value }) => (
                        <div key={label} className="flex items-baseline gap-2">
                          <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
                          <dd className="truncate text-sm font-medium capitalize">{value}</dd>
                        </div>
                      ))}
                      {/* Row 2: Color, Base Friendship, Egg Groups */}
                      {textRows.slice(2).map(({ label, value }) => (
                        <div key={label} className="flex items-baseline gap-2">
                          <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
                          <dd className="truncate text-sm font-medium capitalize">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })()}

              {/* Evolution Chain */}
              {chainStages && (
                <div className="border-t px-6 py-5">
                  <h3 className="mb-4 text-base font-semibold">Evolution Chain</h3>
                  {/* Horizontal stages with arrows between them */}
                  <div className="flex items-start gap-2 overflow-x-auto pb-1">
                    {chainStages.map((stage, stageIdx) => (
                      <div key={stageIdx} className="flex items-start gap-2">
                        {/* Arrow between stages */}
                        {stageIdx > 0 && (
                          <div className="flex h-full items-center self-center px-1 text-lg text-muted-foreground">→</div>
                        )}
                        {/* Each stage: one or more Pokémon stacked vertically (branching) */}
                        <div className="flex flex-col gap-3">
                          {stage.map((node) => {
                            const isCurrent = node.speciesName === pokemon?.species.name;
                            return isCurrent ? (
                              <div
                                key={node.speciesName}
                                className="flex flex-col items-center gap-1 rounded-lg border-2 border-primary bg-primary/10 px-3 py-2 min-w-[80px]"
                              >
                                <img
                                  src={`${SPRITES_ROOT}/other/home/${node.speciesId}.png`}
                                  alt={node.speciesName}
                                  className="h-14 w-14 object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = `${SPRITES_ROOT}/${node.speciesId}.png`;
                                  }}
                                />
                                <p className="text-center text-xs font-semibold leading-tight text-primary">
                                  {formatPokemonName(node.speciesName)}
                                </p>
                                {node.methods.map((method) => (
                                  <p key={method} className="text-center text-[10px] text-muted-foreground leading-tight">{method}</p>
                                ))}
                              </div>
                            ) : (
                              <button
                                key={node.speciesName}
                                className="flex flex-col items-center gap-1 rounded-lg border bg-muted/30 px-3 py-2 text-center transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-[80px]"
                                onClick={() => onNavigate(node.speciesName)}
                              >
                                <img
                                  src={`${SPRITES_ROOT}/other/home/${node.speciesId}.png`}
                                  alt={node.speciesName}
                                  className="h-14 w-14 object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = `${SPRITES_ROOT}/${node.speciesId}.png`;
                                  }}
                                />
                                <p className="text-xs font-medium leading-tight">
                                  {formatPokemonName(node.speciesName)}
                                </p>
                                {node.methods.map((method) => (
                                  <p key={method} className="text-center text-[10px] text-muted-foreground leading-tight">{method}</p>
                                ))}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Type Effectiveness */}
              {typeEffectiveness && (
                <div className="border-t px-6 py-5">
                  <h3 className="mb-4 text-base font-semibold">Type Effectiveness</h3>
                  <div className="space-y-3">
                    {typeEffectiveness.immune.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Immune (0×)</p>
                        <div className="flex flex-wrap gap-2">
                          {typeEffectiveness.immune.map((t) => (
                            <Badge key={t} variant="default" className="capitalize text-xs !px-2" style={typeStyle(t)}>{t}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {(typeEffectiveness.quarter.length > 0 || typeEffectiveness.half.length > 0) && (
                      <div>
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Resistant</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {typeEffectiveness.quarter.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1">
                              <Badge variant="default" className="capitalize text-xs !px-2" style={typeStyle(t)}>{t}</Badge>
                              <span className="text-xs text-muted-foreground">¼×</span>
                            </span>
                          ))}
                          {typeEffectiveness.half.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1">
                              <Badge variant="default" className="capitalize text-xs !px-2" style={typeStyle(t)}>{t}</Badge>
                              <span className="text-xs text-muted-foreground">½×</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(typeEffectiveness.double.length > 0 || typeEffectiveness.quadruple.length > 0) && (
                      <div>
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Weak to</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {typeEffectiveness.quadruple.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1">
                              <Badge variant="default" className="capitalize text-xs !px-2" style={typeStyle(t)}>{t}</Badge>
                              <span className="text-xs text-muted-foreground">4×</span>
                            </span>
                          ))}
                          {typeEffectiveness.double.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1">
                              <Badge variant="default" className="capitalize text-xs !px-2" style={typeStyle(t)}>{t}</Badge>
                              <span className="text-xs text-muted-foreground">2×</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Locations */}
              <div className="border-t px-6 py-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">Locations</h3>
                  {allGamesLocations.length > 0 && (
                    <select
                      value={resolvedLocationsGameValue ?? ""}
                      onChange={(e) => setLocationsGameValue(e.target.value)}
                      className="rounded-md border bg-background px-2 py-1 text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {allGamesLocations.map(({ game: g }) => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  )}
                </div>
                {encountersLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <div key={i} className="h-8 skeleton-shimmer rounded" />)}
                  </div>
                ) : allGamesLocations.length === 0 ? (
                  <p className="text-sm italic text-muted-foreground">
                    Not found in the wild in any supported game.
                  </p>
                ) : (() => {
                  // Show only the selected game's locations
                  const selected = allGamesLocations.find((x) => x.game.value === resolvedLocationsGameValue);
                  if (!selected) return null;
                  const { game: g, locations } = selected;
                  const rows: { locKey: string; locName: string; versions: string[]; method: string; conditions: string[]; levelRange: string; chance: number; isFirstInLoc: boolean; }[] = [];
                  for (const loc of locations) {
                    let firstInLoc = true;
                    for (const m of loc.methods) {
                      const levelRange = m.minLevel === m.maxLevel ? `${m.minLevel}` : `${m.minLevel}–${m.maxLevel}`;
                      rows.push({ locKey: loc.key, locName: loc.name, versions: m.versions, method: m.method, conditions: m.conditions, levelRange, chance: m.chance, isFirstInLoc: firstInLoc });
                      firstInLoc = false;
                    }
                  }
                  const hasVersionLabels = rows.some((r) => r.versions.length > 0);
                  return (
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                            <th className="pb-2 pr-4">Location</th>
                            {hasVersionLabels && <th className="pb-2 pr-4">Version</th>}
                            <th className="pb-2 pr-4">Method</th>
                            <th className="pb-2 pr-4">Levels</th>
                            <th className="pb-2 text-right">Chance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {rows.map((row, i) => {
                            const methodLabel = METHOD_LABELS[row.method] ?? row.method.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                            const condLabel = row.conditions.map(formatConditionLabel).filter(Boolean).join(", ");
                            return (
                              <tr key={i} className="hover:bg-muted/30">
                                <td className="py-1.5 pr-4 whitespace-nowrap">
                                  {row.isFirstInLoc ? (
                                    onOpenInCatchTracker ? (
                                      <button
                                        className="text-left text-muted-foreground hover:text-primary hover:underline transition-colors"
                                        onClick={() => { onOpenInCatchTracker(g.value, row.locKey); onClose(); }}
                                      >
                                        {row.locName}
                                      </button>
                                    ) : (
                                      <span className="text-muted-foreground">{row.locName}</span>
                                    )
                                  ) : ""}
                                </td>
                                {hasVersionLabels && (
                                  <td className="py-1.5 pr-4">
                                    <div className="flex flex-wrap gap-1">
                                      {row.versions.map((v) => <VersionBadge key={v} version={v} />)}
                                    </div>
                                  </td>
                                )}
                                <td className="py-1.5 pr-4 text-muted-foreground">
                                  {methodLabel}
                                  {condLabel && <span className="ml-1 text-xs opacity-70">({condLabel})</span>}
                                </td>
                                <td className="py-1.5 pr-4 font-mono tabular-nums text-muted-foreground">{row.levelRange}</td>
                                <td className="py-1.5 text-right font-mono tabular-nums text-muted-foreground">{row.chance}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Moves */}
              <div className="border-t">
                <div className="px-6 pt-5 pb-1">
                  <h3 className="text-base font-semibold">Moves</h3>
                </div>
                {/* Mobile: dropdown */}
                <div className="px-6 py-3 sm:hidden">
                  <select
                    value={activeTab}
                    onChange={(e) => setActiveTab(e.target.value as MoveTab)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-base sm:text-sm font-medium text-foreground"
                  >
                    {tabs.map((tab) => (
                      <option key={tab.id} value={tab.id}>
                        {tab.label}{tab.count > 0 ? ` (${tab.count})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Desktop: tab bar */}
                <div className="hidden overflow-x-auto border-b px-6 sm:flex">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                        activeTab === tab.id
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-xs",
                            activeTab === tab.id
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-4">
                  {activeMoves.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No moves available
                      {game ? ` in ${game.label}` : ""}.
                    </p>
                  ) : (
                    <MoveTable
                      moves={activeMoves}
                      moveDetailsMap={moveDetailsMap}
                      showLevel={activeTab === "level-up"}
                      machineNumberMap={machineNumberMap}
                      eggParentMap={activeTab === "egg" ? eggParentMap : undefined}
                      eggDataLoaded={eggData !== null}
                      hasGeneration={generation != null}
                      expandedMove={expandedMove}
                      onToggleExpand={(name) =>
                        setExpandedMove((prev) => (prev === name ? null : name))
                      }
                      onNavigate={onNavigate}
                      versionGroups={versionGroups}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
