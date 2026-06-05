import { useEffect, useMemo, useRef, useState } from "react";
import { Search, UserRound, X } from "lucide-react";
import { cn, formatPokemonName } from "@/lib/utils";
import { usePokemonSummaryList, usePokemonSummaryMap, type PokemonSummary } from "@/lib/pokeapi";
import { spriteUrl, type GameOption } from "@/lib/games";
import { SpriteImg } from "@/components/SpriteImg";

interface PokemonSearchProps {
  /** Currently selected Pokémon name slug, or null for none. */
  value: string | null;
  onChange: (name: string | null) => void;
  placeholder?: string;
  /** Show a "None" option at the top of the dropdown (e.g. avatar picker). */
  allowNone?: boolean;
  /** Label for the None option. Default: "None" */
  noneLabel?: string;
  /** Optional filter applied on top of the text search (e.g. base forms only, gen max). */
  filter?: (p: PokemonSummary) => boolean;
  /** Max results shown in the dropdown. Default: 8 */
  maxResults?: number;
  /** Game context for game-appropriate sprites. */
  game?: GameOption;
  /** Open the dropdown upward instead of downward. */
  dropUp?: boolean;
  /** Show a clear (✕) button when a value is selected and the input is closed. Default: true */
  clearable?: boolean;
  /** Extra classes on the root wrapper div. */
  className?: string;
  /** Focus the input and open the dropdown on mount. */
  autoFocus?: boolean;
}

/**
 * Shared Pokémon autocomplete search input with sprite dropdown.
 * Shows the selected Pokémon's name when closed; clears to search on focus.
 */
export function PokemonSearch({
  value,
  onChange,
  placeholder = "Search Pokémon…",
  allowNone = false,
  noneLabel = "None",
  filter,
  maxResults = 8,
  game,
  dropUp = false,
  clearable = true,
  className,
  autoFocus = false,
}: PokemonSearchProps) {
  const { data: summaryList = [] } = usePokemonSummaryList();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  // Click-outside closes the dropdown
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target as Node) &&
        listRef.current && !listRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const results = useMemo(() => {
    // Normalize away punctuation/spacing so "mrmime" matches "Mr. Mime", etc.
    const norm = query.toLowerCase().replace(/[^a-z0-9♀♂]/g, "");
    const matched = [];

    // O(n) scan with early exit (break) when we hit maxResults.
    // Drastically reduces string allocations/comparisons compared to full array .filter().
    for (const p of summaryList) {
      if (filter && !filter(p)) continue;

      if (norm) {
        const display = formatPokemonName(p.name).toLowerCase().replace(/[^a-z0-9♀♂]/g, "");
        const isMatch = (
          display.includes(norm) ||
          p.name.replace(/-/g, "").includes(norm) ||
          String(p.id).startsWith(norm)
        );
        if (!isMatch) continue;
      }

      matched.push(p);
      if (matched.length >= maxResults) break;
    }

    return matched;
  }, [summaryList, query, filter, maxResults]);

  const { data: summaryMap } = usePokemonSummaryMap();
  const selectedEntry = useMemo(
    () => summaryMap?.get(value ?? "") ?? null,
    [summaryMap, value],
  );

  const handleSelect = (name: string | null) => {
    onChange(name);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={open ? query : (selectedEntry ? formatPokemonName(selectedEntry.name) : "")}
          onFocus={() => { setQuery(""); setOpen(true); }}
          onChange={(e) => setQuery(e.target.value)}
          className={cn(
            "h-9 w-full rounded-md border border-input bg-background pl-8 text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary",
            clearable && selectedEntry && !open ? "pr-8" : "pr-3",
          )}
        />
        {clearable && selectedEntry && !open && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Clear selection"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          ref={listRef}
          className={cn(
            "absolute left-0 right-0 z-50 max-h-64 overflow-y-auto rounded-lg border bg-background shadow-lg",
            dropUp ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          {allowNone && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(null)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted",
                value === null && "bg-primary/10 font-medium",
              )}
            >
              <UserRound className="h-7 w-7 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left">{noneLabel}</span>
            </button>
          )}
          {results.length === 0 && !allowNone && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No results.</p>
          )}
          {results.map((p) => (
            <button
              key={p.name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(p.name)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted",
                p.name === value && "bg-primary/10 font-medium",
              )}
            >
              <SpriteImg
                src={spriteUrl(p.id, game?.spriteVersion)}
                alt={p.name}
                size="h-7 w-7"
                fallbackSrc={game ? spriteUrl(p.id, undefined) : undefined}
              />
              <span className="flex-1 text-left">{formatPokemonName(p.name)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
