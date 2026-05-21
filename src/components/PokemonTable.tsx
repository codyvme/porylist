import { useDeferredValue, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { PokemonModal } from "@/components/PokemonModal";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type Row as TableRow,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, ChevronsUpDown, ListFilter, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  extractIdFromUrl,
  typesForGeneration,
  useAllPokemonDetails,
  useAllPokemonEntries,
  useAllPokemonSpecies,
  useFormDetails,
  usePokemonFormData,
  usePokemonList,
  useVersionExclusives,
  VERSION_GROUP_TO_GEN,
  type Pokemon,
  type PokemonFormDataMap,
  type PokemonListEntry,
} from "@/lib/pokeapi";
import {
  GAMES,
  GAMES_BY_VALUE,
  regionalNumber,
  spriteUrl,
} from "@/lib/games";
import { typeStyle } from "@/lib/types";
import { ALL_TYPES } from "@/lib/type-chart";
import { cn, formatPokemonName } from "@/lib/utils";

interface Row {
  id: number;
  name: string;
  sprite: string | null;
  types: string[];
  isLoading: boolean;
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
  height: number;
  weight: number;
  captureRate: number | null;
  eggGroups: string[] | null;
  isLegendary: boolean | null;
  isMythical: boolean | null;
  isBaby: boolean | null;
  isMono: boolean;
  isNoEvolution: boolean | null;
}

type DisplayRow =
  | { kind: "base"; row: TableRow<Row> }
  | { kind: "variant"; formName: string; parentName: string };

function getFormSuffixMinGen(suffix: string): number {
  const s = suffix.toLowerCase();
  if (s.startsWith("mega") || s === "primal") return 6;
  if (s.startsWith("alola")) return 7;
  if (s.startsWith("galar") || s === "gmax") return 8;
  if (s.startsWith("hisui")) return 8;
  if (s.startsWith("paldea")) return 9;
  return 1;
}

function formSuffix(formName: string, baseName: string): string {
  return formName.startsWith(baseName + "-")
    ? formName.slice(baseName.length + 1)
    : formName;
}

function canonicalFormName(
  formName: string,
  formDataMap: PokemonFormDataMap | undefined,
): string {
  const data = formDataMap?.[formName];
  if (data) {
    const eng = data.names.find((n) => n.language.name === "en")?.name;
    if (eng) return eng;
  }
  return formName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const columnHelper = createColumnHelper<Row>();

const GEN1_GAME_VALUE = "red-blue-yellow";

function SortHeader({
  label,
  sorted,
}: {
  label: string;
  sorted: false | "asc" | "desc";
}) {
  const Icon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <span className="inline-flex select-none items-center gap-1.5 whitespace-nowrap">
      {label}
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          sorted ? "text-foreground" : "text-muted-foreground/60",
        )}
      />
    </span>
  );
}

function statColumn(
  key: "hp" | "attack" | "defense" | "specialAttack" | "specialDefense" | "speed",
  label: string,
) {
  return columnHelper.accessor(key, {
    id: key,
    header: ({ column }) => (
      <SortHeader label={label} sorted={column.getIsSorted()} />
    ),
    cell: ({ getValue, row }) => {
      if (row.original.isLoading) {
        return <div className="h-4 w-8 animate-pulse rounded bg-muted" />;
      }
      const v = getValue();
      return (
        <span className="font-mono tabular-nums text-sm">
          {v > 0 ? v : "—"}
        </span>
      );
    },
  });
}


const typesColumn = columnHelper.accessor("types", {
  id: "types",
  header: () => <span className="select-none">Type</span>,
  enableSorting: false,
  cell: ({ getValue, row }) => {
    const types = getValue();
    if (row.original.isLoading) {
      return <div className="h-5 w-24 animate-pulse rounded bg-muted" />;
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {(types as string[]).map((t: string) => (
          <Badge
            key={t}
            variant="default"
            className="capitalize !rounded !px-1.5"
            style={typeStyle(t)}
          >
            {t}
          </Badge>
        ))}
      </div>
    );
  },
});

function statByName(detail: Pokemon | undefined, name: string): number {
  if (!detail) return 0;
  return detail.stats.find((s) => s.stat.name === name)?.base_stat ?? 0;
}

