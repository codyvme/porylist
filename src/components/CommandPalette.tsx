import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, List, Swords, Sparkles, Backpack, House, Trophy, Users, Crosshair, Scale, Leaf, Dna, Clock, ArrowRight } from "lucide-react";
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
const RECENTS_KEY = "porylist-palette-recents-v1";
const RECENTS_MAX = 6;

type ResultKind = "pokemon" | "move" | "ability" | "item" | "action";

type EntityResult =
  | { kind: "pokemon"; key: string; label: string; sub: string; sortScore: number; data: PokemonSummary }
  | { kind: "move"; key: string; label: string; sub: string; sortScore: number; data: MoveListEntry }
  | { kind: "ability"; key: string; label: string; sub: string; sortScore: number; data: AbilityListEntry }
  | { kind: "item"; key: string; label: string; sub: string; sortScore: number; data: ItemListEntry };

type ActionResult = {
  kind: "action";
  key: string;
  label: string;
  sub: string;
  sortScore: number;
  Icon: React.ElementType;
  perform: () => void;
};

type Result = EntityResult | ActionResult;

const KIND_META: Record<ResultKind, { label: string; Icon: React.ElementType }> = {
  pokemon: { label: "Pokémon", Icon: List },
  move:    { label: "Move",    Icon: Swords },
  ability: { label: "Ability", Icon: Sparkles },
  item:    { label: "Item",    Icon: Backpack },
  action:  { label: "Action",  Icon: ArrowRight },
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
  if (result.kind === "action") {
    const { Icon } = result;
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
    );
  }
  const { Icon } = KIND_META[result.kind];
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <Icon className="h-4 w-4" />
    </div>
  );
}

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string").slice(0, RECENTS_MAX);
    return [];
  } catch { return []; }
}

function pushRecent(key: string) {
  try {
    const current = loadRecents().filter((k) => k !== key);
    current.unshift(key);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(current.slice(0, RECENTS_MAX)));
  } catch { /* ignore */ }
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  game: GameOption | null;
}

