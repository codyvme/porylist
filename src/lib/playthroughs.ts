// Types, constants, and storage for the Playthroughs tracker.

export interface Badge {
  id: string;
  name: string;
  /** Gym leader / kahuna / captain name */
  leader?: string;
  /** City / town */
  location?: string;
}

export interface NuzlockeOptions {
  enabled: boolean;
  /** Only the first Pokémon encountered on each route may be caught */
  firstEncounterOnly: boolean;
  /** Fainted Pokémon must be released or permanently boxed */
  releaseOnFaint: boolean;
  /** No duplicate species allowed */
  speciesClause: boolean;
  /** All caught Pokémon must be nicknamed */
  nicknameClause: boolean;
  /** Battle mode set to "Set" (no switching after opponent reveals) */
  setMode: boolean;
}

export const DEFAULT_NUZLOCKE: NuzlockeOptions = {
  enabled: false,
  firstEncounterOnly: true,
  releaseOnFaint: true,
  speciesClause: false,
  nicknameClause: false,
  setMode: false,
};

export interface Playthrough {
  id: string;
  name: string;
  gameValue: string;
  status: "active" | "completed" | "abandoned";
  /** IDs of earned badges (matches Badge.id from GAME_BADGES) */
  earnedBadges: string[];
  /** PokéAPI slugs of caught Pokémon for this specific run */
  caught: string[];
  nuzlocke: NuzlockeOptions;
  createdAt: number;
  updatedAt: number;
}

// ─── Badge data per game ──────────────────────────────────────────────────────

