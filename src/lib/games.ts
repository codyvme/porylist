export interface GameOption {
  value: string;
  label: string;
  /** Pokémon IDs natively introduced in this game's home region (used when National Dex toggle is OFF). */
  nativeRanges: Array<[number, number]>;
  /** Max national Pokédex # for this game's generation (used when National Dex toggle is ON). */
  genMax: number;
  /** Release generation (1-9). Determines retconned typings (e.g. pre-Fairy). */
  generation: number;
  /** Sprite version folder under SPRITES_ROOT/versions/. Falls back to modern HOME render. */
  spriteVersion?: string;
}

export const GAMES: GameOption[] = [
  {
    value: "red-blue-yellow",
    label: "Red/Blue/Yellow",
    nativeRanges: [[1, 151]],
    genMax: 151,
    generation: 1,
    spriteVersion: "generation-i/red-blue",
  },
  {
    value: "gold-silver-crystal",
    label: "Gold/Silver/Crystal",
    nativeRanges: [[152, 251]],
    genMax: 251,
    generation: 2,
    spriteVersion: "generation-ii/crystal",
  },
  {
    value: "ruby-sapphire-emerald",
    label: "Ruby/Sapphire/Emerald",
    nativeRanges: [[252, 386]],
    genMax: 386,
    generation: 3,
    spriteVersion: "generation-iii/emerald",
  },
  {
    value: "firered-leafgreen",
    label: "FireRed/LeafGreen",
    nativeRanges: [[1, 151]],
    genMax: 386,
    generation: 3,
    spriteVersion: "generation-iii/firered-leafgreen",
  },
  {
    value: "diamond-pearl-platinum",
    label: "Diamond/Pearl/Platinum",
    nativeRanges: [[387, 493]],
    genMax: 493,
    generation: 4,
    spriteVersion: "generation-iv/platinum",
  },
  {
    value: "heartgold-soulsilver",
    label: "HeartGold/SoulSilver",
    nativeRanges: [[152, 251]],
    genMax: 493,
    generation: 4,
    spriteVersion: "generation-iv/heartgold-soulsilver",
  },
  {
    value: "black-white",
    label: "Black/White",
    nativeRanges: [[494, 649]],
    genMax: 649,
    generation: 5,
    spriteVersion: "generation-v/black-white",
  },
  {
    value: "black2-white2",
    label: "Black 2/White 2",
    nativeRanges: [[494, 649]],
    genMax: 649,
    generation: 5,
    spriteVersion: "generation-v/black-white",
  },
  {
    value: "x-y",
    label: "X/Y",
    nativeRanges: [[650, 721]],
    genMax: 721,
    generation: 6,
    spriteVersion: "generation-vi/omegaruby-alphasapphire",
  },
  {
    value: "omega-ruby-alpha-sapphire",
    label: "Omega Ruby/Alpha Sapphire",
    nativeRanges: [[252, 386]],
    genMax: 721,
    generation: 6,
    spriteVersion: "generation-vi/omegaruby-alphasapphire",
  },
  {
    value: "sun-moon",
    label: "Sun/Moon",
    nativeRanges: [[722, 802]],
    genMax: 802,
    generation: 7,
    spriteVersion: "generation-vii/ultra-sun-ultra-moon",
  },
  {
    value: "ultra-sun-ultra-moon",
    label: "Ultra Sun/Ultra Moon",
    nativeRanges: [[722, 807]],
    genMax: 807,
    generation: 7,
    spriteVersion: "generation-vii/ultra-sun-ultra-moon",
  },
  {
    value: "lets-go",
    label: "Let's Go, Pikachu!/Eevee!",
    nativeRanges: [
      [1, 151],
      [808, 809],
    ],
    genMax: 809,
    generation: 7,
  },
  {
    value: "sword-shield",
    label: "Sword/Shield",
    nativeRanges: [[810, 905]],
    genMax: 905,
    generation: 8,
  },
  {
    value: "brilliant-diamond-shining-pearl",
    label: "Brilliant Diamond/Shining Pearl",
    nativeRanges: [[387, 493]],
    genMax: 905,
    generation: 8,
  },
  {
    value: "legends-arceus",
    label: "Legends: Arceus",
    nativeRanges: [[387, 493]],
    genMax: 905,
    generation: 8,
  },
  {
    value: "scarlet-violet",
    label: "Scarlet/Violet",
    nativeRanges: [[906, 1025]],
    genMax: 1025,
    generation: 9,
  },
  {
    value: "legends-za",
    label: "Legends: Z-A",
    nativeRanges: [[650, 721]],
    genMax: 1025,
    generation: 9,
  },
];

export const GAMES_BY_VALUE: Record<string, GameOption> = Object.fromEntries(
  GAMES.map((g) => [g.value, g]),
);

