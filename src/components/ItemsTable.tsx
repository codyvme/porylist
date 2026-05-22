import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from "lucide-react";
import { useItemList, type ItemListEntry } from "@/lib/pokeapi";
import { GAMES, type GameOption } from "@/lib/games";
import { Select } from "@/components/ui/select";
import { ItemModal } from "@/components/ItemModal";
import { cn } from "@/lib/utils";

const SPRITES_BASE = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items";

type SortKey = "id" | "displayName" | "category" | "cost";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

function ItemSprite({ name }: { name: string }) {
  return (
    <img
      src={`${SPRITES_BASE}/${name}.png`}
      alt={name}
      className="h-8 w-8 object-contain"
      onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0"; }}
    />
  );
}

function formatCost(cost: number): string {
  if (cost === 0) return "—";
  return `₽${cost.toLocaleString()}`;
}

export function ItemsTable() {
  const { data: items, isLoading } = useItemList();

  const [selectedGame, setSelectedGame] = useState<GameOption | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<ItemListEntry | null>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  // PokéAPI only tracks items from Gen III onward.
  // Gen 1/2 items are bucketed into Gen 3 in our data, so we
  // treat any game earlier than Gen 3 as Gen 3 for filtering purposes.
  const effectiveGeneration = selectedGame ? Math.max(selectedGame.generation, 3) : null;

  // Build sorted unique category list from the full unfiltered set
  const categories = useMemo(() => {
    if (!items) return [];
    const seen = new Map<string, string>();
    for (const item of items) {
      if (!seen.has(item.category)) seen.set(item.category, item.categoryDisplay);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (effectiveGeneration !== null && item.generationId > effectiveGeneration) return false;
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (q && !item.displayName.toLowerCase().includes(q) && !item.shortEffect.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, effectiveGeneration, categoryFilter, search]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "displayName": return dir * a.displayName.localeCompare(b.displayName);
        case "category":    return dir * a.categoryDisplay.localeCompare(b.categoryDisplay) || (a.id - b.id);
        case "cost":        return dir * (a.cost - b.cost) || (a.id - b.id);
        default:            return dir * (a.id - b.id);
      }
    });
  }, [filtered, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading items…
      </div>
    );
  }

  const Th = ({ col, label, className }: { col: SortKey; label: string; className?: string }) => (
    <th
      className={cn(
        "pb-2 pr-4 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground whitespace-nowrap",
        className,
      )}
      onClick={() => handleSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === col} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-8">
      <h1 className="shrink-0 text-xl font-semibold border-b border-border py-3 -mx-8 px-8">Items</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={selectedGame?.value ?? ""}
          onChange={(e) => {
            const g = GAMES.find((g) => g.value === e.target.value) ?? null;
            setSelectedGame(g);
          }}
          className="w-full sm:w-auto"
        >
          <option value="">All Games</option>
          {GAMES.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </Select>

        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full sm:w-auto"
        >
          <option value="">All Categories</option>
          {categories.map(([slug, label]) => (
            <option key={slug} value={slug}>{label}</option>
          ))}
        </Select>

        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search items or effects…"
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
      </div>

      {/* Early-game caveat */}
      {selectedGame && selectedGame.generation < 3 && (
        <p className="text-xs text-muted-foreground">
          Item data is only tracked from Generation III onward — showing all items available by that generation.
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        {sorted.length.toLocaleString()} item{sorted.length !== 1 ? "s" : ""}
        {selectedGame ? ` in ${selectedGame.label}` : ""}
        {categoryFilter ? ` · ${categories.find(([s]) => s === categoryFilter)?.[1] ?? categoryFilter}` : ""}
      </p>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b">
              <th className="pb-2 pr-3 w-10" />
              <Th col="id" label="#" className="hidden sm:table-cell" />
              <Th col="displayName" label="Name" />
              <Th col="category" label="Category" />
              <th className="hidden md:table-cell pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">
                Effect
              </th>
              <Th col="cost" label="Buy Price" className="hidden sm:table-cell text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {sorted.map((item) => (
              <tr
                key={item.id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => setSelected(item)}
              >
                <td className="py-1 pr-3">
                  <ItemSprite name={item.name} />
                </td>
                <td className="hidden sm:table-cell py-1.5 pr-4 tabular-nums text-muted-foreground">{item.id}</td>
                <td className="py-1.5 pr-4 font-medium text-primary whitespace-nowrap">
                  {item.displayName}
                </td>
                <td className="py-1.5 pr-4 whitespace-nowrap">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {item.categoryDisplay}
                  </span>
                </td>
                <td className="hidden md:table-cell py-1.5 pr-4 text-muted-foreground">
                  <span className="line-clamp-1">{item.shortEffect}</span>
                </td>
                <td className="hidden sm:table-cell py-1.5 pr-4 tabular-nums text-muted-foreground text-right whitespace-nowrap">
                  {formatCost(item.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <ItemModal item={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