export function CommandPalette({ open, onClose, game }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<string[]>(loadRecents);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: pokemon } = usePokemonSummaryList();
  const { data: moves } = useMoveList();
  const { data: abilities } = useAbilityList();
  const { data: items } = useItemList();

  const [selected, setSelected] = useState<EntityResult | null>(null);

  // Reset query each time the palette is opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setRecents(loadRecents());
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

  const handleSelect = useCallback((r: Result) => {
    if (r.kind === "action") {
      r.perform();
      onClose();
      return;
    }
    pushRecent(r.key);
    setSelected(r);
    onClose();
  }, [onClose]);

  // Build a lookup so we can hydrate recent keys back into Result objects
  const buildEntityResult = useCallback((key: string): EntityResult | null => {
    const [kind, ...rest] = key.split(":");
    const name = rest.join(":");
    if (kind === "pokemon" && pokemon) {
      const p = pokemon.find((x) => x.name === name);
      if (!p) return null;
      const dexId = speciesIdMap[p.species.name] ?? p.id;
      return { kind: "pokemon", key, label: formatPokemonName(p.name), sub: `#${String(dexId).padStart(3, "0")} · Pokémon`, sortScore: 0, data: p };
    }
    if (kind === "move" && moves) {
      const m = moves.find((x) => x.name === name);
      if (!m) return null;
      return { kind: "move", key, label: m.displayName, sub: `Move · ${m.type}`, sortScore: 0, data: m };
    }
    if (kind === "ability" && abilities) {
      const a = abilities.find((x) => x.name === name);
      if (!a) return null;
      return { kind: "ability", key, label: a.displayName, sub: `Ability${a.shortEffect ? ` · ${a.shortEffect}` : ""}`, sortScore: 0, data: a };
    }
    if (kind === "item" && items) {
      const it = items.find((x) => x.name === name);
      if (!it) return null;
      return { kind: "item", key, label: it.displayName, sub: `Item · ${it.categoryDisplay}`, sortScore: 0, data: it };
    }
    return null;
  }, [pokemon, moves, abilities, items, speciesIdMap]);

  const quickActions = useMemo<ActionResult[]>(() => {
    const nav = (to: string) => () => navigate(to);
    return [
      { kind: "action", key: "action:nav-dashboard", label: "Go to Dashboard",         sub: "Navigation", Icon: House,     sortScore: 0, perform: nav("/") },
      { kind: "action", key: "action:nav-pokedex",   label: "Go to Pokédex",           sub: "Navigation", Icon: List,      sortScore: 0, perform: nav("/pokedex") },
      { kind: "action", key: "action:nav-moves",     label: "Go to Moves",             sub: "Navigation", Icon: Swords,    sortScore: 0, perform: nav("/moves") },
      { kind: "action", key: "action:nav-abilities", label: "Go to Abilities",         sub: "Navigation", Icon: Sparkles,  sortScore: 0, perform: nav("/abilities") },
      { kind: "action", key: "action:nav-items",     label: "Go to Items",             sub: "Navigation", Icon: Backpack,  sortScore: 0, perform: nav("/items") },
      { kind: "action", key: "action:nav-natures",   label: "Go to Natures",           sub: "Navigation", Icon: Leaf,      sortScore: 0, perform: nav("/natures") },
      { kind: "action", key: "action:nav-routes",    label: "Go to Playthroughs",      sub: "Navigation", Icon: Trophy,    sortScore: 0, perform: nav("/routes") },
      { kind: "action", key: "action:nav-team",      label: "Go to Team Builder",      sub: "Navigation", Icon: Users,     sortScore: 0, perform: nav("/team") },
      { kind: "action", key: "action:nav-compare",   label: "Go to Compare",           sub: "Navigation", Icon: Scale,     sortScore: 0, perform: nav("/compare") },
      { kind: "action", key: "action:nav-catch",     label: "Go to Catch Calculator",  sub: "Navigation", Icon: Crosshair, sortScore: 0, perform: nav("/catch") },
      { kind: "action", key: "action:nav-damage",    label: "Go to Damage Calculator", sub: "Navigation", Icon: Swords,    sortScore: 0, perform: nav("/damage") },
      { kind: "action", key: "action:nav-breeding",  label: "Go to Breeding Tracker",  sub: "Navigation", Icon: Dna,       sortScore: 0, perform: nav("/breeding") },
    ];
  }, [navigate]);

  const searchResults = useMemo<Result[]>(() => {
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
    // Actions: match against the label only
    for (const a of quickActions) {
      const s = score(a.label.toLowerCase(), a.label, q);
      if (s === -1) continue;
      out.push({ ...a, sortScore: s });
    }

    out.sort((a, b) => a.sortScore - b.sortScore || a.label.localeCompare(b.label));
    return out.slice(0, MAX_RESULTS);
  }, [query, pokemon, moves, abilities, items, speciesIdMap, quickActions]);

  const recentResults = useMemo<EntityResult[]>(() => {
    const out: EntityResult[] = [];
    for (const k of recents) {
      const r = buildEntityResult(k);
      if (r) out.push(r);
    }
    return out;
  }, [recents, buildEntityResult]);

  // Build the flat ordered list that the keyboard navigates through.
  // When the user has typed a query: just the search results.
  // When empty: recents first, then quick actions.
  const sections = useMemo<Array<{ heading: string; Icon: React.ElementType; results: Result[] }>>(() => {
    if (query.trim()) return [{ heading: "Results", Icon: Search, results: searchResults }];
    const out: Array<{ heading: string; Icon: React.ElementType; results: Result[] }> = [];
    if (recentResults.length > 0) out.push({ heading: "Recent", Icon: Clock, results: recentResults });
    out.push({ heading: "Quick actions", Icon: ArrowRight, results: quickActions });
    return out;
  }, [query, searchResults, recentResults, quickActions]);

  const flatResults = useMemo(() => sections.flatMap((s) => s.results), [sections]);

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
      setActiveIndex((i) => Math.min(i + 1, Math.max(flatResults.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = flatResults[activeIndex];
      if (picked) handleSelect(picked);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  if (!open && !selected) return null;

  // Walking index across all sections so each row gets a globally unique data-index
  let walkingIndex = -1;

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
                className="flex-1 bg-transparent py-4 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
              <kbd className="hidden sm:inline-block rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
              {flatResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {query.trim() ? "No results" : "Start typing to search…"}
                </div>
              ) : (
                sections.map((section, sIdx) => (
                  <div key={section.heading}>
                    {!query.trim() && (
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                        sIdx > 0 && "mt-1 border-t border-border pt-3",
                      )}>
                        <section.Icon className="h-3 w-3" />
                        {section.heading}
                      </div>
                    )}
                    {section.results.map((r) => {
                      walkingIndex += 1;
                      const i = walkingIndex;
                      const { Icon } = KIND_META[r.kind];
                      return (
                        <button
                          key={r.key}
                          data-index={i}
                          onMouseEnter={() => setActiveIndex(i)}
                          onClick={() => handleSelect(r)}
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
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <kbd className="rounded border border-border px-1 py-0.5">↑↓</kbd>
                <span>navigate</span>
                <kbd className="rounded border border-border px-1 py-0.5">↵</kbd>
                <span>open</span>
              </div>
              {query.trim() && (
                <span>{flatResults.length} result{flatResults.length === 1 ? "" : "s"}</span>
              )}
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
