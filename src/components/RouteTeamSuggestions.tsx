import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { usePokemonSummaryList, typesForGeneration } from "@/lib/pokeapi";
import { ALL_TYPES, computeTypeEffectiveness } from "@/lib/type-chart";
import { spriteUrl, SPRITES_ROOT, type GameOption } from "@/lib/games";
import { typeStyle } from "@/lib/types";
import { formatPokemonName } from "@/lib/utils";

interface Props {
  /** Unique Pokémon names available on this route */
  routePokemonNames: string[];
  game: GameOption | null;
  onOpen: (name: string) => void;
  /**
   * Override the team list — when provided, used directly instead of reading
   * from the global Team Builder localStorage. PlaythroughTracker passes the
   * playthrough's own team so suggestions are run-scoped.
   */
  teamOverride?: string[];
}

function loadTeam(): string[] {
  try {
    const raw = localStorage.getItem("porylist-team");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

/**
 * Panel that suggests which Pokémon on the current route would best fill the
 * type-coverage gaps of the user's current Team Builder team.
 *
 * "Hits a team weakness" = the candidate has a STAB type that is super-
 * effective against a type the team has 2+ shared weaknesses to.
 *
 * Read-only: we just look at localStorage for the team. No-ops when no team.
 */
export function RouteTeamSuggestions({ routePokemonNames, game, onOpen, teamOverride }: Props) {
  const [globalTeam, setGlobalTeam] = useState<string[]>(loadTeam);
  const teamNames = teamOverride ?? globalTeam;

  // Refresh global team when localStorage changes — only matters when we're
  // falling back to the global Team Builder (i.e. teamOverride is undefined).
  useEffect(() => {
    if (teamOverride) return;
    const handler = (e: StorageEvent) => {
      if (e.key === "porylist-team") setGlobalTeam(loadTeam());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [teamOverride]);

  const { data: summaryList = [] } = usePokemonSummaryList();
  const summaryByName = useMemo(() => {
    const map = new Map<string, typeof summaryList[number]>();
    for (const p of summaryList) map.set(p.name, p);
    return map;
  }, [summaryList]);

  // Pull the user's team types from summary (skip the 6-pokemon hooks pattern
  // — we only need types here, not full detail data)
  const teamTypes = useMemo(() => {
    return teamNames
      .map((name) => summaryByName.get(name))
      .filter(Boolean)
      .map((p) => typesForGeneration(p!, game?.generation));
  }, [teamNames, summaryByName, game?.generation]);

  // Team weaknesses: types the team is collectively weak to (≥2 members weak)
  const teamWeaknesses = useMemo(() => {
    if (teamTypes.length === 0) return new Set<string>();
    const weakCounts: Record<string, number> = {};
    for (const types of teamTypes) {
      const eff = computeTypeEffectiveness(types, game?.generation ?? 9);
      for (const t of ALL_TYPES) if ((eff[t] ?? 1) >= 2) weakCounts[t] = (weakCounts[t] ?? 0) + 1;
    }
    return new Set(Object.entries(weakCounts).filter(([, c]) => c >= 2).map(([t]) => t));
  }, [teamTypes, game?.generation]);

  // For each route Pokémon, count how many team-weakness types its STAB hits SE
  const ranked = useMemo(() => {
    if (teamNames.length === 0 || teamWeaknesses.size === 0) return [];
    const candidates: Array<{ name: string; id: number; types: string[]; hits: string[] }> = [];
    const seen = new Set<string>();
    for (const name of routePokemonNames) {
      if (seen.has(name)) continue;
      seen.add(name);
      const summary = summaryByName.get(name);
      if (!summary) continue;
      const types = typesForGeneration(summary, game?.generation);
      const hits: string[] = [];
      for (const weakness of teamWeaknesses) {
        // computeTypeEffectiveness returns map[attackType → mult] vs the defending types
        const effVs = computeTypeEffectiveness([weakness], game?.generation ?? 9);
        for (const atk of types) {
          if ((effVs[atk] ?? 1) >= 2 && !hits.includes(weakness)) {
            hits.push(weakness);
          }
        }
      }
      if (hits.length > 0) candidates.push({ name, id: summary.id, types, hits });
    }
    candidates.sort((a, b) => b.hits.length - a.hits.length || a.name.localeCompare(b.name));
    return candidates.slice(0, 4);
  }, [routePokemonNames, summaryByName, teamWeaknesses, teamNames.length, game?.generation]);

  if (teamNames.length === 0 || ranked.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
        <Users className="h-3 w-3" />
        Picks for your team
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        These available Pokémon hit a type your team has trouble with.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {ranked.map((r) => (
          <button
            key={r.name}
            onClick={() => onOpen(r.name)}
            className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left hover:bg-muted"
          >
            <img
              src={spriteUrl(r.id)}
              alt=""
              className="h-9 w-9 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = `${SPRITES_ROOT}/${r.id}.png`; }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{formatPokemonName(r.name)}</div>
              <div className="mt-0.5 flex flex-wrap gap-0.5 text-[10px]">
                <span className="text-muted-foreground">Hits:</span>
                {r.hits.map((t) => (
                  <span key={t} className="rounded-full px-1.5 py-px text-[10px] font-medium capitalize text-white" style={typeStyle(t)}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

