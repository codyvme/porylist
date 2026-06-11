import { useMemo } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import {
  useSinglePokemon,
  usePokemonSpecies,
  useEvolutionChain,
  useMoveList,
} from "@/lib/pokeapi";
import { GAME_VERSION_GROUPS, spriteUrl, type GameOption } from "@/lib/games";
import { immediateEvolutions } from "@/lib/evolution";
import { SpriteImg } from "@/components/SpriteImg";
import { TypeBadge } from "@/components/TypeBadge";
import { formatPokemonName, cn } from "@/lib/utils";
import type { TeamMember } from "@/lib/playthroughs";

interface Props {
  team: TeamMember[];
  game: GameOption | null;
}

/**
 * "Coming up" digest for the run team: each member's next evolution and the
 * level-up moves it's about to learn, given its current level. Reads progression
 * data from PokéAPI lazily, one member at a time.
 */
export function TeamUpcoming({ team, game }: Props) {
  const { data: moveList = [] } = useMoveList();
  const moveTypeByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of moveList) map.set(m.name, m.type);
    return map;
  }, [moveList]);

  if (team.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-base font-semibold">Coming up</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Set each Pokémon's level to see its next evolution and upcoming moves.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {team.map((member) => (
          <MemberUpcoming
            key={member.species}
            member={member}
            game={game}
            moveTypeByName={moveTypeByName}
          />
        ))}
      </div>
    </div>
  );
}

function levelFromMethod(method: string): number | null {
  const m = method.match(/Level (\d+)/);
  return m ? Number(m[1]) : null;
}

function MemberUpcoming({
  member,
  game,
  moveTypeByName,
}: {
  member: TeamMember;
  game: GameOption | null;
  moveTypeByName: Map<string, string>;
}) {
  const { data: pokemon } = useSinglePokemon(member.species);
  const { data: species } = usePokemonSpecies(pokemon?.species.name ?? null);
  const { data: evolutionChain } = useEvolutionChain(species?.evolution_chain.url ?? null);

  const nextEvos = useMemo(() => {
    if (!evolutionChain || !pokemon) return [];
    return immediateEvolutions(evolutionChain.chain, pokemon.species.name);
  }, [evolutionChain, pokemon]);

  const upcomingMoves = useMemo(() => {
    if (!pokemon) return [];
    const vgs = game ? GAME_VERSION_GROUPS[game.value] ?? [] : [];
    const levelMap = new Map<string, number>();
    for (const m of pokemon.moves) {
      for (const vgd of m.version_group_details) {
        if (vgd.move_learn_method.name !== "level-up") continue;
        if (vgs.length && !vgs.includes(vgd.version_group.name)) continue;
        const lvl = vgd.level_learned_at;
        if (lvl <= 0) continue;
        const prev = levelMap.get(m.move.name);
        if (prev == null || lvl < prev) levelMap.set(m.move.name, lvl);
      }
    }
    const cur = member.level ?? 0;
    return [...levelMap.entries()]
      .filter(([, lvl]) => lvl > cur)
      .map(([name, level]) => ({ name, level, type: moveTypeByName.get(name) ?? null }))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
      .slice(0, 4);
  }, [pokemon, game, member.level, moveTypeByName]);

  const displayName = member.nickname || formatPokemonName(member.species);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        {pokemon ? (
          <SpriteImg src={spriteUrl(pokemon.id)} alt="" size="h-10 w-10" fallbackSrc={spriteUrl(pokemon.id)} />
        ) : (
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{displayName}</div>
          {member.nickname && (
            <div className="truncate text-xs text-muted-foreground">{formatPokemonName(member.species)}</div>
          )}
        </div>
        {member.level != null && (
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums">
            Lv. {member.level}
          </span>
        )}
      </div>

      {/* Evolution */}
      <div className="flex flex-col gap-1">
        {nextEvos.length > 0 ? (
          nextEvos.map((evo) => {
            const lvls = evo.methods.map(levelFromMethod).filter((n): n is number => n != null);
            const lvl = lvls.length ? Math.min(...lvls) : null;
            const ready = lvl != null && member.level != null && member.level >= lvl;
            const soon = lvl != null && member.level != null && !ready && lvl - member.level <= 5;
            return (
              <div key={evo.species} className="flex items-center gap-1.5 text-xs">
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="font-medium">{formatPokemonName(evo.species)}</span>
                <span className="min-w-0 truncate text-muted-foreground">{evo.methods.join(" or ") || "Special"}</span>
                {ready && (
                  <span className="shrink-0 rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Ready!
                  </span>
                )}
                {soon && (
                  <span className="shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    Soon
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-xs text-muted-foreground">Fully evolved</div>
        )}
      </div>

      {/* Upcoming moves */}
      <div className="flex flex-col gap-1 border-t border-border/60 pt-2">
        {member.level == null ? (
          <div className="text-xs text-muted-foreground/70">Add a level to see upcoming moves.</div>
        ) : upcomingMoves.length > 0 ? (
          upcomingMoves.map((mv) => (
            <div key={mv.name} className="flex items-center gap-2 text-xs">
              <span className="w-9 shrink-0 tabular-nums text-muted-foreground">Lv.{mv.level}</span>
              {mv.type ? <TypeBadge type={mv.type} size="sm" /> : null}
              <span className="min-w-0 truncate font-medium capitalize">{mv.name.replace(/-/g, " ")}</span>
            </div>
          ))
        ) : (
          <div className={cn("text-xs text-muted-foreground")}>No more level-up moves.</div>
        )}
      </div>
    </div>
  );
}
