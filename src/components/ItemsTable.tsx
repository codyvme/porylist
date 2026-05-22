import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from "lucide-react";
import { useItemList, type ItemListEntry } from "@/lib/pokeapi";
import { Select } from "@/components/ui/select";
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

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<ItemListEntry | null>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  // Build sorted unique category list
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
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (q && !item.displayName.toLowerCase().includes(q) && !item.shortEffect.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, categoryFilter, search]);

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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <h1 className="shrink-0 text-xl font-semibold">Items</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
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

      <p className="text-sm text-muted-foreground">
        {sorted.length.toLocaleString()} item{sorted.length !== 1 ? "s" : ""}
        {categoryFilter ? ` in ${categories.find(([s]) => s === categoryFilter)?.[1] ?? categoryFilter}` : ""}
      </p>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b">
              <th className="pb-2 pr-3 w-10" />
              <Th col="id" label="#" />
              <Th col="displayName" label="Name" />
              <Th col="category" label="Category" />
              <th className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">
                Effect
              </th>
              <Th col="cost" label="Buy Price" className="text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {sorted.map((item) => (
              <tr
                key={item.id}
                className={cn(
                  "cursor-pointer hover:bg-muted/40",
                  selected?.id === item.id && "bg-muted/40",
                )}
                onClick={() => setSelected(selected?.id === item.id ? null : item)}
              >
                <td className="py-1 pr-3">
                  <ItemSprite name={item.name} />
                </td>
                <td className="py-1.5 pr-4 tabular-nums text-muted-foreground">{item.id}</td>
                <td className="py-1.5 pr-4 font-medium text-primary whitespace-nowrap">
                  {item.displayName}
                </td>
                <td className="py-1.5 pr-4 whitespace-nowrap">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {item.categoryDisplay}
                  </span>
                </td>
                <td className="py-1.5 pr-4 text-muted-foreground">
                  <span className="line-clamp-1">{item.shortEffect}</span>
                </td>
                <td className="py-1.5 pr-4 tabular-nums text-muted-foreground text-right whitespace-nowrap">
                  {formatCost(item.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inline detail panel — expands below selected row's effect */}
      {selected && (
        <div className="shrink-0 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start gap-4">
            <ItemSprite name={selected.name} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{selected.displayName}</span>
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {selected.categoryDisplay}
                </span>
                {selected.cost > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Buy: {formatCost(selected.cost)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected.shortEffect || "No description available."}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
