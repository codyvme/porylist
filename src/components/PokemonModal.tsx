import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Plus, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { typeStyle } from "@/lib/types";
import { computeTypeEffectiveness } from "@/lib/type-chart";
import { GAME_VERSION_GROUPS, GAME_VERSIONS, spriteUrl, type GameOption } from "@/lib/games";
import {
  typesForGeneration,
  useSinglePokemon,
  usePokemonSpecies,
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
import { cn } from "@/lib/utils";

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
};

const SKIP_CONDITIONS = new Set([
  "no-swarm",
  "slot2-none",
  "using-old-rod",
  "using-good-rod",
  "using-super-rod",
]);

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
  name: string;
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
      className="inline-block rounded px-1.5 py-0.5 text-xs font-medium"
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
    locations.push({ name: formatLocationName(enc.location_area.name), methods: result });
  }

  return locations.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

interface PokemonModalProps {
  pokemonName: string;
  game: GameOption | undefined;
  onClose: () => void;
  onNavigate: (name: string) => void;
  team?: string[];
  onAddToTeam?: (name: string) => void;
  onRemoveFromTeam?: (name: string) => void;
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

function DamageCategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    physical:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    special:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
    status: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-medium capitalize",
        styles[category] ?? styles.status,
      )}
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
              <>
                <tr
                  key={move.name}
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
                        <div className="h-4 w-10 animate-pulse rounded bg-muted" />
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
                        className="capitalize"
                        style={typeStyle(detail.type.name)}
                      >
                        {detail.type.name}
                      </Badge>
                    ) : (
                      <div className="h-5 w-16 animate-pulse rounded bg-muted" />
                    )}
                  </td>
                  <td className="py-1.5 pr-4">
                    {detail ? (
                      <DamageCategoryBadge category={detail.damage_class.name} />
                    ) : (
                      <div className="h-5 w-14 animate-pulse rounded bg-muted" />
                    )}
                  </td>
                  <td className="hidden py-1.5 pr-4 text-right font-mono tabular-nums sm:table-cell">
                    {detail ? (
                      detail.power ?? "—"
                    ) : (
                      <div className="ml-auto h-4 w-6 animate-pulse rounded bg-muted" />
                    )}
                  </td>
                  <td className="hidden py-1.5 pr-4 text-right font-mono tabular-nums sm:table-cell">
                    {detail ? (
                      detail.accuracy != null ? `${detail.accuracy}%` : "—"
                    ) : (
                      <div className="ml-auto h-4 w-8 animate-pulse rounded bg-muted" />
                    )}
                  </td>
                  <td className="hidden py-1.5 text-right font-mono tabular-nums sm:table-cell">
                    {detail ? (
                      detail.pp ?? "—"
                    ) : (
                      <div className="ml-auto h-4 w-6 animate-pulse rounded bg-muted" />
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
                          <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                        )}
                        {eggParentMap !== undefined && (
                          <div>
                            {!hasGeneration ? (
                              <p className="italic">Select a game to see breeding parents.</p>
                            ) : !eggDataLoaded ? (
                              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
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
                                            src={`https://sprites.porylist.com/sprites/pokemon/${p.id}.png`}
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
              </>
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

interface DirectEvolution {
  speciesName: string;
  speciesId: number;
  methods: string[];
}

function findAllEvolutions(chain: ChainLink, targetName: string): DirectEvolution[] | null {
  if (chain.species.name === targetName) {
    const all: DirectEvolution[] = [];
    function collect(links: ChainLink[]) {
      for (const link of links) {
        all.push({
          speciesName: link.species.name,
          speciesId: extractIdFromUrl(link.species.url),
          methods: [...new Set(link.evolution_details.map(formatEvolutionMethod))],
        });
        collect(link.evolves_to);
      }
    }
    collect(chain.evolves_to);
    return all;
  }
  for (const next of chain.evolves_to) {
    const result = findAllEvolutions(next, targetName);
    if (result !== null) return result;
  }
  return null;
}

export function PokemonModal({ pokemonName, game, onClose, onNavigate, team, onAddToTeam, onRemoveFromTeam }: PokemonModalProps) {
  const [activeTab, setActiveTab] = useState<MoveTab>("level-up");
  const [showShiny, setShowShiny] = useState(false);
  const [expandedMove, setExpandedMove] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    setExpandedMove(null);
  }, [activeTab]);

  const { data: pokemon, isLoading } = useSinglePokemon(pokemonName);
  const { data: species } = usePokemonSpecies(pokemon?.species.name ?? null);
  const { data: evolutionChain } = useEvolutionChain(species?.evolution_chain.url ?? null);
  const { data: encounterData, isLoading: encountersLoading } = usePokemonEncounters(pokemon?.id ?? null);

  const generation = game?.generation;

  const versionGroups = useMemo(() => {
    if (!game) return ["scarlet-violet"];
    return GAME_VERSION_GROUPS[game.value] ?? ["scarlet-violet"];
  }, [game]);

  const encounterVersions = useMemo(() => {
    if (!game) return [];
    return GAME_VERSIONS[game.value] ?? [];
  }, [game]);

  const processedLocations = useMemo(() => {
    if (!encounterData || encounterVersions.length === 0) return [];
    return processEncounters(encounterData, encounterVersions);
  }, [encounterData, encounterVersions]);

  const types = useMemo(
    () => (pokemon ? typesForGeneration(pokemon, generation) : []),
    [pokemon, generation],
  );

  const typeEffectiveness = useMemo(() => {
    if (types.length === 0) return null;
    const chart = computeTypeEffectiveness(types);
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

  const allEvolutions = useMemo(() => {
    if (!evolutionChain || !pokemon) return null;
    const evolutions = findAllEvolutions(evolutionChain.chain, pokemon.species.name);
    if (!evolutions) return null;
    const maxDex = generation != null ? GEN_MAX_DEX[generation] : undefined;
    return maxDex != null ? evolutions.filter((e) => e.speciesId <= maxDex) : evolutions;
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

    const levelUp = [...levelUpMap.values()];
    const egg = [...eggSet].map((name) => ({ name, level: 0 }));
    const machine = [...machineSet].map((name) => ({ name, level: 0 }));
    const tutor = [...tutorSet].map((name) => ({ name, level: 0 }));

    levelUp.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    egg.sort((a, b) => a.name.localeCompare(b.name));
    machine.sort((a, b) => a.name.localeCompare(b.name));
    tutor.sort((a, b) => a.name.localeCompare(b.name));

    return { levelUp, egg, machine, tutor };
  }, [pokemon, activeVGs]);

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

  const homeSprite = pokemon
    ? showShiny
      ? `https://sprites.porylist.com/sprites/pokemon/other/home/shiny/${pokemon.id}.png`
      : `https://sprites.porylist.com/sprites/pokemon/other/home/${pokemon.id}.png`
    : null;
  const gameSprite =
    game?.spriteVersion && pokemon
      ? showShiny
        ? `https://sprites.porylist.com/sprites/pokemon/versions/${game.spriteVersion}/shiny/${pokemon.id}.png`
        : spriteUrl(pokemon.id, game.spriteVersion)
      : null;
  const showGameSprite = gameSprite && gameSprite !== homeSprite;

  const displayName = pokemonName
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

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
        <div className="relative z-10 w-full max-w-4xl rounded-xl border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-6 border-b px-6 py-4">
            <div className="flex min-w-0 flex-1 items-center gap-6">
              <div className="flex items-center gap-2.5">
                {pokemon && (
                  <span className="shrink-0 font-mono text-sm text-muted-foreground">
                    #{String(pokemon.id).padStart(4, "0")}
                  </span>
                )}
                <div className="flex flex-col gap-0">
                  <h2 className="text-xl font-bold">{displayName}</h2>
                  {species && (() => {
                    const genus = species.genera.find((g) => g.language.name === "en")?.genus;
                    return genus ? <span className="text-xs text-muted-foreground">{genus}</span> : null;
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {types.map((t) => (
                  <Badge
                    key={t}
                    variant="default"
                    className="capitalize"
                    style={typeStyle(t)}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {pokemon && onAddToTeam && (
                <button
                  onClick={() => {
                    if (team?.includes(pokemon.name)) onRemoveFromTeam?.(pokemon.name);
                    else onAddToTeam(pokemon.name);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium transition-colors",
                    team?.includes(pokemon.name)
                      ? "border-primary/50 bg-primary/10 text-primary hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                      : team && team.length >= 6
                      ? "cursor-not-allowed border-muted text-muted-foreground opacity-50"
                      : "hover:bg-muted",
                  )}
                  disabled={!team?.includes(pokemon.name) && team?.length === 6}
                  title={team?.includes(pokemon.name) ? "Remove from team" : team?.length === 6 ? "Team is full" : "Add to team"}
                >
                  {team?.includes(pokemon.name)
                    ? <><Check className="h-3.5 w-3.5" /> In Team</>
                    : <><Plus className="h-3.5 w-3.5" /> Add to Team</>}
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-md p-1.5 hover:bg-muted"
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
                  <p className="text-sm italic text-muted-foreground">
                    "{flavorText.text}"
                  </p>
                  {game && (
                    <p className="mt-1 text-xs capitalize text-muted-foreground/60">
                      {flavorText.version.name.replace(/-/g, " ")}
                    </p>
                  )}
                </div>
              )}

              {/* Sprite + info */}
              <div className="flex flex-col gap-6 p-6 sm:flex-row">
                {/* Left: sprite */}
                <div className="flex flex-shrink-0 flex-col items-center gap-3">
                  {homeSprite && (
                    <img
                      src={homeSprite}
                      alt={displayName}
                      className="h-36 w-36 object-contain sm:h-48 sm:w-48"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (pokemon) {
                          img.src = `https://sprites.porylist.com/sprites/pokemon/${pokemon.id}.png`;
                        }
                      }}
                    />
                  )}
                  <button
                    onClick={() => setShowShiny((s) => !s)}
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
                  {showGameSprite && (
                    <GameSpriteThumb key={gameSprite} src={gameSprite} alt={`${displayName} in-game`} />
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
                                <span className="font-medium capitalize">
                                  {a.ability.name.replace(/-/g, " ")}
                                </span>
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
                                <div className="mt-1 h-3 w-32 animate-pulse rounded bg-muted" />
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
                    <div className="space-y-1.5">
                      {stats.map((s) => (
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
                                "h-full rounded-full transition-all",
                                statBarColor(s.value),
                              )}
                              style={{
                                width: `${Math.min(100, (s.value / 255) * 100)}%`,
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

              {/* Evolutions */}
              {allEvolutions && allEvolutions.length > 0 && (
                <div className="border-t px-6 py-5">
                  <h3 className="mb-4 text-base font-semibold">Evolves Into</h3>
                  <div className="flex flex-wrap gap-4">
                    {allEvolutions.map((evo) => (
                      <button
                        key={evo.speciesName}
                        className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus:outline-none"
                        onClick={() => onNavigate(evo.speciesName)}
                      >
                        <img
                          src={`https://sprites.porylist.com/sprites/pokemon/other/home/${evo.speciesId}.png`}
                          alt={evo.speciesName}
                          className="h-16 w-16 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://sprites.porylist.com/sprites/pokemon/${evo.speciesId}.png`;
                          }}
                        />
                        <div>
                          <p className="font-medium capitalize">
                            {evo.speciesName.replace(/-/g, " ")}
                          </p>
                          {evo.methods.map((method) => (
                            <p key={method} className="text-xs text-muted-foreground">{method}</p>
                          ))}
                        </div>
                      </button>
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
                            <Badge key={t} variant="default" className="capitalize text-xs" style={typeStyle(t)}>{t}</Badge>
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
                              <Badge variant="default" className="capitalize text-xs" style={typeStyle(t)}>{t}</Badge>
                              <span className="text-xs text-muted-foreground">¼×</span>
                            </span>
                          ))}
                          {typeEffectiveness.half.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1">
                              <Badge variant="default" className="capitalize text-xs" style={typeStyle(t)}>{t}</Badge>
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
                              <Badge variant="default" className="capitalize text-xs" style={typeStyle(t)}>{t}</Badge>
                              <span className="text-xs text-muted-foreground">4×</span>
                            </span>
                          ))}
                          {typeEffectiveness.double.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1">
                              <Badge variant="default" className="capitalize text-xs" style={typeStyle(t)}>{t}</Badge>
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
              {game && (
                <div className="border-t px-6 py-5">
                  <h3 className="mb-4 text-base font-semibold">
                    Locations
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{game.label}</span>
                  </h3>
                  {encountersLoading ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
                      ))}
                    </div>
                  ) : processedLocations.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">
                      {game.generation != null && game.generation >= 8
                        ? `Location data is not yet available for ${game.label}.`
                        : `Not found in the wild in ${game.label}. May be obtained via trade, gift, or event.`}
                    </p>
                  ) : (() => {
                    const hasVersionLabels = processedLocations.some((loc) =>
                      loc.methods.some((m) => m.versions.length > 0)
                    );
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
                            {processedLocations.flatMap((loc) =>
                              loc.methods.map((m, mi) => {
                                const methodLabel = METHOD_LABELS[m.method] ?? m.method.replace(/-/g, " ");
                                const condLabel = m.conditions
                                  .map((c) => CONDITION_LABELS[c] ?? c)
                                  .join(", ");
                                const levelRange = m.minLevel === m.maxLevel
                                  ? `${m.minLevel}`
                                  : `${m.minLevel}–${m.maxLevel}`;
                                return (
                                  <tr key={`${loc.name}|${m.method}|${m.conditions.join()}|${m.versions.join()}`} className="hover:bg-muted/30">
                                    <td className="py-1.5 pr-4 font-medium">
                                      {mi === 0 ? loc.name : ""}
                                    </td>
                                    {hasVersionLabels && (
                                      <td className="py-1.5 pr-4">
                                        <div className="flex flex-wrap gap-1">
                                          {m.versions.map((v) => (
                                            <VersionBadge key={v} version={v} />
                                          ))}
                                        </div>
                                      </td>
                                    )}
                                    <td className="py-1.5 pr-4 text-muted-foreground">
                                      {methodLabel}
                                      {condLabel ? (
                                        <span className="ml-1 text-xs opacity-70">({condLabel})</span>
                                      ) : null}
                                    </td>
                                    <td className="py-1.5 pr-4 font-mono tabular-nums text-muted-foreground">
                                      {levelRange}
                                    </td>
                                    <td className="py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                                      {m.chance}%
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}

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
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm font-medium text-foreground"
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
