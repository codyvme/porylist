import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, Search, X } from "lucide-react";
import { usePokemonSummaryList, typesForGeneration } from "@/lib/pokeapi";
import { spriteUrl, type GameOption } from "@/lib/games";
import { typeStyle } from "@/lib/types";
import { formatPokemonName, cn } from "@/lib/utils";
import type { Playthrough, TeamMember } from "@/lib/playthroughs";

interface Props {
  playthrough: Playthrough;
  game: GameOption | null;
  onUpdate: (p: Playthrough) => void;
}

/**
 * Minimal per-playthrough team picker. Six slots, click to search & add a
 * Pokémon, X to remove, pencil to nickname. No levels, moves, items, or
 * other stats — this is deliberately just a roster so the route browser's
 * team-coverage suggestions have something to work from without extra
 * upkeep.
 */
export function PlaythroughTeamTab({ playthrough, game, onUpdate }: Props) {
  const team = playthrough.team ?? [];
  const { data: summaryList = [] } = usePokemonSummaryList();
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftNickname, setDraftNickname] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  const summaryByName = useMemo(() => {
    const map = new Map<string, typeof summaryList[number]>();
    for (const p of summaryList) map.set(p.name, p);
    return map;
  }, [summaryList]);

  // Use the game's sprite version when the Pokémon was available in that
  // generation; otherwise fall back to the modern home render. Mirrors the
  // logic from the Pokémon of the Day card.
  const spriteFor = useCallback((id: number) => {
    const version = game && id <= game.genMax ? game.spriteVersion : undefined;
    return spriteUrl(id, version);
  }, [game]);
  const fallbackSprite = useCallback((id: number) => spriteUrl(id, undefined), []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const onTeam = new Set(team.map((m) => m.species));
    const genMax = game?.genMax;
    return summaryList
      .filter((p) => {
        if (onTeam.has(p.name)) return false;
        // Hide Pokémon that didn't exist in this game's generation.
        if (genMax != null && p.id > genMax) return false;
        return p.name.includes(q) || formatPokemonName(p.name).toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [query, summaryList, team, game?.genMax]);

  // Close search popup on outside click
  useEffect(() => {
    if (activeSlot === null) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveSlot(null);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [activeSlot]);

  // Focus the nickname input when editing starts
  useEffect(() => {
    if (editingIndex !== null) {
      requestAnimationFrame(() => nicknameInputRef.current?.focus());
    }
  }, [editingIndex]);

  const writeTeam = useCallback((next: TeamMember[]) => {
    onUpdate({ ...playthrough, team: next, updatedAt: Date.now() });
  }, [playthrough, onUpdate]);

  const handleAdd = useCallback((species: string) => {
    if (team.some((m) => m.species === species) || team.length >= 6) return;
    writeTeam([...team, { species }]);
    setActiveSlot(null);
    setQuery("");
  }, [team, writeTeam]);

  const handleRemove = useCallback((index: number) => {
    writeTeam(team.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  }, [team, writeTeam, editingIndex]);

  const handleClear = useCallback(() => {
    writeTeam([]);
    setEditingIndex(null);
  }, [writeTeam]);

  const beginEdit = useCallback((index: number, current: string | undefined) => {
    setEditingIndex(index);
    setDraftNickname(current ?? "");
  }, []);

  const commitEdit = useCallback(() => {
    if (editingIndex === null) return;
    const trimmed = draftNickname.trim();
    const next = team.map((m, i) =>
      i === editingIndex ? { ...m, nickname: trimmed || undefined } : m
    );
    writeTeam(next);
    setEditingIndex(null);
  }, [editingIndex, draftNickname, team, writeTeam]);

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
    setDraftNickname("");
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col gap-3 overflow-y-auto pt-3 pb-8">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Track your current team for this run. Click the pencil to nickname a Pokémon. Powers the route browser's "Picks for your team" suggestions.
        </p>
        {team.length > 0 && (
          <button
            onClick={handleClear}
            className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
          >
            Clear team
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => {
          const member = team[i];
          const summary = member ? summaryByName.get(member.species) : null;
          const isActive = activeSlot === i;
          const isEditing = editingIndex === i;
          const speciesLabel = member ? formatPokemonName(member.species) : "";

          if (member && summary && isEditing) {
            // Inline nickname editor
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-primary px-3 py-2 bg-primary/5"
              >
                <img
                  src={spriteFor(summary.id)}
                  alt=""
                  className="h-12 w-12 shrink-0 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).src = fallbackSprite(summary.id); }}
                />
                <input
                  ref={nicknameInputRef}
                  value={draftNickname}
                  onChange={(e) => setDraftNickname(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  placeholder={speciesLabel}
                  maxLength={24}
                  className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={commitEdit}
                    className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          }

          // Empty slot in search mode — the row IS the search input
          if (!summary && isActive) {
            // Open suggestions downward for top half of list, upward for bottom
            const openUpward = i >= 3;
            return (
              <div
                key={i}
                className="relative flex items-center gap-3 rounded-lg border border-primary bg-primary/5 px-3 py-2"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Pokémon…"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setActiveSlot(null); setQuery(""); }
                  }}
                />
                <button
                  onClick={() => { setActiveSlot(null); setQuery(""); }}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
                {suggestions.length > 0 && (
                  <div className={cn(
                    "absolute left-0 right-0 z-30 overflow-hidden rounded-lg border bg-background shadow-xl",
                    openUpward ? "bottom-full mb-1" : "top-full mt-1",
                  )}>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {suggestions.map((p) => (
                        <button
                          key={p.name}
                          onMouseDown={(e) => { e.preventDefault(); handleAdd(p.name); }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                        >
                          <img
                            src={spriteFor(p.id)}
                            alt=""
                            className="h-7 w-7 object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).src = fallbackSprite(p.id); }}
                          />
                          <span className="flex-1 text-left">{formatPokemonName(p.name)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                summary ? "border-border bg-card" : "border-dashed border-muted-foreground/25 cursor-pointer hover:border-primary/50 hover:bg-muted/30",
              )}
              onClick={!summary ? () => {
                setActiveSlot(i);
                setQuery("");
                setTimeout(() => inputRef.current?.focus(), 0);
              } : undefined}
            >
              {summary && member ? (
                <>
                  <img
                    src={spriteFor(summary.id)}
                    alt=""
                    className="h-12 w-12 shrink-0 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).src = fallbackSprite(summary.id); }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">
                        {member.nickname || speciesLabel}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); beginEdit(i, member.nickname); }}
                        className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                        aria-label={`Edit nickname for ${speciesLabel}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                    {member.nickname && (
                      <div className="truncate text-xs text-muted-foreground">{speciesLabel}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {typesForGeneration(summary, game?.generation).map((t) => (
                      <span key={t} className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize text-white" style={typeStyle(t)}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(i); }}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${speciesLabel}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center">
                    <Plus className="h-5 w-5 text-muted-foreground/30" />
                  </div>
                  <span className="text-sm text-muted-foreground">Empty slot</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {team.length === 0 && activeSlot === null && (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          Click any empty slot to add a Pokémon to your team.
        </div>
      )}
    </div>
  );
}
