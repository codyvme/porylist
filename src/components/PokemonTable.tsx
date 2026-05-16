import { useDeferredValue, useMemo, useRef, useState, useCallback } from "react";
import { PokemonModal } from "@/components/PokemonModal";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type Row as TableRow,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  extractIdFromUrl,
  typesForGeneration,
  useAllPokemonDetails,
  useAllPokemonEntries,
  useFormDetails,
  usePokemonFormData,
  usePokemonList,
  VERSION_GROUP_TO_GEN,
  type Pokemon,
  type PokemonFormDataMap,
  type PokemonListEntry,
} from "@/lib/pokeapi";
import {
  GAMES,
  GAMES_BY_VALUE,
  isInRanges,
  regionalNumber,
  spriteUrl,
} from "@/lib/games";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { typeStyle } from "@/lib/types";
import { cn } from "@/lib/utils";

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

const spriteColumn = columnHelper.accessor("sprite", {
  header: () => null,
  enableSorting: false,
  cell: ({ row }) => (
    <div className="flex h-14 w-14 items-center justify-center">
      {row.original.sprite ? (
        <img
          src={row.original.sprite}
          alt={row.original.name}
          className=""
          loading="lazy"
        />
      ) : (
        <div className="h-10 w-10 animate-pulse rounded bg-muted" />
      )}
    </div>
  ),
});

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
            className="capitalize"
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
  };
}

export function PokemonTable() {
  const list = usePokemonList();
  const entries = list.data?.results ?? [];

  const detailsQuery = useAllPokemonDetails(entries.map((e) => e.name));
  const detailsMap = detailsQuery.data;

  const allEntriesQuery = useAllPokemonEntries();

  const [game, setGame] = useState<string>("");
  const [showNational, setShowNational] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const deferredGame = useDeferredValue(game);
  const deferredShowNational = useDeferredValue(showNational);
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

  const [selectedPokemon, setSelectedPokemon] = useState<string | null>(null);
  const openModal = useCallback((name: string) => setSelectedPokemon(name), []);
  const closeModal = useCallback(() => setSelectedPokemon(null), []);
  const openModalRef = useRef(openModal);
  openModalRef.current = openModal;

  // Build a map from base pokemon name → alternate form names
  const formsMap = useMemo(() => {
    if (!allEntriesQuery.data || !entries.length) return {} as Record<string, string[]>;
    const baseNames = entries.map((e) => e.name);
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
      if (bestBase) {
        if (!map[bestBase]) map[bestBase] = [];
        map[bestBase].push(entry.name);
      }
    }
    return map;
  }, [allEntriesQuery.data, entries]);

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

  const allRows = useMemo<Row[]>(
    () =>
      entries.map((entry) => {
        const detail = detailsMap?.[entry.name];
        return buildRow(entry, detail, !detail, spriteVersion, generation);
      }),
    [entries, detailsMap, spriteVersion, generation],
  );

  const data = useMemo<Row[]>(() => {
    const q = deferredSearch.trim().toLowerCase();
    let result = allRows;
    if (selectedGame) {
      result = deferredShowNational
        ? result.filter((r) => r.id <= selectedGame.genMax)
        : result.filter((r) => isInRanges(r.id, selectedGame.nativeRanges));
    }
    if (q) {
      result = result.filter((r) =>
        r.name.replace(/-/g, " ").toLowerCase().includes(q),
      );
    }
    return result;
  }, [allRows, selectedGame, deferredShowNational, deferredSearch]);

  const showRegional = !!selectedGame && !deferredShowNational;
  const columns = useMemo<ColumnDef<Row, any>[]>(() => {
    const nameColumn = columnHelper.accessor("name", {
      header: ({ column }) => (
        <SortHeader label="Name" sorted={column.getIsSorted()} />
      ),
      cell: ({ getValue, row }) => (
        <button
          className="text-left font-medium capitalize hover:underline focus:outline-none"
          onClick={() => openModalRef.current(row.original.name)}
        >
          {getValue().replace(/-/g, " ")}
        </button>
      ),
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

    return [
      expandCol,
      spriteColumn,
      idColumn,
      nameColumn,
      typesColumn,
      ...statCols,
      bstCol,
    ];
  }, [isGen1, showRegional, selectedGame, toggleExpanded]);

  const gridTemplate = useMemo(() => {
    const statColCount = isGen1 ? 5 : 6;
    return `32px 72px 80px minmax(150px, 1fr) minmax(180px, 1.2fr) ${"92px ".repeat(
      statColCount,
    ).trim()} 76px`;
  }, [isGen1]);

  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-9"
            aria-label="Search Pokémon"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">
            Game
          </label>
          <Select
            value={game}
            onChange={(e) => setGame(e.target.value)}
            className="min-w-[260px]"
          >
            <option value="">All games</option>
            {GAMES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
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
      </div>
      <div className="overflow-hidden rounded-md border">
        <div
          ref={scrollRef}
          className="overflow-auto"
          style={{ height: "calc(100vh - 260px)" }}
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
                    className="absolute left-0 top-0 grid w-full border-b transition-colors hover:bg-muted/50"
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
              const statValues = isGen1
                ? [hp, atk, def, spa, spe]
                : [hp, atk, def, spa, spdef, spe];
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
                  className="absolute left-0 top-0 grid w-full border-b bg-muted/20"
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
                        <img src={formSprite} alt={name} loading="lazy" className="max-h-full w-auto" />
                      ) : (
                        <div className="h-10 w-10 animate-pulse rounded bg-muted" />
                      )}
                    </div>
                  </div>
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
                            className="capitalize"
                            style={typeStyle(t)}
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* stats */}
                  {statValues.map((val, i) => (
                    <div key={i} className="flex items-center px-3 py-3 text-sm">
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
                  <div className="flex items-center px-3 py-3 text-sm">
                    {isLoadingDetail ? (
                      <div className="h-4 w-10 animate-pulse rounded bg-muted" />
                    ) : (
                      <span className="font-mono tabular-nums text-sm font-semibold">
                        {bst > 0 ? bst : "—"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        {tableRows.length.toLocaleString()} result{tableRows.length === 1 ? "" : "s"}
      </div>

      {selectedPokemon && (
        <PokemonModal
          pokemonName={selectedPokemon}
          game={selectedGame}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