/** Maps a game's value to PokeAPI version name(s) used to look up Pokédex flavor text (preferred first). */
export const GAME_VERSIONS: Record<string, string[]> = {
  "red-blue-yellow":               ["yellow", "red", "blue"],
  "gold-silver-crystal":           ["crystal", "gold", "silver"],
  "ruby-sapphire-emerald":         ["emerald", "ruby", "sapphire"],
  "firered-leafgreen":             ["firered", "leafgreen"],
  "diamond-pearl-platinum":        ["platinum", "diamond", "pearl"],
  "heartgold-soulsilver":          ["heartgold", "soulsilver"],
  "black-white":                   ["black", "white"],
  "black2-white2":                 ["black-2", "white-2"],
  "x-y":                           ["x", "y"],
  "omega-ruby-alpha-sapphire":     ["omega-ruby", "alpha-sapphire"],
  "sun-moon":                      ["sun", "moon"],
  "ultra-sun-ultra-moon":          ["ultra-sun", "ultra-moon"],
  "lets-go":                       ["lets-go-pikachu", "lets-go-eevee"],
  "sword-shield":                  ["sword", "shield"],
  "brilliant-diamond-shining-pearl": ["brilliant-diamond", "shining-pearl"],
  "legends-arceus":                ["legends-arceus"],
  "scarlet-violet":                ["scarlet", "violet"],
  "legends-za":                    ["scarlet", "violet"],
};

/** Maps a game's value to the PokeAPI version-group name(s) used to filter moves. */
export const GAME_VERSION_GROUPS: Record<string, string[]> = {
  "red-blue-yellow":               ["red-blue", "yellow"],
  "gold-silver-crystal":           ["gold-silver", "crystal"],
  "ruby-sapphire-emerald":         ["ruby-sapphire", "emerald"],
  "firered-leafgreen":             ["firered-leafgreen"],
  "diamond-pearl-platinum":        ["diamond-pearl", "platinum"],
  "heartgold-soulsilver":          ["heartgold-soulsilver"],
  "black-white":                   ["black-white"],
  "black2-white2":                 ["black-2-white-2"],
  "x-y":                           ["x-y"],
  "omega-ruby-alpha-sapphire":     ["omega-ruby-alpha-sapphire"],
  "sun-moon":                      ["sun-moon"],
  "ultra-sun-ultra-moon":          ["ultra-sun-ultra-moon"],
  "lets-go":                       ["lets-go-pikachu-lets-go-eevee"],
  "sword-shield":                  ["sword-shield"],
  "brilliant-diamond-shining-pearl": ["brilliant-diamond-and-shining-pearl"],
  "legends-arceus":                ["legends-arceus"],
  "scarlet-violet":                ["scarlet-violet"],
  "legends-za":                    ["scarlet-violet"],
};

/** Version groups in chronological order, one band per generation (index 0 = Gen 1). */
export const VG_BANDS: string[][] = [
  ["red-blue", "yellow"],
  ["gold-silver", "crystal"],
  ["ruby-sapphire", "emerald", "firered-leafgreen", "colosseum", "xd"],
  ["diamond-pearl", "platinum", "heartgold-soulsilver"],
  ["black-white", "black-2-white-2"],
  ["x-y", "omega-ruby-alpha-sapphire"],
  ["sun-moon", "ultra-sun-ultra-moon", "lets-go-pikachu-lets-go-eevee"],
  ["sword-shield", "brilliant-diamond-and-shining-pearl", "legends-arceus"],
  ["scarlet-violet"],
];

/**
 * Returns the best English flavor-text entry for the given game.
 * Prefers a direct match on the game's version groups; falls back to the
 * latest entry from any version group in an earlier or equal generation.
 */
export function bestFlavorText<T extends {
  flavor_text: string;
  language: { name: string };
  version_group: { name: string };
}>(entries: T[], game: GameOption | null): T | undefined {
  const en = entries.filter((e) => e.language.name === "en");
  if (!game) return en.at(-1);

  const gameVGs = new Set(GAME_VERSION_GROUPS[game.value] ?? []);
  const direct = en.filter((e) => gameVGs.has(e.version_group.name));
  if (direct.length > 0) return direct.at(-1);

  // Fallback: latest entry whose version_group belongs to gen ≤ game.generation
  const eligibleVGs = new Set(VG_BANDS.slice(0, game.generation).flat());
  return en.filter((e) => eligibleVGs.has(e.version_group.name)).at(-1);
}

export function regionalNumber(
  id: number,
  ranges: Array<[number, number]>,
): number {
  let offset = 0;
  for (const [min, max] of ranges) {
    if (id >= min && id <= max) {
      return offset + (id - min + 1);
    }
    offset += max - min + 1;
  }
  return 0;
}

export const SPRITES_ROOT = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon";

export function spriteUrl(id: number, spriteVersion?: string): string {
  if (spriteVersion) {
    return `${SPRITES_ROOT}/versions/${spriteVersion}/${id}.png`;
  }
  return `${SPRITES_ROOT}/other/home/${id}.png`;
}

export const CRIES_ROOT = "https://cdn.jsdelivr.net/gh/PokeAPI/cries@main/cries/pokemon";

/** Returns the URL for a Pokémon's cry. Uses legacy (Gen 1–5 style) cries when generation ≤ 5. */
export function cryUrl(id: number, generation?: number): string {
  const variant = generation && generation <= 5 ? "legacy" : "latest";
  return `${CRIES_ROOT}/${variant}/${id}.ogg`;
}
