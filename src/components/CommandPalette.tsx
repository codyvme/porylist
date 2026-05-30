import { useEffect, useMemo, useRef, useState } from "react";
import { Search, List, Swords, Sparkles, Backpack } from "lucide-react";
import {
  usePokemonSummaryList,
  useMoveList,
  useAbilityList,
  useItemList,
  type PokemonSummary,
  type MoveListEntry,
  type AbilityListEntry,
  type ItemListEntry,
} from "@/lib/pokeapi";
import { spriteUrl, type GameOption } from "@/lib/games";
import { formatPokemonName, cn } from "@/lib/utils";
import { PokemonModal } from "@/components/PokemonModal";
import { MoveModal } from "@/components/MoveModal";
import { AbilityModal } from "@/components/AbilityModal";
import { ItemModal } from "@/components/ItemModal";

const ITEM_SPRITES = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items";
const MAX_RESULTS = 30;

type ResultKind = "pokemon" | "move" | "ability" | "item";

type Result =
  | { kind: "pokemon"; key: string; label: string; sub: string; sortScore: number; data: PokemonSummary }
  | { kind: "move"; key: string; label: string; sub: string; sortScore: number; data: MoveListEntry }
  | { kind: "ability"; key: string; label: string; sub: string; sortScore: number; data: AbilityListEntry }
  | { kind: "item"; key: string; label: string; sub: string; sortScore: number; data: ItemListEntry };

const KIND_META: Record<ResultKind, { label: string; Icon: React.ElementType }> = {
  pokemon: { label: "Pokémon", Icon: List },
  move:    { label: "Move",    Icon: Swords },
  ability: { label: "Ability", Icon: Sparkles },
  item:    { label: "Item",    Icon: Backpack },
};

function score(name: string, displayName: string, q: string): number {
  // Lower is better; -1 means no match
  if (!q) return 0;
  const n = name.toLowerCase();
  const d = displayName.toLowerCase();
  if (n === q || d === q) return 0;
  if (n.startsWith(q) || d.startsWith(q)) return 1;
  const ni = n.indexOf(q);
  const di = d.indexOf(q);
  if (ni === -1 && di === -1) return -1;
  return 2 + Math.min(ni === -1 ? Infinity : ni, di === -1 ? Infinity : di);
}

function ResultIcon({ result }: { result: Result }) {
  if (result.kind === "pokemon") {
    return (
      <img
        src={spriteUrl(result.data.id)}
        alt=""
        className="h-8 w-8 object-contain"
        onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0"; }}
      />
    );
  }
  if (result.kind === "item") {
    return (
      <img
        src={`${ITEM_SPRITES}/${result.data.name}.png`}
        alt=""
        className="h-7 w-7 object-contain"
        onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0"; }}
      />
    );
  }
  const { Icon } = KIND_META[result.kind];
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <Icon className="h-4 w-4" />
    </div>
  );
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  game: GameOption | null;
}

export function CommandPalette({ open, onClose, game }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: pokemon } = usePokemonSummaryList();
  const { data: moves } = useMoveList();
  const { data: abilities } = useAbilityList();
  const { data: items } = useItemList();

  const [selected, setSelected] = useState<Result | null>(null);

  // Reset query each time the palette is opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Focus on next tick so the autoFocus prop wins on mount
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const speciesIdMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!pokemon) return map;
    for (const p of pokemon) {
      if (p.name === p.species.name) map[p.species.name] = p.id;
    }
    return map;
  }, [pokemon]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Result[] = [];

    if (pokemon) {
      for (const p of pokemon) {
        const display = formatPokemonName(p.name);
        const s = score(p.name, display, q);
        if (s === -1) continue;
        const dexId = speciesIdMap[p.species.name] ?? p.id;
        out.push({ kind: "pokemon", key: `pokemon:${p.name}`, label: display, sub: `#${String(dexId).padStart(3, "0")} · Pokémon`, sortScore: s, data: p });
      }
    }
    if (moves) {
      for (const m of moves) {
        const s = score(m.name, m.displayName, q);
        if (s === -1) continue;
        out.push({ kind: "move", key: `move:${m.name}`, label: m.displayName, sub: `Move · ${m.type}`, sortScore: s, data: m });
      }
    }
    if (abilities) {
      for (const a of abilities) {
        const s = score(a.name, a.displayName, q);
        if (s === -1) continue;
        out.push({ kind: "ability", key: `ability:${a.name}`, label: a.displayName, sub: `Ability${a.shortEffect ? ` · ${a.shortEffect}` : ""}`, sortScore: s, data: a });
      }
    }
    if (items) {
      for (const it of items) {
        const s = score(it.name, it.displayName, q);
        if (s === -1) continue;
        out.push({ kind: "item", key: `item:${it.name}`, label: it.displayName, sub: `Item · ${it.categoryDisplay}`, sortScore: s, data: it });
      }
    }

    out.sort((a, b) => a.sortScore - b.sortScore || a.label.localeCompare(b.label));
    return out.slice(0, MAX_RESULTS);
  }, [query, pokemon, moves, abilities, items]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  // Keep active row in view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = results[activeIndex];
      if (picked) { setSelected(picked); onClose(); }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  if (!open && !selected) return null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-[15vh]"
          onClick={onClose}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Pokémon, moves, abilities, items…"
                className="flex-1 bg-transparent py-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
              <kbd className="hidden sm:inline-block rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
              {results.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {query.trim() ? "No results" : "Start typing to search…"}
                </div>
              ) : (
                results.map((r, i) => {
                  const { Icon } = KIND_META[r.kind];
                  return (
                    <button
                      key={r.key}
                      data-index={i}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => { setSelected(r); onClose(); }}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left",
                        i === activeIndex ? "bg-muted" : "bg-transparent",
                      )}
                    >
                      <ResultIcon result={r} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{r.label}</div>
                        <div className="truncate text-xs text-muted-foreground">{r.sub}</div>
                      </div>
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <kbd className="rounded border border-border px-1 py-0.5">↑↓</kbd>
                <span>navigate</span>
                <kbd className="rounded border border-border px-1 py-0.5">↵</kbd>
                <span>open</span>
              </div>
              <span>{results.length} result{results.length === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>
      )}

      {selected?.kind === "pokemon" && (
        <PokemonModal
          pokemonName={selected.data.name}
          game={game ?? undefined}
          onClose={() => setSelected(null)}
          onNavigate={(name) => {
            const p = pokemon?.find((x) => x.name === name);
            if (p) setSelected({ kind: "pokemon", key: `pokemon:${p.name}`, label: formatPokemonName(p.name), sub: "", sortScore: 0, data: p });
          }}
          prevPokemon={null}
          nextPokemon={null}
        />
      )}
      {selected?.kind === "move" && (
        <MoveModal
          name={selected.data.name}
          entry={selected.data}
          game={game}
          onClose={() => setSelected(null)}
        />
      )}
      {selected?.kind === "ability" && (
        <AbilityModal
          name={selected.data.name}
          entry={selected.data}
          game={game}
          onClose={() => setSelected(null)}
        />
      )}
      {selected?.kind === "item" && (
        <ItemModal
          item={selected.data}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
