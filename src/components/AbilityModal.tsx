import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSingleAbilityDetail, usePokemonSummaryList, type AbilityListEntry } from "@/lib/pokeapi";
import { bestFlavorText, spriteUrl, type GameOption } from "@/lib/games";
import { formatPokemonName } from "@/lib/utils";

const VERSION_GROUP_LABELS: Record<string, string> = {
  "ruby-sapphire":                       "Ruby/Sapphire",
  "emerald":                             "Emerald",
  "firered-leafgreen":                   "FireRed/LeafGreen",
  "diamond-pearl":                       "Diamond/Pearl",
  "platinum":                            "Platinum",
  "heartgold-soulsilver":                "HeartGold/SoulSilver",
  "black-white":                         "Black/White",
  "black-2-white-2":                     "Black 2/White 2",
  "x-y":                                 "X/Y",
  "omega-ruby-alpha-sapphire":           "Omega Ruby/Alpha Sapphire",
  "sun-moon":                            "Sun/Moon",
  "ultra-sun-ultra-moon":                "Ultra Sun/Ultra Moon",
  "lets-go-pikachu-lets-go-eevee":       "Let's Go",
  "sword-shield":                        "Sword/Shield",
  "brilliant-diamond-and-shining-pearl": "Brilliant Diamond/Shining Pearl",
  "legends-arceus":                      "Legends: Arceus",
  "scarlet-violet":                      "Scarlet/Violet",
};

interface AbilityModalProps {
  name: string;
  entry?: AbilityListEntry;
  game?: GameOption | null;
  onClose: () => void;
}

export function AbilityModal({ name, entry, game, onClose }: AbilityModalProps) {
  const navigate = useNavigate();
  const { data: detail, isLoading } = useSingleAbilityDetail(name);
  const { data: allPokemon } = usePokemonSummaryList();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const displayName = entry?.displayName
    ?? name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const shortEffect =
    detail?.effect_entries?.find((e) => e.language.name === "en")?.short_effect
    ?? entry?.shortEffect ?? "";

  const flavorEntry = detail
    ? bestFlavorText(detail.flavor_text_entries, game ?? null)
    : undefined;

  // Find all Pokémon with this ability, filtered by game if one is selected
  const { regular, hidden } = useMemo(() => {
    if (!allPokemon) return { regular: [], hidden: [] };
    const inGame = allPokemon.filter((p) => {
      if (!game) return true;
      // Must be within genMax (national dex ceiling for this game)
      return p.id <= game.genMax;
    });
    const withAbility = inGame.filter((p) =>
      p.abilities.some((a) => a.ability.name === name),
    );
    const regular = withAbility.filter((p) =>
      p.abilities.some((a) => a.ability.name === name && !a.is_hidden),
    );
    const hidden = withAbility.filter((p) =>
      p.abilities.some((a) => a.ability.name === name && a.is_hidden),
    );
    return { regular, hidden };
  }, [allPokemon, name, game]);

  function openPokemon(pokemonName: string) {
    navigate(`/pokedex?pokemon=${pokemonName}`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <h2 className="text-xl font-bold">{displayName}</h2>
          <button
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
        <div className="space-y-5 px-5 py-4">
          {isLoading ? (
            <div className="space-y-1.5">
              <div className="h-3.5 w-1/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          ) : shortEffect ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Effect
              </p>
              <p className="text-sm leading-relaxed">{shortEffect}</p>
            </div>
          ) : null}

          {flavorEntry && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                In-game description
                <span className="ml-1.5 font-normal normal-case text-muted-foreground/70">
                  ({VERSION_GROUP_LABELS[flavorEntry.version_group.name] ?? flavorEntry.version_group.name})
                </span>
              </p>
              <p className="text-sm italic leading-relaxed text-muted-foreground">
                {flavorEntry.flavor_text.replace(/\n/g, " ")}
              </p>
            </div>
          )}

          {/* Pokémon with this ability */}
          {(regular.length > 0 || hidden.length > 0) && (
            <div className="space-y-4">
              {regular.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pokémon with this ability
                    <span className="ml-1.5 font-normal normal-case text-muted-foreground/70">
                      ({regular.length})
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {regular.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => openPokemon(p.name)}
                        className="flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 hover:bg-muted transition-colors"
                        title={formatPokemonName(p.name)}
                      >
                        <img
                          src={spriteUrl(p.id, game?.spriteVersion)}
                          alt={formatPokemonName(p.name)}
                          className="h-10 w-10 object-contain"
                          loading="lazy"
                        />
                        <span className="text-center text-[10px] text-muted-foreground leading-tight max-w-[52px] truncate">
                          {formatPokemonName(p.name)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {hidden.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    As hidden ability
                    <span className="ml-1.5 font-normal normal-case text-muted-foreground/70">
                      ({hidden.length})
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {hidden.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => openPokemon(p.name)}
                        className="flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 hover:bg-muted transition-colors"
                        title={formatPokemonName(p.name)}
                      >
                        <img
                          src={spriteUrl(p.id, game?.spriteVersion)}
                          alt={formatPokemonName(p.name)}
                          className="h-10 w-10 object-contain"
                          loading="lazy"
                        />
                        <span className="text-center text-[10px] text-muted-foreground leading-tight max-w-[52px] truncate">
                          {formatPokemonName(p.name)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>

  );
}
