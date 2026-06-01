import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from "lucide-react";
import { TYPE_COLORS } from "@/lib/types";
import { useMoveList, type MoveListEntry } from "@/lib/pokeapi";
import { type GameOption } from "@/lib/games";
import { MoveModal } from "@/components/MoveModal";
import { Select } from "@/components/ui/select";
import { GameFilter } from "@/components/GameFilter";

// ── Category badge ─────────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, { bg: string; label: string }> = {
  physical: { bg: "#C92112", label: "Physical" },
  special:  { bg: "#4F5870", label: "Special"  },
  status:   { bg: "#8C888C", label: "Status"   },
};

function CategoryBadge({ category }: { category: string }) {
  const s = CATEGORY_STYLE[category];
  if (!s) return <span className="text-xs capitalize text-muted-foreground">{category}</span>;
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: s.bg }}
    >
      {s.label}
    </span>
  );
}

// ── Type badge ─────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-xs font-medium capitalize text-white"
      style={{ backgroundColor: TYPE_COLORS[type] ?? "#A8A8A8" }}
    >
      {type}
    </span>
  );
}

// ── Sortable column header ─────────────────────────────────────────────────────

type SortKey = "id" | "displayName" | "type" | "category" | "power" | "accuracy" | "pp";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MovesTable({ game: selectedGame }: { game: GameOption | null }) {
  const { data: moves, isLoading } = useMoveList();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<MoveListEntry | null>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const types = useMemo(() => {
    if (!moves) return [];
    return [...new Set(moves.map((m) => m.type))].sort();
  }, [moves]);

  const filtered = useMemo(() => {
    if (!moves) return [];
    const q = search.trim().toLowerCase();
    return moves.filter((m) => {
      if (selectedGame && m.generationId > selectedGame.generation) return false;
      if (q && !m.displayName.toLowerCase().includes(q)) return false;
      if (typeFilter && m.type !== typeFilter) return false;
      if (categoryFilter && m.category !== categoryFilter) return false;
      return true;
    });
  }, [moves, selectedGame, search, typeFilter, categoryFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "id":          return dir * (a.id - b.id);
        case "displayName": return dir * a.displayName.localeCompare(b.displayName);
        case "type":        return dir * a.type.localeCompare(b.type);
        case "category":    return dir * a.category.localeCompare(b.category);
        case "power":       return dir * ((a.power ?? -1) - (b.power ?? -1));
        case "accuracy":    return dir * ((a.accuracy ?? -1) - (b.accuracy ?? -1));
        case "pp":          return dir * ((a.pp ?? -1) - (b.pp ?? -1));
        default: return 0;
      }
    });
  }, [filtered, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading moves…
      </div>
    );
  }

  const Th = ({ col, label, right, className }: { col: SortKey; label: string; right?: boolean; className?: string }) => (
    <th
      className={`pb-2 pr-4 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground whitespace-nowrap ${right ? "text-right" : "text-left"} ${className ?? ""}`}
      onClick={() => handleSort(col)}
    >
      <span className={`flex items-center gap-1 ${right ? "justify-end" : ""}`}>
        {label}
        <SortIcon active={sortKey === col} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-6">
      <div className="shrink-0 flex items-center gap-3 border-b border-border py-3 -mx-6 px-6">
        <h1 className="flex-1 font-display text-xl font-extrabold">Moves</h1>
        <GameFilter />
      </div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 pt-2">

        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search moves…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </Select>

        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          <option value="physical">Physical</option>
          <option value="special">Special</option>
          <option value="status">Status</option>
        </Select>
      </div>


      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b">
              <Th col="id" label="#" className="hidden sm:table-cell" />
              <Th col="displayName" label="Name" />
              <Th col="type" label="Type" />
              <Th col="category" label="Cat." />
              <Th col="power" label="Power" right className="hidden sm:table-cell" />
              <Th col="accuracy" label="Acc." right className="hidden sm:table-cell" />
              <Th col="pp" label="PP" right className="hidden sm:table-cell" />
              <th className="hidden md:table-cell pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">
                Effect
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {sorted.map((move) => (
              <tr
                key={move.id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => setSelected(move)}
              >
                <td className="hidden sm:table-cell py-1.5 pr-4 tabular-nums text-muted-foreground">{move.id}</td>
                <td className="py-1.5 pr-4 font-medium text-primary whitespace-nowrap">
                  {move.displayName}
                </td>
                <td className="py-1.5 pr-4"><TypeBadge type={move.type} /></td>
                <td className="py-1.5 pr-4"><CategoryBadge category={move.category} /></td>
                <td className="hidden sm:table-cell py-1.5 pr-4 text-right tabular-nums">
                  {move.power ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="hidden sm:table-cell py-1.5 pr-4 text-right tabular-nums">
                  {move.accuracy != null
                    ? `${move.accuracy}%`
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="hidden sm:table-cell py-1.5 pr-4 text-right tabular-nums">
                  {move.pp ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="hidden md:table-cell max-w-xs py-1.5 pr-4 text-muted-foreground">
                  <span className="line-clamp-1">{move.shortEffect}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <MoveModal
          name={selected.name}
          entry={selected}
          game={selectedGame}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
