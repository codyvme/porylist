import { useMemo, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from "lucide-react";
import { useAbilityList, type AbilityListEntry } from "@/lib/pokeapi";
import { type GameOption } from "@/lib/games";
import { AbilityModal } from "@/components/AbilityModal";
import { useSearchParams } from "react-router-dom";
import { GameFilter } from "@/components/GameFilter";

type SortKey = "id" | "displayName";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

export function AbilitiesTable({ game: selectedGame }: { game: GameOption | null }) {
  const { data: abilities, isLoading } = useAbilityList();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedAbilityName = searchParams.get("ability");
  const selected = abilities?.find((a) => a.name === selectedAbilityName) ?? null;

  const openAbility = useCallback((ability: AbilityListEntry) => {
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set("ability", ability.name); return next; });
  }, [setSearchParams]);

  const closeAbility = useCallback(() => {
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("ability"); return next; });
  }, [setSearchParams]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  // Abilities don't exist in Gen 1 or 2
  const noAbilitiesInGame = selectedGame != null && selectedGame.generation < 3;

  const filtered = useMemo(() => {
    if (!abilities || noAbilitiesInGame) return [];
    const q = search.trim().toLowerCase();
    return abilities.filter((a) => {
      if (selectedGame && a.generationId > selectedGame.generation) return false;
      if (q && !a.displayName.toLowerCase().includes(q) && !a.shortEffect.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [abilities, selectedGame, noAbilitiesInGame, search]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) =>
      sortKey === "displayName"
        ? dir * a.displayName.localeCompare(b.displayName)
        : dir * (a.id - b.id),
    );
  }, [filtered, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading abilities…
      </div>
    );
  }

  const Th = ({ col, label, className }: { col: SortKey; label: string; className?: string }) => (
    <th
      className={`pb-2 pr-4 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground whitespace-nowrap ${className ?? ""}`}
      onClick={() => handleSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === col} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-6">
      <div className="shrink-0 flex items-center gap-3 border-b border-border py-3 -mx-6 px-6">
        <h1 className="flex-1 text-xl font-semibold">Abilities</h1>
        <GameFilter />
      </div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 pt-2">

        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search abilities or effects…"
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

      {noAbilitiesInGame ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-center text-sm text-muted-foreground">
            Abilities were introduced in Generation III (Ruby/Sapphire).<br />
            Select a later game to browse abilities.
          </p>
        </div>
      ) : (
        <>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <Th col="id" label="#" className="hidden sm:table-cell" />
                  <Th col="displayName" label="Name" />
                  <th className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sorted.map((ability) => (
                  <tr
                    key={ability.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => openAbility(ability)}
                  >
                    <td className="hidden sm:table-cell py-1.5 pr-4 tabular-nums text-muted-foreground">{ability.id}</td>
                    <td className="py-1.5 pr-4 font-medium text-primary whitespace-nowrap">
                      {ability.displayName}
                    </td>
                    <td className="py-1.5 pr-4 text-muted-foreground">
                      <span className="line-clamp-1">{ability.shortEffect}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && (
        <AbilityModal
          name={selected.name}
          entry={selected}
          game={selectedGame}
          onClose={closeAbility}
        />
      )}
    </div>
  );
}