export const GAME_BADGES: Record<string, Badge[]> = {
  "red-blue-yellow": [
    { id: "boulder", name: "Boulder",  leader: "Brock",    location: "Pewter City" },
    { id: "cascade", name: "Cascade",  leader: "Misty",    location: "Cerulean City" },
    { id: "thunder", name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City" },
    { id: "rainbow", name: "Rainbow",  leader: "Erika",    location: "Celadon City" },
    { id: "soul",    name: "Soul",     leader: "Koga",     location: "Fuchsia City" },
    { id: "marsh",   name: "Marsh",    leader: "Sabrina",  location: "Saffron City" },
    { id: "volcano", name: "Volcano",  leader: "Blaine",   location: "Cinnabar Island" },
    { id: "earth",   name: "Earth",    leader: "Giovanni", location: "Viridian City" },
  ],

  "gold-silver-crystal": [
    // Johto
    { id: "zephyr",   name: "Zephyr",   leader: "Falkner", location: "Violet City" },
    { id: "hive",     name: "Hive",     leader: "Bugsy",   location: "Azalea Town" },
    { id: "plain",    name: "Plain",    leader: "Whitney",  location: "Goldenrod City" },
    { id: "fog",      name: "Fog",      leader: "Morty",   location: "Ecruteak City" },
    { id: "storm",    name: "Storm",    leader: "Chuck",   location: "Cianwood City" },
    { id: "mineral",  name: "Mineral",  leader: "Jasmine", location: "Olivine City" },
    { id: "glacier",  name: "Glacier",  leader: "Pryce",   location: "Mahogany Town" },
    { id: "rising",   name: "Rising",   leader: "Clair",   location: "Blackthorn City" },
    // Kanto
    { id: "boulder",  name: "Boulder",  leader: "Brock",   location: "Pewter City" },
    { id: "cascade",  name: "Cascade",  leader: "Misty",   location: "Cerulean City" },
    { id: "thunder",  name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City" },
    { id: "rainbow",  name: "Rainbow",  leader: "Erika",   location: "Celadon City" },
    { id: "soul",     name: "Soul",     leader: "Koga",    location: "Fuchsia City" },
    { id: "marsh",    name: "Marsh",    leader: "Sabrina", location: "Saffron City" },
    { id: "volcano",  name: "Volcano",  leader: "Blaine",  location: "Cinnabar Island" },
    { id: "earth",    name: "Earth",    leader: "Blue",    location: "Viridian City" },
  ],

  "ruby-sapphire-emerald": [
    { id: "stone",   name: "Stone",   leader: "Roxanne", location: "Rustboro City" },
    { id: "knuckle", name: "Knuckle", leader: "Brawly",  location: "Dewford Town" },
    { id: "dynamo",  name: "Dynamo",  leader: "Wattson", location: "Mauville City" },
    { id: "heat",    name: "Heat",    leader: "Flannery", location: "Lavaridge Town" },
    { id: "balance", name: "Balance", leader: "Norman",  location: "Petalburg City" },
    { id: "feather", name: "Feather", leader: "Winona",  location: "Fortree City" },
    { id: "mind",    name: "Mind",    leader: "Tate & Liza", location: "Mossdeep City" },
    { id: "rain",    name: "Rain",    leader: "Wallace", location: "Sootopolis City" },
  ],

  "firered-leafgreen": [
    { id: "boulder", name: "Boulder",  leader: "Brock",    location: "Pewter City" },
    { id: "cascade", name: "Cascade",  leader: "Misty",    location: "Cerulean City" },
    { id: "thunder", name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City" },
    { id: "rainbow", name: "Rainbow",  leader: "Erika",    location: "Celadon City" },
    { id: "soul",    name: "Soul",     leader: "Koga",     location: "Fuchsia City" },
    { id: "marsh",   name: "Marsh",    leader: "Sabrina",  location: "Saffron City" },
    { id: "volcano", name: "Volcano",  leader: "Blaine",   location: "Cinnabar Island" },
    { id: "earth",   name: "Earth",    leader: "Giovanni", location: "Viridian City" },
  ],

  "diamond-pearl-platinum": [
    { id: "coal",    name: "Coal",    leader: "Roark",        location: "Oreburgh City" },
    { id: "forest",  name: "Forest",  leader: "Gardenia",     location: "Eterna City" },
    { id: "cobble",  name: "Cobble",  leader: "Maylene",      location: "Veilstone City" },
    { id: "fen",     name: "Fen",     leader: "Crasher Wake", location: "Pastoria City" },
    { id: "relic",   name: "Relic",   leader: "Fantina",      location: "Hearthome City" },
    { id: "mine",    name: "Mine",    leader: "Byron",        location: "Canalave City" },
    { id: "icicle",  name: "Icicle",  leader: "Candice",      location: "Snowpoint City" },
    { id: "beacon",  name: "Beacon",  leader: "Volkner",      location: "Sunyshore City" },
  ],

  "heartgold-soulsilver": [
    // Johto
    { id: "zephyr",   name: "Zephyr",   leader: "Falkner", location: "Violet City" },
    { id: "hive",     name: "Hive",     leader: "Bugsy",   location: "Azalea Town" },
    { id: "plain",    name: "Plain",    leader: "Whitney",  location: "Goldenrod City" },
    { id: "fog",      name: "Fog",      leader: "Morty",   location: "Ecruteak City" },
    { id: "storm",    name: "Storm",    leader: "Chuck",   location: "Cianwood City" },
    { id: "mineral",  name: "Mineral",  leader: "Jasmine", location: "Olivine City" },
    { id: "glacier",  name: "Glacier",  leader: "Pryce",   location: "Mahogany Town" },
    { id: "rising",   name: "Rising",   leader: "Clair",   location: "Blackthorn City" },
    // Kanto
    { id: "boulder",  name: "Boulder",  leader: "Brock",   location: "Pewter City" },
    { id: "cascade",  name: "Cascade",  leader: "Misty",   location: "Cerulean City" },
    { id: "thunder",  name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City" },
    { id: "rainbow",  name: "Rainbow",  leader: "Erika",   location: "Celadon City" },
    { id: "soul",     name: "Soul",     leader: "Koga",    location: "Fuchsia City" },
    { id: "marsh",    name: "Marsh",    leader: "Sabrina", location: "Saffron City" },
    { id: "volcano",  name: "Volcano",  leader: "Blaine",  location: "Cinnabar Island" },
    { id: "earth",    name: "Earth",    leader: "Blue",    location: "Viridian City" },
  ],

  "black-white": [
    { id: "trio",   name: "Trio",   leader: "Cilan / Chili / Cress", location: "Striaton City" },
    { id: "basic",  name: "Basic",  leader: "Lenora",  location: "Nacrene City" },
    { id: "insect", name: "Insect", leader: "Burgh",   location: "Castelia City" },
    { id: "bolt",   name: "Bolt",   leader: "Elesa",   location: "Nimbasa City" },
    { id: "quake",  name: "Quake",  leader: "Clay",    location: "Driftveil City" },
    { id: "jet",    name: "Jet",    leader: "Skyla",   location: "Mistralton City" },
    { id: "freeze", name: "Freeze", leader: "Brycen",  location: "Icirrus City" },
    { id: "legend", name: "Legend", leader: "Drayden / Iris", location: "Opelucid City" },
  ],

  "black2-white2": [
    { id: "basic",  name: "Basic",  leader: "Cheren",  location: "Aspertia City" },
    { id: "toxic",  name: "Toxic",  leader: "Roxie",   location: "Virbank City" },
    { id: "insect", name: "Insect", leader: "Burgh",   location: "Castelia City" },
    { id: "bolt",   name: "Bolt",   leader: "Elesa",   location: "Nimbasa City" },
    { id: "quake",  name: "Quake",  leader: "Clay",    location: "Driftveil City" },
    { id: "jet",    name: "Jet",    leader: "Skyla",   location: "Mistralton City" },
    { id: "legend", name: "Legend", leader: "Drayden", location: "Opelucid City" },
    { id: "wave",   name: "Wave",   leader: "Marlon",  location: "Humilau City" },
  ],

  "x-y": [
    { id: "bug",     name: "Bug",     leader: "Viola",   location: "Santalune City" },
    { id: "cliff",   name: "Cliff",   leader: "Grant",   location: "Cyllage City" },
    { id: "rumble",  name: "Rumble",  leader: "Korrina", location: "Shalour City" },
    { id: "plant",   name: "Plant",   leader: "Ramos",   location: "Coumarine City" },
    { id: "voltage", name: "Voltage", leader: "Clemont", location: "Lumiose City" },
    { id: "fairy",   name: "Fairy",   leader: "Valerie", location: "Laverre City" },
    { id: "psychic", name: "Psychic", leader: "Olympia", location: "Anistar City" },
    { id: "iceberg", name: "Iceberg", leader: "Wulfric", location: "Snowbelle City" },
  ],

  "omega-ruby-alpha-sapphire": [
    { id: "stone",   name: "Stone",   leader: "Roxanne", location: "Rustboro City" },
    { id: "knuckle", name: "Knuckle", leader: "Brawly",  location: "Dewford Town" },
    { id: "dynamo",  name: "Dynamo",  leader: "Wattson", location: "Mauville City" },
    { id: "heat",    name: "Heat",    leader: "Flannery", location: "Lavaridge Town" },
    { id: "balance", name: "Balance", leader: "Norman",  location: "Petalburg City" },
    { id: "feather", name: "Feather", leader: "Winona",  location: "Fortree City" },
    { id: "mind",    name: "Mind",    leader: "Tate & Liza", location: "Mossdeep City" },
    { id: "rain",    name: "Rain",    leader: "Wallace", location: "Sootopolis City" },
  ],

  "sun-moon": [
    { id: "ilima",     name: "Ilima Trial",    leader: "Ilima",   location: "Verdant Cavern" },
    { id: "hala",      name: "Melemele Grand Trial", leader: "Hala",  location: "Iki Town" },
    { id: "lana",      name: "Lana Trial",     leader: "Lana",    location: "Brooklet Hill" },
    { id: "kiawe",     name: "Kiawe Trial",    leader: "Kiawe",   location: "Wela Volcano Park" },
    { id: "mallow",    name: "Mallow Trial",   leader: "Mallow",  location: "Lush Jungle" },
    { id: "olivia",    name: "Akala Grand Trial", leader: "Olivia", location: "Ruins of Life" },
    { id: "sophocles", name: "Sophocles Trial", leader: "Sophocles", location: "Hokulani Observatory" },
    { id: "acerola",   name: "Acerola Trial",  leader: "Acerola", location: "Thrifty Megamart" },
    { id: "nanu",      name: "Ula'ula Grand Trial", leader: "Nanu", location: "Po Town" },
    { id: "hapu",      name: "Poni Grand Trial", leader: "Hapu",  location: "Exeggutor Island" },
  ],

  "ultra-sun-ultra-moon": [
    { id: "ilima",     name: "Ilima Trial",    leader: "Ilima",   location: "Verdant Cavern" },
    { id: "hala",      name: "Melemele Grand Trial", leader: "Hala",  location: "Iki Town" },
    { id: "lana",      name: "Lana Trial",     leader: "Lana",    location: "Brooklet Hill" },
    { id: "kiawe",     name: "Kiawe Trial",    leader: "Kiawe",   location: "Wela Volcano Park" },
    { id: "mallow",    name: "Mallow Trial",   leader: "Mallow",  location: "Lush Jungle" },
    { id: "olivia",    name: "Akala Grand Trial", leader: "Olivia", location: "Ruins of Life" },
    { id: "sophocles", name: "Sophocles Trial", leader: "Sophocles", location: "Hokulani Observatory" },
    { id: "acerola",   name: "Acerola Trial",  leader: "Acerola", location: "Thrifty Megamart" },
    { id: "nanu",      name: "Ula'ula Grand Trial", leader: "Nanu", location: "Po Town" },
    { id: "mina",      name: "Mina Trial",     leader: "Mina",    location: "Poni Island" },
    { id: "hapu",      name: "Poni Grand Trial", leader: "Hapu",  location: "Vast Poni Canyon" },
  ],

  "lets-go": [
    { id: "boulder", name: "Boulder",  leader: "Brock",    location: "Pewter City" },
    { id: "cascade", name: "Cascade",  leader: "Misty",    location: "Cerulean City" },
    { id: "thunder", name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City" },
    { id: "rainbow", name: "Rainbow",  leader: "Erika",    location: "Celadon City" },
    { id: "soul",    name: "Soul",     leader: "Koga",     location: "Fuchsia City" },
    { id: "marsh",   name: "Marsh",    leader: "Sabrina",  location: "Saffron City" },
    { id: "volcano", name: "Volcano",  leader: "Blaine",   location: "Cinnabar Island" },
    { id: "earth",   name: "Earth",    leader: "Giovanni", location: "Viridian City" },
  ],

  "sword-shield": [
    { id: "grass",    name: "Grass",    leader: "Milo",    location: "Turffield" },
    { id: "water",    name: "Water",    leader: "Nessa",   location: "Hulbury" },
    { id: "fire",     name: "Fire",     leader: "Kabu",    location: "Motostoke" },
    { id: "ghost",    name: "Ghost / Fighting", leader: "Allister / Bea", location: "Stow-on-Side" },
    { id: "fairy",    name: "Fairy",    leader: "Opal",    location: "Ballonlea" },
    { id: "rock",     name: "Rock / Ice", leader: "Gordie / Melony", location: "Circhester" },
    { id: "dark",     name: "Dark",     leader: "Piers",   location: "Spikemuth" },
    { id: "dragon",   name: "Dragon",   leader: "Raihan",  location: "Hammerlocke" },
  ],

  "brilliant-diamond-shining-pearl": [
    { id: "coal",    name: "Coal",    leader: "Roark",        location: "Oreburgh City" },
    { id: "forest",  name: "Forest",  leader: "Gardenia",     location: "Eterna City" },
    { id: "cobble",  name: "Cobble",  leader: "Maylene",      location: "Veilstone City" },
    { id: "fen",     name: "Fen",     leader: "Crasher Wake", location: "Pastoria City" },
    { id: "relic",   name: "Relic",   leader: "Fantina",      location: "Hearthome City" },
    { id: "mine",    name: "Mine",    leader: "Byron",        location: "Canalave City" },
    { id: "icicle",  name: "Icicle",  leader: "Candice",      location: "Snowpoint City" },
    { id: "beacon",  name: "Beacon",  leader: "Volkner",      location: "Sunyshore City" },
  ],

  "legends-arceus": [
    { id: "kleavor",   name: "Kleavor",   leader: "Lord Kleavor",   location: "Crimson Mirelands" },
    { id: "lilligant", name: "Lilligant", leader: "Lady Lilligant", location: "Cobalt Coastlands" },
    { id: "arcanine",  name: "Arcanine",  leader: "Lord Arcanine",  location: "Cobalt Coastlands" },
    { id: "electrode", name: "Electrode", leader: "Lord Electrode", location: "Coronet Highlands" },
    { id: "avalugg",   name: "Avalugg",   leader: "Lord Avalugg",   location: "Alabaster Icelands" },
    { id: "origin",    name: "Origin Forme Battle", leader: "Palkia / Dialga", location: "Temple of Sinnoh" },
  ],

  "scarlet-violet": [
    { id: "bug",      name: "Bug",      leader: "Katy",    location: "Cortondo" },
    { id: "grass",    name: "Grass",    leader: "Brassius", location: "Artazon" },
    { id: "electric", name: "Electric", leader: "Iono",    location: "Levincia" },
    { id: "water",    name: "Water",    leader: "Kofu",    location: "Cascarrafa" },
    { id: "normal",   name: "Normal",   leader: "Larry",   location: "Medali" },
    { id: "ghost",    name: "Ghost",    leader: "Ryme",    location: "Montenevera" },
    { id: "psychic",  name: "Psychic",  leader: "Tulip",   location: "Alfornada" },
    { id: "ice",      name: "Ice",      leader: "Grusha",  location: "Glaseado" },
  ],
};

/** Game groups that use Trials instead of Badges. */
export const TRIAL_GAME_GROUPS = new Set(["sun-moon", "ultra-sun-ultra-moon"]);

// ─── Individual version list (used in Playthroughs form) ─────────────────────

/** One entry per individual game version, with its parent group for data lookups. */
export const PLAYTHROUGH_VERSIONS: Array<{ value: string; label: string; group: string }> = [
  // Gen I
  { value: "red",    label: "Red",    group: "red-blue-yellow" },
  { value: "blue",   label: "Blue",   group: "red-blue-yellow" },
  { value: "yellow", label: "Yellow", group: "red-blue-yellow" },
  // Gen II
  { value: "gold",    label: "Gold",    group: "gold-silver-crystal" },
  { value: "silver",  label: "Silver",  group: "gold-silver-crystal" },
  { value: "crystal", label: "Crystal", group: "gold-silver-crystal" },
  // Gen III
  { value: "ruby",      label: "Ruby",      group: "ruby-sapphire-emerald" },
  { value: "sapphire",  label: "Sapphire",  group: "ruby-sapphire-emerald" },
  { value: "emerald",   label: "Emerald",   group: "ruby-sapphire-emerald" },
  { value: "firered",   label: "FireRed",   group: "firered-leafgreen" },
  { value: "leafgreen", label: "LeafGreen", group: "firered-leafgreen" },
  // Gen IV
  { value: "diamond",    label: "Diamond",    group: "diamond-pearl-platinum" },
  { value: "pearl",      label: "Pearl",      group: "diamond-pearl-platinum" },
  { value: "platinum",   label: "Platinum",   group: "diamond-pearl-platinum" },
  { value: "heartgold",  label: "HeartGold",  group: "heartgold-soulsilver" },
  { value: "soulsilver", label: "SoulSilver", group: "heartgold-soulsilver" },
  // Gen V
  { value: "black",   label: "Black",   group: "black-white" },
  { value: "white",   label: "White",   group: "black-white" },
  { value: "black-2", label: "Black 2", group: "black2-white2" },
  { value: "white-2", label: "White 2", group: "black2-white2" },
  // Gen VI
  { value: "x",              label: "X",              group: "x-y" },
  { value: "y",              label: "Y",              group: "x-y" },
  { value: "omega-ruby",     label: "Omega Ruby",     group: "omega-ruby-alpha-sapphire" },
  { value: "alpha-sapphire", label: "Alpha Sapphire", group: "omega-ruby-alpha-sapphire" },
  // Gen VII
  { value: "sun",             label: "Sun",                group: "sun-moon" },
  { value: "moon",            label: "Moon",               group: "sun-moon" },
  { value: "ultra-sun",       label: "Ultra Sun",          group: "ultra-sun-ultra-moon" },
  { value: "ultra-moon",      label: "Ultra Moon",         group: "ultra-sun-ultra-moon" },
  { value: "lets-go-pikachu", label: "Let's Go, Pikachu!", group: "lets-go" },
  { value: "lets-go-eevee",   label: "Let's Go, Eevee!",   group: "lets-go" },
  // Gen VIII
  { value: "sword",             label: "Sword",             group: "sword-shield" },
  { value: "shield",            label: "Shield",            group: "sword-shield" },
  { value: "brilliant-diamond", label: "Brilliant Diamond", group: "brilliant-diamond-shining-pearl" },
  { value: "shining-pearl",     label: "Shining Pearl",     group: "brilliant-diamond-shining-pearl" },
  { value: "legends-arceus",    label: "Legends: Arceus",   group: "legends-arceus" },
  // Gen IX
  { value: "scarlet", label: "Scarlet", group: "scarlet-violet" },
  { value: "violet",  label: "Violet",  group: "scarlet-violet" },
];

/** Maps individual version slug → game group (for badge/route-data lookups). */
export const VERSION_TO_GAME_GROUP: Record<string, string> = Object.fromEntries(
  PLAYTHROUGH_VERSIONS.map((v) => [v.value, v.group]),
);

/** Maps individual version slug → display label ("emerald" → "Emerald"). */
export const VERSION_DISPLAY_LABEL: Record<string, string> = Object.fromEntries(
  PLAYTHROUGH_VERSIONS.map((v) => [v.value, v.label]),
);

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "porylist-playthroughs-v1";

/**
 * Old playthroughs stored gameValue as a game-group slug (e.g. "ruby-sapphire-emerald").
 * Migrate them to the first individual version in that group.
 */
const GROUP_TO_FIRST_VERSION: Record<string, string> = {
  "red-blue-yellow":              "red",
  "gold-silver-crystal":          "gold",
  "ruby-sapphire-emerald":        "ruby",
  "firered-leafgreen":            "firered",
  "diamond-pearl-platinum":       "diamond",
  "heartgold-soulsilver":         "heartgold",
  "black-white":                  "black",
  "black2-white2":                "black-2",
  "x-y":                          "x",
  "omega-ruby-alpha-sapphire":    "omega-ruby",
  "sun-moon":                     "sun",
  "ultra-sun-ultra-moon":         "ultra-sun",
  "lets-go":                      "lets-go-pikachu",
  "sword-shield":                 "sword",
  "brilliant-diamond-shining-pearl": "brilliant-diamond",
  "legends-arceus":               "legends-arceus",
  "scarlet-violet":               "scarlet",
};

export function loadPlaythroughs(): Playthrough[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Playthrough[];
    // Migrate old group-based gameValues to individual version slugs
    // and backfill nuzlocke field for playthroughs created before it existed
    return list.map((p) => ({
      ...p,
      gameValue: GROUP_TO_FIRST_VERSION[p.gameValue] ?? p.gameValue,
      nuzlocke: (p.nuzlocke as NuzlockeOptions | undefined) ?? { ...DEFAULT_NUZLOCKE },
    }));
  } catch {
    return [];
  }
}

export function savePlaythroughs(list: Playthrough[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function newPlaythroughId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
