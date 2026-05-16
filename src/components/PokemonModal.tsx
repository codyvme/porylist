import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { typeStyle } from "@/lib/types";
import { GAME_VERSION_GROUPS, GAME_VERSIONS, spriteUrl, type GameOption } from "@/lib/games";
import {
  typesForGeneration,
  useSinglePokemon,
  usePokemonSpecies,
  useMoveDetails,
  useAbilityDetails,
  usePokemonEncounters,
  VERSION_GROUP_TO_GEN,
  type MoveDetail,
  type AbilityDetail,
  type LocationAreaEncounter,
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
  expandedMove: string | null;
  onToggleExpand: (name: string) => void;
  versionGroups: string[];
}

function MoveTable({ moves, moveDetailsMap, showLevel, expandedMove, onToggleExpand, versionGroups }: MoveTableProps) {
  const colCount = showLevel ? 8 : 7;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-medium text-muted-foreground">
            <th className="w-6 pb-2" />
            {showLevel && (
              <th className="pb-2 pr-4 text-right">Lv.</th>
            )}
            <th className="pb-2 pr-4">Name</th>
            <th className="pb-2 pr-4">Type</th>
            <th className="pb-2 pr-4">Category</th>
            <th className="pb-2 pr-4 text-right">Power</th>
            <th className="pb-2 pr-4 text-right">Acc.</th>
            <th className="pb-2 text-right">PP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {moves.map((move) => {
            const detail = moveDetailsMap[move.name];
            const isExpanded = expandedMove === move.name;
            const effect = detail ? moveDescription(detail, versionGroups) : "";
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
                  <td className="py-1.5 pr-4 text-right font-mono tabular-nums">
                    {detail ? (
                      detail.power ?? "—"
                    ) : (
                      <div className="ml-auto h-4 w-6 animate-pulse rounded bg-muted" />
                    )}
                  </td>
                  <td className="py-1.5 pr-4 text-right font-mono tabular-nums">
                    {detail ? (
                      detail.accuracy != null ? `${detail.accuracy}%` : "—"
                    ) : (
                      <div className="ml-auto h-4 w-8 animate-pulse rounded bg-muted" />
                    )}
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums">
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
                    {showLevel && <td />} {/* level column */}
                    <td colSpan={colCount - (showLevel ? 2 : 1)} className="py-2 pr-4 text-xs text-muted-foreground">
                      {effect || (
                        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                      )}
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
        style={{ imageRendering: "pixelated" }}
        onError={() => setFailed(true)}
      />
      <span className="text-xs text-muted-foreground">In-game</span>
    </div>
  );
}

export function PokemonModal({ pokemonName, game, onClose }: PokemonModalProps) {
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

  const filteredMoves = useMemo(() => {
    if (!pokemon) return { levelUp: [], egg: [], machine: [], tutor: [] };

    let activeVGs = versionGroups;
    if (!game) {
      const hasInSV = pokemon.moves.some((m) =>
        m.version_group_details.some((vgd) => vgd.version_group.name === "scarlet-violet"),
      );
      if (!hasInSV) {
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
        activeVGs = bestVGs;
      }
    }

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
  }, [pokemon, versionGroups, game]);

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

  const homeSprite = pokemon
    ? showShiny
      ? `/poke-sprites/sprites/pokemon/other/home/shiny/${pokemon.id}.png`
      : `/poke-sprites/sprites/pokemon/other/home/${pokemon.id}.png`
    : null;
  const gameSprite =
    game?.spriteVersion && pokemon
      ? showShiny
        ? `/poke-sprites/sprites/pokemon/versions/${game.spriteVersion}/shiny/${pokemon.id}.png`
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
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold">{displayName}</h2>
              {pokemon && (
                <span className="font-mono text-sm text-muted-foreground">
                  #{String(pokemon.id).padStart(4, "0")}
                </span>
              )}
              <div className="flex gap-1.5">
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
            <button
              onClick={onClose}
              className="ml-4 rounded-md p-1.5 hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
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
              <div className="flex gap-6 p-6">
                {/* Left: sprite */}
                <div className="flex flex-shrink-0 flex-col items-center gap-3">
                  {homeSprite && (
                    <img
                      src={homeSprite}
                      alt={displayName}
                      className="h-48 w-48 object-contain"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (pokemon) {
                          img.src = `/poke-sprites/sprites/pokemon/${pokemon.id}.png`;
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
                  <div className="min-w-[160px] max-w-[220px]">
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
                <div className="flex border-b px-6">
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
                      expandedMove={expandedMove}
                      onToggleExpand={(name) =>
                        setExpandedMove((prev) => (prev === name ? null : name))
                      }
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