function buildRow(
  entry: PokemonListEntry,
  detail: Pokemon | undefined,
  isLoading: boolean,
  spriteVersion: string | undefined,
  generation: number | undefined,
  captureRate: number | null,
  eggGroups: string[] | null,
  isLegendary: boolean | null,
  isMythical: boolean | null,
  isBaby: boolean | null,
  isNoEvolution: boolean | null,
): Row {
  const id = detail?.id ?? extractIdFromUrl(entry.url);
  return {
    id,
    name: detail?.name ?? entry.name,
    sprite: spriteUrl(id, spriteVersion),
    types: detail ? typesForGeneration(detail, generation) : [],
    isLoading,
    hp: statByName(detail, "hp"),
    attack: statByName(detail, "attack"),
    defense: statByName(detail, "defense"),
    specialAttack: statByName(detail, "special-attack"),
    specialDefense: statByName(detail, "special-defense"),
    speed: statByName(detail, "speed"),
    height: detail?.height ?? 0,
    weight: detail?.weight ?? 0,
    captureRate,
    eggGroups,
    isLegendary,
    isMythical,
    isBaby,
    isMono: !isLoading && detail != null ? typesForGeneration(detail, generation).length === 1 : false,
    isNoEvolution,
  };
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

export function PokemonTable({ team, onAddToTeam, onRemoveFromTeam, teamBuilderOpen, caught, onToggleCaught, onOpenInCatchTracker }: {
  team: string[];
  onAddToTeam: (name: string) => void;
  onRemoveFromTeam: (name: string) => void;
  teamBuilderOpen: boolean;
  caught: Record<string, string[]>;
  onToggleCaught: (name: string, gameKey: string) => void;
  onOpenInCatchTracker?: (gameValue: string, locationKey: string) => void;
}) {
  const list = usePokemonList();
  const entries = list.data?.results ?? [];

  const detailsQuery = useAllPokemonDetails(entries.map((e) => e.name));
  const detailsMap = detailsQuery.data;

  const allEntriesQuery = useAllPokemonEntries();

  const [search, setSearch] = useState("");
  const [game, setGame] = useState<string>("");
  const [exclusiveVersion, setExclusiveVersion] = useState<string>("");
  const deferredGame = useDeferredValue(game);
  const deferredExclusiveVersion = useDeferredValue(exclusiveVersion);

  const versionExclusivesQuery = useVersionExclusives();
  const versionExclusivesData = versionExclusivesQuery.data;
  const deferredSearch = useDeferredValue(search);
  const selectedGame = deferredGame ? GAMES_BY_VALUE[deferredGame] : undefined;
  const spriteVersion = selectedGame?.spriteVersion;
  const generation = selectedGame?.generation;
  const isGen1 = selectedGame?.value === GEN1_GAME_VALUE;

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleExpanded = useCallback((name: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const [selectedPokemon, setSelectedPokemon] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get("pokemon");
  });

  const openModal = useCallback((name: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("pokemon", name);
    history.pushState({}, "", `?${params}`);
    setSelectedPokemon(name);
  }, []);

  const closeModal = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("pokemon");
    const search = params.toString();
    history.pushState({}, "", search ? `?${search}` : window.location.pathname);
    setSelectedPokemon(null);
  }, []);

  useEffect(() => {
    const handler = () => {
      setSelectedPokemon(new URLSearchParams(window.location.search).get("pokemon"));
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const openModalRef = useRef(openModal);
  openModalRef.current = openModal;

  // Build a map from base pokemon name → alternate form names
  const formsMap = useMemo(() => {
    if (!allEntriesQuery.data || !entries.length) return {} as Record<string, string[]>;
    const baseNames = entries.map((e) => e.name);

    // Some base Pokémon have a default-form suffix (e.g. deoxys-normal, giratina-altered).
    // Build a species-name → base-pokemon-name lookup so forms like "deoxys-attack" can
    // still be matched to "deoxys-normal" via the shared species name "deoxys".
    const speciesToBase: Record<string, string> = {};
    for (const baseName of baseNames) {
      const speciesName = detailsMap?.[baseName]?.species.name;
      if (speciesName && speciesName !== baseName && !speciesToBase[speciesName]) {
        speciesToBase[speciesName] = baseName;
      }
    }

    const map: Record<string, string[]> = {};
    for (const entry of allEntriesQuery.data.results) {
      const id = extractIdFromUrl(entry.url);
      if (id <= 1025) continue;
      let bestBase: string | null = null;
      for (const baseName of baseNames) {
        if (
          entry.name.startsWith(baseName + "-") &&
          (!bestBase || baseName.length > bestBase.length)
        ) {
          bestBase = baseName;
        }
      }
      // Fallback: match via species prefix (handles deoxys-attack → deoxys-normal, etc.)
      if (!bestBase) {
        for (const [speciesName, baseName] of Object.entries(speciesToBase)) {
          if (entry.name.startsWith(speciesName + "-")) {
            bestBase = baseName;
            break;
          }
        }
      }
      if (bestBase) {
        if (!map[bestBase]) map[bestBase] = [];
        map[bestBase].push(entry.name);
      }
    }
    return map;
  }, [allEntriesQuery.data, entries, detailsMap]);

  // Filter forms by the current game's generation using suffix heuristics
  const availableFormsMap = useMemo(() => {
    if (!generation) return formsMap;
    const result: Record<string, string[]> = {};
    for (const [baseName, forms] of Object.entries(formsMap)) {
      const available = forms.filter((formName) => {
        const suffix = formSuffix(formName, baseName);
        return getFormSuffixMinGen(suffix) <= generation;
      });
      if (available.length > 0) result[baseName] = available;
    }
    return result;
  }, [formsMap, generation]);

  // Collect form names currently needed (only expanded rows)
  const expandedFormNames = useMemo(() => {
    const names: string[] = [];
    for (const baseName of expandedRows) {
      names.push(...(availableFormsMap[baseName] ?? []));
    }
    return names;
  }, [expandedRows, availableFormsMap]);

  const formDetailsQuery = useFormDetails(expandedFormNames);
  const formDetailsMap = formDetailsQuery.data;

  const formDataQuery = usePokemonFormData(expandedFormNames);
  const formDataMap = formDataQuery.data;

  // Refs so expand column cells don't need to be in columns deps
  const expandedRowsRef = useRef(expandedRows);
  expandedRowsRef.current = expandedRows;
  const availableFormsMapRef = useRef(availableFormsMap);
  availableFormsMapRef.current = availableFormsMap;

  const DEFAULT_HIDDEN: VisibilityState = { height: false, weight: false, captureRate: false, eggGroups: false };
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      const saved = localStorage.getItem("porylist-col-vis");
      return saved ? { ...DEFAULT_HIDDEN, ...JSON.parse(saved) } : DEFAULT_HIDDEN;
    } catch {
      return DEFAULT_HIDDEN;
    }
  });

  useEffect(() => {
    localStorage.setItem("porylist-col-vis", JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [showLegendary, setShowLegendary] = useState(false);
  const [showMythical, setShowMythical] = useState(false);
  const [showBaby, setShowBaby] = useState(false);
  const [showMono, setShowMono] = useState(false);
  const [showNoEvolution, setShowNoEvolution] = useState(false);
  const [catchFilter, setCatchFilter] = useState<"all" | "caught" | "not-caught">("all");
  const [moveFilter, setMoveFilter] = useState("");
  const deferredMoveFilter = useDeferredValue(moveFilter);

  // Reset catch filter and exclusive version when game is deselected
  useEffect(() => {
    if (!game) setCatchFilter("all");
    setExclusiveVersion("");
  }, [game]);

  const toggleType = useCallback((t: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }, []);

  const captureRateVisible = columnVisibility["captureRate"] !== false;
  const eggGroupVisible = columnVisibility["eggGroups"] !== false;

  // Derive unique species names from detail data — entry names like "deoxys-normal"
  // don't map to valid species endpoints, but detail.species.name ("deoxys") does.
  const speciesNames = useMemo(
    () => detailsMap ? [...new Set(Object.values(detailsMap).map((d) => d.species.name))] : [],
    [detailsMap],
  );

  // Always prefetch species once main details are loaded — cached forever, so
  // legendary/mythical filters and species columns feel instant.
  const speciesQuery = useAllPokemonSpecies(speciesNames);
  const speciesMap = speciesQuery.data;

  const evolutionTargets = useMemo(() => {
    if (!speciesMap) return null;
    const targets = new Set<string>();
    for (const species of Object.values(speciesMap)) {
      if (species.evolves_from_species) targets.add(species.evolves_from_species.name);
    }
    return targets;
  }, [speciesMap]);

  const allMoveNames = useMemo(() => {
    if (!detailsMap) return [] as string[];
    const names = new Set<string>();
    for (const pkmn of Object.values(detailsMap)) {
      for (const m of pkmn.moves) names.add(m.move.name);
    }
    return [...names].sort();
  }, [detailsMap]);

  const allRows = useMemo<Row[]>(
    () =>
      entries.map((entry) => {
        const detail = detailsMap?.[entry.name];
        const speciesName = detail?.species.name ?? entry.name;
        const species = speciesMap?.[speciesName];
        const captureRate = captureRateVisible ? (species?.capture_rate ?? null) : null;
        const eggGroups = eggGroupVisible
          ? (species?.egg_groups.map((g) => g.name.replace(/-/g, " ")) ?? null)
          : null;
        const isLegendary = species != null ? species.is_legendary : null;
        const isMythical = species != null ? species.is_mythical : null;
        const isBaby = species != null ? species.is_baby : null;
        const isNoEvolution = species != null && evolutionTargets != null
          ? species.evolves_from_species === null && !evolutionTargets.has(speciesName)
          : null;
        return buildRow(entry, detail, !detail, spriteVersion, generation, captureRate, eggGroups, isLegendary, isMythical, isBaby, isNoEvolution);
      }),
    [entries, detailsMap, speciesMap, captureRateVisible, eggGroupVisible, spriteVersion, generation, evolutionTargets],
  );

  const data = useMemo<Row[]>(() => {
    const q = deferredSearch.trim().toLowerCase();
    let result = allRows;
    if (selectedGame) {
      result = result.filter((r) => r.id <= selectedGame.genMax);
    } else {
      result = result.filter((r) => r.id <= 1025);
    }
    if (q) {
      result = result.filter((r) =>
        r.name.replace(/-/g, " ").toLowerCase().includes(q),
      );
    }
    if (selectedTypes.size > 0) {
      result = result.filter((r) =>
        [...selectedTypes].every((t) => r.types.includes(t)),
      );
    }
    if ((showLegendary || showMythical || showBaby) && speciesMap != null) {
      result = result.filter((r) =>
        (showLegendary && r.isLegendary) || (showMythical && r.isMythical) || (showBaby && r.isBaby),
      );
    }
    if (showMono) {
      result = result.filter((r) => r.isLoading || r.isMono);
    }
    if (showNoEvolution && speciesMap != null && evolutionTargets != null) {
      result = result.filter((r) => r.isNoEvolution === true);
    }
    if (catchFilter !== "all" && game) {
      const caughtList = caught[game] ?? [];
      result = result.filter((r) =>
        catchFilter === "caught" ? caughtList.includes(r.name) : !caughtList.includes(r.name),
      );
    }
    if (deferredExclusiveVersion && game && versionExclusivesData?.[game]) {
      const versionEntry = versionExclusivesData[game].versions.find(
        (v) => v.key === deferredExclusiveVersion,
      );
      if (versionEntry) {
        const idSet = new Set(versionEntry.exclusiveIds);
        result = result.filter((r) => idSet.has(r.id));
      }
    }
    if (deferredMoveFilter.trim() && detailsMap) {
      const moveName = deferredMoveFilter.trim().toLowerCase().replace(/\s+/g, "-");
      result = result.filter((r) => {
        const detail = detailsMap[r.name];
        if (!detail) return false;
        return detail.moves.some((m) => {
          if (m.move.name !== moveName) return false;
          if (!selectedGame) return true;
          return m.version_group_details.some(
            (vgd) => VERSION_GROUP_TO_GEN[vgd.version_group.name] === selectedGame.generation,
          );
        });
      });
    }
    return result;
  }, [allRows, selectedGame, deferredSearch, selectedTypes, showLegendary, showMythical, showBaby, showMono, showNoEvolution, speciesMap, evolutionTargets, catchFilter, game, caught, deferredMoveFilter, detailsMap, deferredExclusiveVersion, versionExclusivesData]);


  const showRegional = false;
  const columns = useMemo<ColumnDef<Row, any>[]>(() => {
    const caughtCol = columnHelper.display({
      id: "caught",
      header: () => null,
      cell: ({ row }) => {
        if (row.original.isLoading || !game) return null;
        const isCaught = (caught[game] ?? []).includes(row.original.name);
        return (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCaught(row.original.name, game); }}
            className={cn(
              "flex items-center justify-center rounded-full p-1.5 transition-colors",
              isCaught ? "text-red-500 hover:text-red-400" : "text-muted-foreground/30 hover:text-muted-foreground",
            )}
            aria-label={isCaught ? `Mark ${row.original.name} as not caught` : `Mark ${row.original.name} as caught`}
            title={isCaught ? "Mark as not caught" : "Mark as caught"}
          >
            <PokeballIcon caught={isCaught} size={15} />
          </button>
        );
      },
    });

    const spriteColumn = columnHelper.accessor("sprite", {
      header: () => null,
      enableSorting: false,
      cell: ({ row }) => (
        <button
          className="flex h-14 w-14 items-center justify-center rounded hover:opacity-80 transition-opacity"
          onClick={() => openModalRef.current(row.original.name)}
          aria-label={`Open ${row.original.name} details`}
          tabIndex={-1}
        >
          {row.original.sprite ? (
            <img src={row.original.sprite} alt={row.original.name} loading="lazy" />
          ) : (
            <div className="h-10 w-10 animate-pulse rounded bg-muted" />
          )}
        </button>
      ),
    });

    const nameColumn = columnHelper.accessor("name", {
      header: ({ column }) => (
        <SortHeader label="Name" sorted={column.getIsSorted()} />
      ),
      cell: ({ getValue, row }) => {
        const name = row.original.name;
        const inTeam = team.includes(name);
        const full = team.length >= 6;
        const showBtn = teamBuilderOpen && !row.original.isLoading && (inTeam || !full);
        return (
          <div className="flex items-center gap-2">
            <button
              className="text-left font-medium hover:underline focus:outline-none"
              onClick={() => openModalRef.current(name)}
            >
              {formatPokemonName(getValue())}
            </button>
            {showBtn && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (inTeam) onRemoveFromTeam(name);
                  else onAddToTeam(name);
                }}
                className={cn(
                  "flex items-center justify-center rounded-full p-1.5 transition-colors",
                  inTeam
                    ? "text-primary hover:bg-destructive/10 hover:text-destructive"
                    : "text-muted-foreground/50 hover:bg-muted hover:text-foreground",
                )}
                aria-label={inTeam ? `Remove ${name} from team` : `Add ${name} to team`}
                title={inTeam ? "Remove from team" : "Add to team"}
              >
                {inTeam ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        );
      },
    });

    const expandCol = columnHelper.display({
      id: "expand",
      header: () => null,
      cell: ({ row }) => {
        const forms = availableFormsMapRef.current[row.original.name];
        if (!forms?.length) return null;
        const isExpanded = expandedRowsRef.current.has(row.original.name);
        const Icon = isExpanded ? ChevronDown : ChevronRight;
        return (
          <button
            onClick={() => toggleExpanded(row.original.name)}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
            aria-label={isExpanded ? "Collapse forms" : "Expand forms"}
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
          </button>
        );
      },
    });

    const idColumn = columnHelper.accessor("id", {
      id: "id",
      header: ({ column }) => (
        <SortHeader label="#" sorted={column.getIsSorted()} />
      ),
      cell: ({ getValue }) => {
        const id = getValue();
        const num =
          showRegional && selectedGame
            ? regionalNumber(id, selectedGame.nativeRanges)
            : id;
        return (
          <span className="font-mono text-sm text-muted-foreground">
            #{String(num).padStart(4, "0")}
          </span>
        );
      },
    });

    const statCols = isGen1
      ? [
          statColumn("hp", "HP"),
          statColumn("attack", "Atk"),
          statColumn("defense", "Def"),
          statColumn("specialAttack", "Spc"),
          statColumn("speed", "Spd"),
        ]
      : [
          statColumn("hp", "HP"),
          statColumn("attack", "Atk"),
          statColumn("defense", "Def"),
          statColumn("specialAttack", "Sp. Atk"),
          statColumn("specialDefense", "Sp. Def"),
          statColumn("speed", "Spd"),
        ];

    const bstCol = columnHelper.accessor(
      (row) =>
        isGen1
          ? row.hp + row.attack + row.defense + row.specialAttack + row.speed
          : row.hp +
            row.attack +
            row.defense +
            row.specialAttack +
            row.specialDefense +
            row.speed,
      {
        id: "bst",
        header: ({ column }) => (
          <SortHeader label="BST" sorted={column.getIsSorted()} />
        ),
        cell: ({ getValue, row }) => {
          if (row.original.isLoading) {
            return <div className="h-4 w-10 animate-pulse rounded bg-muted" />;
          }
          const v = getValue();
          return (
            <span className="font-mono tabular-nums text-sm font-semibold">
              {v > 0 ? v : "—"}
            </span>
          );
        },
      },
    );

    const heightCol = columnHelper.accessor("height", {
      id: "height",
      header: ({ column }) => <SortHeader label="Height" sorted={column.getIsSorted()} />,
      cell: ({ getValue, row }) => {
        if (row.original.isLoading) return <div className="h-4 w-10 animate-pulse rounded bg-muted" />;
        const v = getValue();
        if (v <= 0) return <span className="font-mono tabular-nums text-sm">—</span>;
        const totalIn = v * 3.93701;
        const ft = Math.floor(totalIn / 12);
        const inches = Math.round(totalIn % 12);
        return <span className="font-mono tabular-nums text-sm">{`${ft}'${String(inches).padStart(2, "0")}"`}</span>;
      },
    });

    const weightCol = columnHelper.accessor("weight", {
      id: "weight",
      header: ({ column }) => <SortHeader label="Weight" sorted={column.getIsSorted()} />,
      cell: ({ getValue, row }) => {
        if (row.original.isLoading) return <div className="h-4 w-12 animate-pulse rounded bg-muted" />;
        const v = getValue();
        if (v <= 0) return <span className="font-mono tabular-nums text-sm">—</span>;
        const lbs = (v * 0.220462).toFixed(1);
        return <span className="font-mono tabular-nums text-sm whitespace-nowrap">{`${lbs} lbs`}</span>;
      },
    });

    const captureRateCol = columnHelper.accessor("captureRate", {
      id: "captureRate",
      header: ({ column }) => <SortHeader label="Catch" sorted={column.getIsSorted()} />,
      cell: ({ getValue, row }) => {
        if (row.original.isLoading) return <div className="h-4 w-8 animate-pulse rounded bg-muted" />;
        const v = getValue();
        if (v === null) return <div className="h-4 w-8 animate-pulse rounded bg-muted" />;
        return <span className="font-mono tabular-nums text-sm">{v}</span>;
      },
    });

    const eggGroupsCol = columnHelper.accessor("eggGroups", {
      id: "eggGroups",
      enableSorting: false,
      header: () => <span className="select-none">Egg Group</span>,
      cell: ({ getValue, row }) => {
        if (row.original.isLoading) return <div className="h-4 w-20 animate-pulse rounded bg-muted" />;
        const v = getValue();
        if (v === null) return <div className="h-4 w-20 animate-pulse rounded bg-muted" />;
        return (
          <span className="text-sm capitalize">
            {v.map((g) => g.replace(/\b\w/g, (c) => c.toUpperCase())).join(", ")}
          </span>
        );
      },
    });

    return [
      expandCol,
      spriteColumn,
      ...(game ? [caughtCol] : []),
      idColumn,
      nameColumn,
      typesColumn,
      ...statCols,
      bstCol,
      heightCol,
      weightCol,
      captureRateCol,
      eggGroupsCol,
    ];
  }, [isGen1, showRegional, selectedGame, toggleExpanded, team, onAddToTeam, onRemoveFromTeam, teamBuilderOpen, game, caught, onToggleCaught]);

  const [sorting, setSorting] = useState<SortingState>([]);

  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!colsOpen) return;
    const handler = (e: MouseEvent) => {
      if (!colsRef.current?.contains(e.target as Node)) setColsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colsOpen]);

  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (!filterRef.current?.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  const activeFilterCount = selectedTypes.size + (showLegendary ? 1 : 0) + (showMythical ? 1 : 0) + (showBaby ? 1 : 0) + (showMono ? 1 : 0) + (showNoEvolution ? 1 : 0) + (catchFilter !== "all" ? 1 : 0) + (moveFilter.trim() ? 1 : 0) + (exclusiveVersion ? 1 : 0);

  const EXTRA_COLS = [
    { id: "height", label: "Height" },
    { id: "weight", label: "Weight" },
    { id: "captureRate", label: "Catch Rate" },
    { id: "eggGroups", label: "Egg Group" },
  ];

  const TOGGLEABLE_COLS = isGen1
    ? [
        { id: "hp", label: "HP" },
        { id: "attack", label: "Atk" },
        { id: "defense", label: "Def" },
        { id: "specialAttack", label: "Spc" },
        { id: "speed", label: "Spd" },
        { id: "bst", label: "BST" },
        ...EXTRA_COLS,
      ]
    : [
        { id: "hp", label: "HP" },
        { id: "attack", label: "Atk" },
        { id: "defense", label: "Def" },
        { id: "specialAttack", label: "Sp. Atk" },
        { id: "specialDefense", label: "Sp. Def" },
        { id: "speed", label: "Spd" },
        { id: "bst", label: "BST" },
        ...EXTRA_COLS,
      ];

  const gridTemplate = useMemo(() => {
    const statIds = isGen1
      ? ["hp", "attack", "defense", "specialAttack", "speed"]
      : ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"];
    const visibleStats = statIds.filter((id) => columnVisibility[id] !== false).length;
    const showBst = columnVisibility["bst"] !== false;
    const showHeight = columnVisibility["height"] !== false;
    const showWeight = columnVisibility["weight"] !== false;
    const showCaptureRate = columnVisibility["captureRate"] !== false;
    const showEggGroups = columnVisibility["eggGroups"] !== false;
    const statPart = visibleStats > 0 ? `${"92px ".repeat(visibleStats).trim()} ` : "";
    const extraParts = [
      showBst ? "76px" : "",
      showHeight ? "80px" : "",
      showWeight ? "112px" : "",
      showCaptureRate ? "70px" : "",
      showEggGroups ? "160px" : "",
    ].filter(Boolean).join(" ");
    const caughtPart = game ? "40px " : "";
    return `32px 72px ${caughtPart}80px minmax(150px, 1fr) 160px ${statPart}${extraParts}`.trim();
  }, [isGen1, columnVisibility, game]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const tableRows = table.getRowModel().rows;

  const displayRows = useMemo<DisplayRow[]>(() => {
    const result: DisplayRow[] = [];
    for (const row of tableRows) {
      result.push({ kind: "base", row });
      if (expandedRows.has(row.original.name)) {
        for (const formName of availableFormsMap[row.original.name] ?? []) {
          result.push({ kind: "variant", formName, parentName: row.original.name });
        }
      }
    }
    return result;
  }, [tableRows, expandedRows, availableFormsMap]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 81,
    overscan: 8,
  });

  if (list.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Loading Pokémon…
      </div>
    );
  }

  if (list.error) {
    return (
      <div className="flex items-center justify-center py-24 text-destructive">
        Failed to load Pokémon list.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Game selector */}
        <Select
          value={game}
          onChange={(e) => setGame(e.target.value)}
          className="min-w-[200px]"
        >
          <option value="">All Games</option>
          {GAMES.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </Select>

        {/* Search */}
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Pokémon…"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Search Pokémon"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Version exclusives toggle */}
        {game && versionExclusivesData?.[game] && (() => {
          const pair = versionExclusivesData[game].versions;
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">Exclusives:</span>
              <div className="flex rounded-md border overflow-hidden text-xs font-medium">
                <button
                  onClick={() => setExclusiveVersion("")}
                  className={cn(
                    "px-2.5 py-1 transition-colors",
                    exclusiveVersion === "" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  All
                </button>
                {pair.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setExclusiveVersion(exclusiveVersion === v.key ? "" : v.key)}
                    className={cn(
                      "px-2.5 py-1 border-l transition-colors",
                      exclusiveVersion === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
        <div className="relative ml-auto flex items-center gap-2">
          <div className="relative" ref={filterRef}>
          <button
            onClick={() => setFilterOpen((o) => !o)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
              filterOpen || activeFilterCount > 0 ? "bg-muted" : "bg-background",
            )}
          >
            <ListFilter className="h-3.5 w-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>
          {filterOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border bg-background p-3 shadow-lg">
              {/* Learns Move */}
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Learns Move</p>
              <div className="relative mb-3">
                <input
                  type="text"
                  list="move-datalist"
                  value={moveFilter}
                  onChange={(e) => setMoveFilter(e.target.value)}
                  placeholder={selectedGame ? `e.g. Surf (${selectedGame.label})` : "e.g. Surf (any game)"}
                  className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {moveFilter && (
                  <button
                    onClick={() => setMoveFilter("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <datalist id="move-datalist">
                  {allMoveNames.map((n) => (
                    <option key={n} value={n.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} />
                  ))}
                </datalist>
              </div>
              {/* Caught Status — only when a game is selected */}
              {game && (
                <>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Caught</p>
                  <div className="mb-3 flex gap-1">
                    {(["all", "caught", "not-caught"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setCatchFilter(v)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs transition-colors",
                          catchFilter === v
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {v === "all" ? "All" : v === "caught" ? "Caught" : "Not Caught"}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</p>
              <div className="mb-3 space-y-1.5">
                {[
                    { label: "Legendary", checked: showLegendary, onChange: () => setShowLegendary((v) => !v) },
                    { label: "Mythical", checked: showMythical, onChange: () => setShowMythical((v) => !v) },
                    { label: "Baby", checked: showBaby, onChange: () => setShowBaby((v) => !v) },
                    { label: "Mono-type", checked: showMono, onChange: () => setShowMono((v) => !v) },
                    { label: "No Evolution", checked: showNoEvolution, onChange: () => setShowNoEvolution((v) => !v) },
                  ].map(({ label, checked, onChange }) => (
                  <label key={label} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={onChange}
                      className="h-3.5 w-3.5 rounded accent-primary"
                    />
                    <span className={checked ? "font-medium text-foreground" : "text-muted-foreground"}>
                      {label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</p>
                {selectedTypes.size > 0 && (
                  <button
                    onClick={() => setSelectedTypes(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className={cn(
                      "rounded border-0 px-2.5 py-0.5 text-xs font-semibold capitalize transition-opacity",
                      selectedTypes.has(t) ? "opacity-100 ring-2 ring-white/40 ring-offset-1 ring-offset-background" : "opacity-40 hover:opacity-70",
                    )}
                    style={typeStyle(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative" ref={colsRef}>
          <button
            onClick={() => setColsOpen((o) => !o)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
              colsOpen ? "bg-muted" : "bg-background",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Columns
          </button>
          {colsOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border bg-background p-2 shadow-lg">
              {TOGGLEABLE_COLS.map((col) => {
                const visible = table.getColumn(col.id)?.getIsVisible() ?? true;
                return (
                  <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(e) => table.getColumn(col.id)?.toggleVisibility(e.target.checked)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    {col.label}
                  </label>
                );
              })}
            </div>
          )}
        </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden rounded-md border">
        <div
          ref={scrollRef}
          className="h-full overflow-auto"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(max-content, 1fr)",
            }}
          >
          <div
            className="sticky top-0 z-10 grid border-b bg-background text-sm font-medium text-muted-foreground"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {table.getHeaderGroups()[0].headers.map((header) => {
              const canSort = header.column.getCanSort();
              return (
                <div
                  key={header.id}
                  onClick={
                    canSort
                      ? header.column.getToggleSortingHandler()
                      : undefined
                  }
                  className={cn(
                    "flex h-12 items-center px-3",
                    canSort && "cursor-pointer hover:text-foreground",
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </div>
              );
            })}
          </div>
          {displayRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
              <p className="text-base font-medium">No Pokémon found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters or search.</p>
            </div>
          ) : (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const dRow = displayRows[vRow.index];

              if (dRow.kind === "base") {
                const row = dRow.row;
                return (
                  <div
                    key={row.id}
                    className="absolute left-0 top-0 grid w-full border-b bg-background transition-colors hover:bg-muted/50"
                    style={{
                      gridTemplateColumns: gridTemplate,
                      transform: `translateY(${vRow.start}px)`,
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div
                        key={cell.id}
                        className="flex items-center px-3 py-3 text-sm"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </div>
                    ))}
                  </div>
                );
              }

              // Variant row
              const { formName } = dRow;
              const detail = formDetailsMap?.[formName];
              const isLoadingDetail = !detail;
              const types = detail ? typesForGeneration(detail, generation) : [];
              const hp = statByName(detail, "hp");
              const atk = statByName(detail, "attack");
              const def = statByName(detail, "defense");
              const spa = statByName(detail, "special-attack");
              const spdef = statByName(detail, "special-defense");
              const spe = statByName(detail, "speed");
              const bst = isGen1
                ? hp + atk + def + spa + spe
                : hp + atk + def + spa + spdef + spe;
              const allStatIds = isGen1
                ? ["hp", "attack", "defense", "specialAttack", "speed"]
                : ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"];
              const allStatValues = isGen1
                ? [hp, atk, def, spa, spe]
                : [hp, atk, def, spa, spdef, spe];
              const visibleStats = allStatIds
                .map((id, i) => ({ id, val: allStatValues[i] }))
                .filter(({ id }) => columnVisibility[id] !== false);
              const name = canonicalFormName(formName, formDataMap);
              const formSprite = detail
                ? spriteUrl(detail.id, undefined)
                : null;

              // Filter by exact version_group gen if we have the form data
              const formMeta = formDataMap?.[formName];
              if (formMeta && generation) {
                const formGen = formMeta.version_group
                  ? (VERSION_GROUP_TO_GEN[formMeta.version_group.name] ?? 1)
                  : 1;
                if (formGen > generation) return null;
              }

              return (
                <div
                  key={`variant-${formName}`}
                  className="absolute left-0 top-0 grid w-full border-b bg-background"
                  style={{
                    gridTemplateColumns: gridTemplate,
                    transform: `translateY(${vRow.start}px)`,
                  }}
                >
                  {/* expand: empty */}
                  <div className="flex items-center px-3 py-3" />
                  {/* sprite */}
                  <div className="flex items-center px-3 py-3">
                    <div className="flex h-14 w-14 items-center justify-center">
                      {formSprite ? (
                        <img
                          src={formSprite}
                          alt={name}
                          loading="lazy"
                          className="max-h-full w-auto"
                          onError={(e) => {
                            const img = e.currentTarget;
                            img.onerror = null;
                            img.src = `https://sprites.porylist.com/sprites/pokemon/${detail!.id}.png`;
                          }}
                        />
                      ) : (
                        <div className="h-10 w-10 animate-pulse rounded bg-muted" />
                      )}
                    </div>
                  </div>
                  {/* caught: empty for variant rows */}
                  {game && <div className="flex items-center px-3 py-3" />}
                  {/* id: empty */}
                  <div className="flex items-center px-3 py-3" />
                  {/* name */}
                  <div className="flex items-center px-3 py-3 text-sm">
                    {isLoadingDetail ? (
                      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    ) : (
                      <button
                        className="text-left font-medium text-muted-foreground hover:underline focus:outline-none"
                        onClick={() => openModal(formName)}
                      >
                        {name}
                      </button>
                    )}
                  </div>
                  {/* types */}
                  <div className="flex items-center px-3 py-3 text-sm">
                    {isLoadingDetail ? (
                      <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {types.map((t) => (
                          <Badge
                            key={t}
                            variant="default"
                            className="capitalize !rounded !px-1.5"
                            style={typeStyle(t)}
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* stats */}
                  {visibleStats.map(({ id, val }) => (
                    <div key={id} className="flex items-center px-3 py-3 text-sm">
                      {isLoadingDetail ? (
                        <div className="h-4 w-8 animate-pulse rounded bg-muted" />
                      ) : (
                        <span className="font-mono tabular-nums text-sm">
                          {val > 0 ? val : "—"}
                        </span>
                      )}
                    </div>
                  ))}
                  {/* bst */}
                  {columnVisibility["bst"] !== false && (
                    <div className="flex items-center px-3 py-3 text-sm">
                      {isLoadingDetail ? (
                        <div className="h-4 w-10 animate-pulse rounded bg-muted" />
                      ) : (
                        <span className="font-mono tabular-nums text-sm font-semibold">
                          {bst > 0 ? bst : "—"}
                        </span>
                      )}
                    </div>
                  )}
                  {/* height */}
                  {columnVisibility["height"] !== false && (
                    <div className="flex items-center px-3 py-3 text-sm">
                      {isLoadingDetail ? (
                        <div className="h-4 w-10 animate-pulse rounded bg-muted" />
                      ) : (() => {
                        const v = detail?.height ?? 0;
                        if (v <= 0) return <span className="font-mono tabular-nums text-sm">—</span>;
                        const totalIn = v * 3.93701;
                        const ft = Math.floor(totalIn / 12);
                        const inches = Math.round(totalIn % 12);
                        return <span className="font-mono tabular-nums text-sm">{`${ft}'${String(inches).padStart(2, "0")}"`}</span>;
                      })()}
                    </div>
                  )}
                  {/* weight */}
                  {columnVisibility["weight"] !== false && (
                    <div className="flex items-center px-3 py-3 text-sm">
                      {isLoadingDetail ? (
                        <div className="h-4 w-10 animate-pulse rounded bg-muted" />
                      ) : (() => {
                        const v = detail?.weight ?? 0;
                        if (v <= 0) return <span className="font-mono tabular-nums text-sm">—</span>;
                        return <span className="font-mono tabular-nums text-sm">{`${(v * 0.220462).toFixed(1)} lbs`}</span>;
                      })()}
                    </div>
                  )}
                  {/* catch rate: not available for forms, show dash */}
                  {columnVisibility["captureRate"] !== false && (
                    <div className="flex items-center px-3 py-3 text-sm">
                      <span className="font-mono tabular-nums text-sm">—</span>
                    </div>
                  )}
                  {/* egg groups: not available for forms, show dash */}
                  {columnVisibility["eggGroups"] !== false && (
                    <div className="flex items-center px-3 py-3 text-sm">
                      <span className="text-sm">—</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{tableRows.length.toLocaleString()} result{tableRows.length === 1 ? "" : "s"}</span>
        <span />
      </div>

      {selectedPokemon && (() => {
        const idx = tableRows.findIndex((r) => r.original.name === selectedPokemon);
        const prevRow = idx > 0 ? tableRows[idx - 1].original : null;
        const nextRow = idx < tableRows.length - 1 ? tableRows[idx + 1].original : null;
        return (
          <PokemonModal
            pokemonName={selectedPokemon}
            game={selectedGame}
            onClose={closeModal}
            onNavigate={openModal}
            prevPokemon={prevRow ? { name: prevRow.name, id: prevRow.id } : null}
            nextPokemon={nextRow ? { name: nextRow.name, id: nextRow.id } : null}
            caughtInGame={game ? (caught[game] ?? []).includes(selectedPokemon) : false}
            onToggleCaught={game ? () => onToggleCaught(selectedPokemon, game) : undefined}
            onOpenInCatchTracker={onOpenInCatchTracker}
          />
        );
      })()}
    </div>
  );
}
