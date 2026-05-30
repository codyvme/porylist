// Types, constants, and storage for the Playthroughs tracker.

export interface Badge {
  id: string;
  name: string;
  /** Gym leader / kahuna / captain name */
  leader?: string;
  /** City / town */
  location?: string;
  /** Bulbapedia CDN image URL */
  image?: string;
  /**
   * Level of the leader's strongest Pokémon ("ace"). Used to compute the
   * Nuzlocke level cap — typically the cap is the next un-defeated boss's
   * ace. Left undefined for badges where the canonical ace level isn't
   * well-defined (e.g. open-world Scarlet/Violet, Legends games, Trials).
   */
  aceLevel?: number;
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

/**
 * One Pokémon encounter in a Nuzlocke run — typically the first encounter on
 * a given route. Status transitions: caught → boxed/team → fainted.
 * "missed" covers fleeing/KO'd-by-mistake encounters so the route still gets
 * "burned" under first-encounter-only rules.
 */
export interface EncounterRecord {
  id: string;
  /** Route/area key (matches the keys used in route-data files) */
  locationKey: string;
  /** Display name for the route — denormalized so we don't need route-data to render history */
  locationName: string;
  /** PokéAPI species slug (e.g. "pikachu"). Empty for missed encounters. */
  species: string;
  status: "team" | "boxed" | "fainted" | "missed";
  nickname?: string;
  /** Level when caught */
  level?: number;
  /** Level when it fainted (for the cemetery view) */
  faintedAtLevel?: number;
  /** What KO'd it (e.g. "Whitney's Miltank") */
  faintedTo?: string;
  notes?: string;
  /** Timestamps */
  createdAt: number;
  updatedAt: number;
}

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
  /** Per-route Nuzlocke encounter log (optional; absent on non-Nuzlocke runs) */
  encounters?: EncounterRecord[];
  /**
   * The user's current team for this playthrough — up to 6 entries. Each
   * holds the PokéAPI species slug plus an optional nickname so people who
   * nickname their teammates can see them as such. Independent from the
   * global Team Builder.
   */
  team?: TeamMember[];
  createdAt: number;
  updatedAt: number;
}

export interface TeamMember {
  /** PokéAPI species slug (e.g. "garchomp"). */
  species: string;
  /** Optional player-chosen nickname. */
  nickname?: string;
}

/**
 * Returns the active level cap for a playthrough: the ace level of the next
 * un-defeated badge in the GAME_BADGES list. Returns null when caps aren't
 * known for this game, or when the run is already complete. Also returns the
 * leader's known type specialty (when defined) for downstream display.
 */
export function currentLevelCap(playthrough: Playthrough): {
  cap: number;
  nextBadge: Badge;
  typeSpecialty: string | null;
} | null {
  // Resolve via group key — playthrough.gameValue is a version slug like
  // "crystal" but GAME_BADGES is keyed by group ("gold-silver-crystal").
  const group = VERSION_TO_GAME_GROUP[playthrough.gameValue] ?? playthrough.gameValue;
  const badges = GAME_BADGES[group];
  if (!badges) return null;
  const earned = new Set(playthrough.earnedBadges);
  for (const badge of badges) {
    if (earned.has(badge.id)) continue;
    if (badge.aceLevel == null) return null;
    return {
      cap: badge.aceLevel,
      nextBadge: badge,
      typeSpecialty: BADGE_TYPE_SPECIALTY[group]?.[badge.id] ?? null,
    };
  }
  return null;
}

/**
 * The "type" each gym leader / kahuna specializes in, keyed by (group,
 * badgeId). Mixed-type leaders (e.g. the Striaton trio, Blue in GSC/HGSS,
 * the version-paired SwSh leaders) are deliberately omitted — they have no
 * single specialty to call out.
 */
export const BADGE_TYPE_SPECIALTY: Record<string, Record<string, string>> = {
  "red-blue-yellow": {
    boulder: "rock", cascade: "water", thunder: "electric", rainbow: "grass",
    soul: "poison", marsh: "psychic", volcano: "fire", earth: "ground",
  },
  "firered-leafgreen": {
    boulder: "rock", cascade: "water", thunder: "electric", rainbow: "grass",
    soul: "poison", marsh: "psychic", volcano: "fire", earth: "ground",
  },
  "lets-go": {
    boulder: "rock", cascade: "water", thunder: "electric", rainbow: "grass",
    soul: "poison", marsh: "psychic", volcano: "fire", earth: "ground",
  },
  "gold-silver-crystal": {
    zephyr: "flying", hive: "bug", plain: "normal", fog: "ghost",
    storm: "fighting", mineral: "steel", glacier: "ice", rising: "dragon",
    boulder: "rock", cascade: "water", thunder: "electric", rainbow: "grass",
    soul: "poison", marsh: "psychic", volcano: "fire",
    // Blue uses a mixed team — omit.
  },
  "heartgold-soulsilver": {
    zephyr: "flying", hive: "bug", plain: "normal", fog: "ghost",
    storm: "fighting", mineral: "steel", glacier: "ice", rising: "dragon",
    boulder: "rock", cascade: "water", thunder: "electric", rainbow: "grass",
    soul: "poison", marsh: "psychic", volcano: "fire",
  },
  "ruby-sapphire-emerald": {
    stone: "rock", knuckle: "fighting", dynamo: "electric", heat: "fire",
    balance: "normal", feather: "flying", mind: "psychic", rain: "water",
  },
  "omega-ruby-alpha-sapphire": {
    stone: "rock", knuckle: "fighting", dynamo: "electric", heat: "fire",
    balance: "normal", feather: "flying", mind: "psychic", rain: "water",
  },
  "diamond-pearl-platinum": {
    coal: "rock", forest: "grass", cobble: "fighting", fen: "water",
    relic: "ghost", mine: "steel", icicle: "ice", beacon: "electric",
  },
  "brilliant-diamond-shining-pearl": {
    coal: "rock", forest: "grass", cobble: "fighting", fen: "water",
    relic: "ghost", mine: "steel", icicle: "ice", beacon: "electric",
  },
  "black-white": {
    // Striaton trio is mixed — omit "trio"
    basic: "normal", insect: "bug", bolt: "electric", quake: "ground",
    jet: "flying", freeze: "ice", legend: "dragon",
  },
  "black2-white2": {
    basic: "normal", toxic: "poison", insect: "bug", bolt: "electric",
    quake: "ground", jet: "flying", legend: "dragon", wave: "water",
  },
  "x-y": {
    bug: "bug", cliff: "rock", rumble: "fighting", plant: "grass",
    voltage: "electric", fairy: "fairy", psychic: "psychic", iceberg: "ice",
  },
  "sword-shield": {
    grass: "grass", water: "water", fire: "fire", fairy: "fairy",
    dark: "dark", dragon: "dragon",
    // ghost/fighting and rock/ice slots vary by version — omit
  },
  "scarlet-violet": {
    bug: "bug", grass: "grass", electric: "electric", water: "water",
    normal: "normal", ghost: "ghost", psychic: "psychic", ice: "ice",
  },
};

export function newEncounterId(): string {
  return `enc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Migrates whatever shape was previously persisted into the current
 * TeamMember[] form. Accepts:
 *   - missing/null/non-array → []
 *   - string[]              → [{ species: name }, …]    (pre-nickname format)
 *   - TeamMember[]          → trimmed to 6 + species coerced to string
 */
export function normalizeTeam(raw: unknown): TeamMember[] {
  if (!Array.isArray(raw)) return [];
  const out: TeamMember[] = [];
  for (const entry of raw) {
    if (out.length >= 6) break;
    if (typeof entry === "string") {
      if (entry) out.push({ species: entry });
    } else if (entry && typeof entry === "object" && typeof (entry as { species?: unknown }).species === "string") {
      const e = entry as TeamMember;
      out.push({
        species: e.species,
        nickname: typeof e.nickname === "string" && e.nickname.trim() ? e.nickname : undefined,
      });
    }
  }
  return out;
}

// ─── Badge data per game ──────────────────────────────────────────────────────

// Badge images are committed to public/images/badges/ to avoid CORS/hotlink issues
const B = "/images/badges";
// Kanto badge images (shared across RBY, FRLG, LGPE, and Kanto half of GSC/HGSS)
const KANTO: Record<string, string> = {
  boulder: `${B}/Boulder_Badge.png`,
  cascade: `${B}/Cascade_Badge.png`,
  thunder: `${B}/Thunder_Badge.png`,
  rainbow: `${B}/Rainbow_Badge.png`,
  soul:    `${B}/Soul_Badge.png`,
  marsh:   `${B}/Marsh_Badge.png`,
  volcano: `${B}/Volcano_Badge.png`,
  earth:   `${B}/Earth_Badge.png`,
};
// Johto badge images
const JOHTO: Record<string, string> = {
  zephyr:  `${B}/Zephyr_Badge.png`,
  hive:    `${B}/Hive_Badge.png`,
  plain:   `${B}/Plain_Badge.png`,
  fog:     `${B}/Fog_Badge.png`,
  storm:   `${B}/Storm_Badge.png`,
  mineral: `${B}/Mineral_Badge.png`,
  glacier: `${B}/Glacier_Badge.png`,
  rising:  `${B}/Rising_Badge.png`,
};
// Hoenn badge images
const HOENN: Record<string, string> = {
  stone:   `${B}/Stone_Badge.png`,
  knuckle: `${B}/Knuckle_Badge.png`,
  dynamo:  `${B}/Dynamo_Badge.png`,
  heat:    `${B}/Heat_Badge.png`,
  balance: `${B}/Balance_Badge.png`,
  feather: `${B}/Feather_Badge.png`,
  mind:    `${B}/Mind_Badge.png`,
  rain:    `${B}/Rain_Badge.png`,
};
// Sinnoh badge images
const SINNOH: Record<string, string> = {
  coal:   `${B}/Coal_Badge.png`,
  forest: `${B}/Forest_Badge.png`,
  cobble: `${B}/Cobble_Badge.png`,
  fen:    `${B}/Fen_Badge.png`,
  relic:  `${B}/Relic_Badge.png`,
  mine:   `${B}/Mine_Badge.png`,
  icicle: `${B}/Icicle_Badge.png`,
  beacon: `${B}/Beacon_Badge.png`,
};
// Unova badge images
const UNOVA: Record<string, string> = {
  trio:   `${B}/Trio_Badge.png`,
  basic:  `${B}/Basic_Badge.png`,
  insect: `${B}/Insect_Badge.png`,
  bolt:   `${B}/Bolt_Badge.png`,
  quake:  `${B}/Quake_Badge.png`,
  jet:    `${B}/Jet_Badge.png`,
  freeze: `${B}/Freeze_Badge.png`,
  legend: `${B}/Legend_Badge.png`,
  toxic:  `${B}/Toxic_Badge.png`,
  wave:   `${B}/Wave_Badge.png`,
};
// Kalos badge images
const KALOS: Record<string, string> = {
  bug:     `${B}/Bug_Badge.png`,
  cliff:   `${B}/Cliff_Badge.png`,
  rumble:  `${B}/Rumble_Badge.png`,
  plant:   `${B}/Plant_Badge.png`,
  voltage: `${B}/Voltage_Badge.png`,
  fairy:   `${B}/Fairy_Badge.png`,
  psychic: `${B}/Psychic_Badge.png`,
  iceberg: `${B}/Iceberg_Badge.png`,
};
// Galar badge images
const GALAR: Record<string, string> = {
  grass:  `${B}/Grass_Badge.png`,
  water:  `${B}/Water_Badge.png`,
  fire:   `${B}/Fire_Badge.png`,
  ghost:  `${B}/Ghost_Badge.png`,
  fairy:  `${B}/GalarFairy_Badge.png`,
  rock:   `${B}/Rock_Badge.png`,
  dark:   `${B}/Dark_Badge.png`,
  dragon: `${B}/Dragon_Badge.png`,
};
// Paldea badge images
const PALDEA: Record<string, string> = {
  electric: `${B}/SVbadge_VictoryRoad_Electric.png`,
  normal:   `${B}/SVbadge_VictoryRoad_Normal.png`,
};

export const GAME_BADGES: Record<string, Badge[]> = {
  "red-blue-yellow": [
    { id: "boulder", name: "Boulder",  leader: "Brock",    location: "Pewter City",      image: KANTO.boulder, aceLevel: 14 },
    { id: "cascade", name: "Cascade",  leader: "Misty",    location: "Cerulean City",    image: KANTO.cascade, aceLevel: 21 },
    { id: "thunder", name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City",  image: KANTO.thunder, aceLevel: 24 },
    { id: "rainbow", name: "Rainbow",  leader: "Erika",    location: "Celadon City",     image: KANTO.rainbow, aceLevel: 29 },
    { id: "soul",    name: "Soul",     leader: "Koga",     location: "Fuchsia City",     image: KANTO.soul,    aceLevel: 43 },
    { id: "marsh",   name: "Marsh",    leader: "Sabrina",  location: "Saffron City",     image: KANTO.marsh,   aceLevel: 50 },
    { id: "volcano", name: "Volcano",  leader: "Blaine",   location: "Cinnabar Island",  image: KANTO.volcano, aceLevel: 47 },
    { id: "earth",   name: "Earth",    leader: "Giovanni", location: "Viridian City",    image: KANTO.earth,   aceLevel: 50 },
  ],

  "gold-silver-crystal": [
    // Johto
    { id: "zephyr",   name: "Zephyr",   leader: "Falkner", location: "Violet City",      image: JOHTO.zephyr,  aceLevel: 9  },
    { id: "hive",     name: "Hive",     leader: "Bugsy",   location: "Azalea Town",      image: JOHTO.hive,    aceLevel: 16 },
    { id: "plain",    name: "Plain",    leader: "Whitney",  location: "Goldenrod City",  image: JOHTO.plain,   aceLevel: 20 },
    { id: "fog",      name: "Fog",      leader: "Morty",   location: "Ecruteak City",    image: JOHTO.fog,     aceLevel: 25 },
    { id: "storm",    name: "Storm",    leader: "Chuck",   location: "Cianwood City",    image: JOHTO.storm,   aceLevel: 30 },
    { id: "mineral",  name: "Mineral",  leader: "Jasmine", location: "Olivine City",     image: JOHTO.mineral, aceLevel: 35 },
    { id: "glacier",  name: "Glacier",  leader: "Pryce",   location: "Mahogany Town",    image: JOHTO.glacier, aceLevel: 34 },
    { id: "rising",   name: "Rising",   leader: "Clair",   location: "Blackthorn City",  image: JOHTO.rising,  aceLevel: 41 },
    // Kanto
    { id: "boulder",  name: "Boulder",  leader: "Brock",   location: "Pewter City",      image: KANTO.boulder, aceLevel: 50 },
    { id: "cascade",  name: "Cascade",  leader: "Misty",   location: "Cerulean City",    image: KANTO.cascade, aceLevel: 54 },
    { id: "thunder",  name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City", image: KANTO.thunder, aceLevel: 53 },
    { id: "rainbow",  name: "Rainbow",  leader: "Erika",   location: "Celadon City",     image: KANTO.rainbow, aceLevel: 56 },
    { id: "soul",     name: "Soul",     leader: "Koga",    location: "Fuchsia City",     image: KANTO.soul,    aceLevel: 58 },
    { id: "marsh",    name: "Marsh",    leader: "Sabrina", location: "Saffron City",     image: KANTO.marsh,   aceLevel: 60 },
    { id: "volcano",  name: "Volcano",  leader: "Blaine",  location: "Cinnabar Island",  image: KANTO.volcano, aceLevel: 58 },
    { id: "earth",    name: "Earth",    leader: "Blue",    location: "Viridian City",    image: KANTO.earth,   aceLevel: 61 },
  ],

  "ruby-sapphire-emerald": [
    { id: "stone",   name: "Stone",   leader: "Roxanne", location: "Rustboro City",       image: HOENN.stone,   aceLevel: 15 },
    { id: "knuckle", name: "Knuckle", leader: "Brawly",  location: "Dewford Town",        image: HOENN.knuckle, aceLevel: 19 },
    { id: "dynamo",  name: "Dynamo",  leader: "Wattson", location: "Mauville City",       image: HOENN.dynamo,  aceLevel: 24 },
    { id: "heat",    name: "Heat",    leader: "Flannery", location: "Lavaridge Town",     image: HOENN.heat,    aceLevel: 29 },
    { id: "balance", name: "Balance", leader: "Norman",  location: "Petalburg City",      image: HOENN.balance, aceLevel: 31 },
    { id: "feather", name: "Feather", leader: "Winona",  location: "Fortree City",        image: HOENN.feather, aceLevel: 33 },
    { id: "mind",    name: "Mind",    leader: "Tate & Liza", location: "Mossdeep City",   image: HOENN.mind,    aceLevel: 42 },
    { id: "rain",    name: "Rain",    leader: "Wallace", location: "Sootopolis City",     image: HOENN.rain,    aceLevel: 43 },
  ],

  "firered-leafgreen": [
    { id: "boulder", name: "Boulder",  leader: "Brock",    location: "Pewter City",     image: KANTO.boulder, aceLevel: 14 },
    { id: "cascade", name: "Cascade",  leader: "Misty",    location: "Cerulean City",   image: KANTO.cascade, aceLevel: 21 },
    { id: "thunder", name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City", image: KANTO.thunder, aceLevel: 28 },
    { id: "rainbow", name: "Rainbow",  leader: "Erika",    location: "Celadon City",    image: KANTO.rainbow, aceLevel: 32 },
    { id: "soul",    name: "Soul",     leader: "Koga",     location: "Fuchsia City",    image: KANTO.soul,    aceLevel: 43 },
    { id: "marsh",   name: "Marsh",    leader: "Sabrina",  location: "Saffron City",    image: KANTO.marsh,   aceLevel: 50 },
    { id: "volcano", name: "Volcano",  leader: "Blaine",   location: "Cinnabar Island", image: KANTO.volcano, aceLevel: 48 },
    { id: "earth",   name: "Earth",    leader: "Giovanni", location: "Viridian City",   image: KANTO.earth,   aceLevel: 50 },
  ],

  "diamond-pearl-platinum": [
    { id: "coal",    name: "Coal",    leader: "Roark",        location: "Oreburgh City",  image: SINNOH.coal,   aceLevel: 14 },
    { id: "forest",  name: "Forest",  leader: "Gardenia",     location: "Eterna City",    image: SINNOH.forest, aceLevel: 22 },
    { id: "cobble",  name: "Cobble",  leader: "Maylene",      location: "Veilstone City", image: SINNOH.cobble, aceLevel: 32 },
    { id: "fen",     name: "Fen",     leader: "Crasher Wake", location: "Pastoria City",  image: SINNOH.fen,    aceLevel: 37 },
    { id: "relic",   name: "Relic",   leader: "Fantina",      location: "Hearthome City", image: SINNOH.relic,  aceLevel: 36 },
    { id: "mine",    name: "Mine",    leader: "Byron",        location: "Canalave City",  image: SINNOH.mine,   aceLevel: 41 },
    { id: "icicle",  name: "Icicle",  leader: "Candice",      location: "Snowpoint City", image: SINNOH.icicle, aceLevel: 42 },
    { id: "beacon",  name: "Beacon",  leader: "Volkner",      location: "Sunyshore City", image: SINNOH.beacon, aceLevel: 49 },
  ],

  "heartgold-soulsilver": [
    // Johto
    { id: "zephyr",   name: "Zephyr",   leader: "Falkner", location: "Violet City",      image: JOHTO.zephyr,  aceLevel: 9  },
    { id: "hive",     name: "Hive",     leader: "Bugsy",   location: "Azalea Town",      image: JOHTO.hive,    aceLevel: 17 },
    { id: "plain",    name: "Plain",    leader: "Whitney",  location: "Goldenrod City",  image: JOHTO.plain,   aceLevel: 19 },
    { id: "fog",      name: "Fog",      leader: "Morty",   location: "Ecruteak City",    image: JOHTO.fog,     aceLevel: 24 },
    { id: "storm",    name: "Storm",    leader: "Chuck",   location: "Cianwood City",    image: JOHTO.storm,   aceLevel: 30 },
    { id: "mineral",  name: "Mineral",  leader: "Jasmine", location: "Olivine City",     image: JOHTO.mineral, aceLevel: 35 },
    { id: "glacier",  name: "Glacier",  leader: "Pryce",   location: "Mahogany Town",    image: JOHTO.glacier, aceLevel: 34 },
    { id: "rising",   name: "Rising",   leader: "Clair",   location: "Blackthorn City",  image: JOHTO.rising,  aceLevel: 41 },
    // Kanto
    { id: "boulder",  name: "Boulder",  leader: "Brock",   location: "Pewter City",      image: KANTO.boulder, aceLevel: 51 },
    { id: "cascade",  name: "Cascade",  leader: "Misty",   location: "Cerulean City",    image: KANTO.cascade, aceLevel: 56 },
    { id: "thunder",  name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City", image: KANTO.thunder, aceLevel: 58 },
    { id: "rainbow",  name: "Rainbow",  leader: "Erika",   location: "Celadon City",     image: KANTO.rainbow, aceLevel: 61 },
    { id: "soul",     name: "Soul",     leader: "Koga",    location: "Fuchsia City",     image: KANTO.soul,    aceLevel: 50 },
    { id: "marsh",    name: "Marsh",    leader: "Sabrina", location: "Saffron City",     image: KANTO.marsh,   aceLevel: 65 },
    { id: "volcano",  name: "Volcano",  leader: "Blaine",  location: "Cinnabar Island",  image: KANTO.volcano, aceLevel: 63 },
    { id: "earth",    name: "Earth",    leader: "Blue",    location: "Viridian City",    image: KANTO.earth,   aceLevel: 64 },
  ],

  "black-white": [
    { id: "trio",   name: "Trio",   leader: "Cilan / Chili / Cress", location: "Striaton City",  image: UNOVA.trio,   aceLevel: 14 },
    { id: "basic",  name: "Basic",  leader: "Lenora",  location: "Nacrene City",                  image: UNOVA.basic,  aceLevel: 20 },
    { id: "insect", name: "Insect", leader: "Burgh",   location: "Castelia City",                 image: UNOVA.insect, aceLevel: 24 },
    { id: "bolt",   name: "Bolt",   leader: "Elesa",   location: "Nimbasa City",                  image: UNOVA.bolt,   aceLevel: 27 },
    { id: "quake",  name: "Quake",  leader: "Clay",    location: "Driftveil City",                image: UNOVA.quake,  aceLevel: 31 },
    { id: "jet",    name: "Jet",    leader: "Skyla",   location: "Mistralton City",               image: UNOVA.jet,    aceLevel: 39 },
    { id: "freeze", name: "Freeze", leader: "Brycen",  location: "Icirrus City",                  image: UNOVA.freeze, aceLevel: 43 },
    { id: "legend", name: "Legend", leader: "Drayden / Iris", location: "Opelucid City",          image: UNOVA.legend, aceLevel: 48 },
  ],

  "black2-white2": [
    { id: "basic",  name: "Basic",  leader: "Cheren",  location: "Aspertia City",   image: UNOVA.basic,  aceLevel: 13 },
    { id: "toxic",  name: "Toxic",  leader: "Roxie",   location: "Virbank City",    image: UNOVA.toxic,  aceLevel: 18 },
    { id: "insect", name: "Insect", leader: "Burgh",   location: "Castelia City",   image: UNOVA.insect, aceLevel: 22 },
    { id: "bolt",   name: "Bolt",   leader: "Elesa",   location: "Nimbasa City",    image: UNOVA.bolt,   aceLevel: 26 },
    { id: "quake",  name: "Quake",  leader: "Clay",    location: "Driftveil City",  image: UNOVA.quake,  aceLevel: 31 },
    { id: "jet",    name: "Jet",    leader: "Skyla",   location: "Mistralton City", image: UNOVA.jet,    aceLevel: 37 },
    { id: "legend", name: "Legend", leader: "Drayden", location: "Opelucid City",   image: UNOVA.legend, aceLevel: 46 },
    { id: "wave",   name: "Wave",   leader: "Marlon",  location: "Humilau City",    image: UNOVA.wave,   aceLevel: 49 },
  ],

  "x-y": [
    { id: "bug",     name: "Bug",     leader: "Viola",   location: "Santalune City", image: KALOS.bug,     aceLevel: 12 },
    { id: "cliff",   name: "Cliff",   leader: "Grant",   location: "Cyllage City",   image: KALOS.cliff,   aceLevel: 25 },
    { id: "rumble",  name: "Rumble",  leader: "Korrina", location: "Shalour City",   image: KALOS.rumble,  aceLevel: 32 },
    { id: "plant",   name: "Plant",   leader: "Ramos",   location: "Coumarine City", image: KALOS.plant,   aceLevel: 38 },
    { id: "voltage", name: "Voltage", leader: "Clemont", location: "Lumiose City",   image: KALOS.voltage, aceLevel: 37 },
    { id: "fairy",   name: "Fairy",   leader: "Valerie", location: "Laverre City",   image: KALOS.fairy,   aceLevel: 42 },
    { id: "psychic", name: "Psychic", leader: "Olympia", location: "Anistar City",   image: KALOS.psychic, aceLevel: 48 },
    { id: "iceberg", name: "Iceberg", leader: "Wulfric", location: "Snowbelle City", image: KALOS.iceberg, aceLevel: 59 },
  ],

  "omega-ruby-alpha-sapphire": [
    { id: "stone",   name: "Stone",   leader: "Roxanne", location: "Rustboro City",       image: HOENN.stone,   aceLevel: 14 },
    { id: "knuckle", name: "Knuckle", leader: "Brawly",  location: "Dewford Town",        image: HOENN.knuckle, aceLevel: 18 },
    { id: "dynamo",  name: "Dynamo",  leader: "Wattson", location: "Mauville City",       image: HOENN.dynamo,  aceLevel: 22 },
    { id: "heat",    name: "Heat",    leader: "Flannery", location: "Lavaridge Town",     image: HOENN.heat,    aceLevel: 28 },
    { id: "balance", name: "Balance", leader: "Norman",  location: "Petalburg City",      image: HOENN.balance, aceLevel: 30 },
    { id: "feather", name: "Feather", leader: "Winona",  location: "Fortree City",        image: HOENN.feather, aceLevel: 33 },
    { id: "mind",    name: "Mind",    leader: "Tate & Liza", location: "Mossdeep City",   image: HOENN.mind,    aceLevel: 42 },
    { id: "rain",    name: "Rain",    leader: "Wallace", location: "Sootopolis City",     image: HOENN.rain,    aceLevel: 44 },
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
    { id: "boulder", name: "Boulder",  leader: "Brock",    location: "Pewter City",     image: KANTO.boulder, aceLevel: 12 },
    { id: "cascade", name: "Cascade",  leader: "Misty",    location: "Cerulean City",   image: KANTO.cascade, aceLevel: 21 },
    { id: "thunder", name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City", image: KANTO.thunder, aceLevel: 28 },
    { id: "rainbow", name: "Rainbow",  leader: "Erika",    location: "Celadon City",    image: KANTO.rainbow, aceLevel: 32 },
    { id: "soul",    name: "Soul",     leader: "Koga",     location: "Fuchsia City",    image: KANTO.soul,    aceLevel: 37 },
    { id: "marsh",   name: "Marsh",    leader: "Sabrina",  location: "Saffron City",    image: KANTO.marsh,   aceLevel: 45 },
    { id: "volcano", name: "Volcano",  leader: "Blaine",   location: "Cinnabar Island", image: KANTO.volcano, aceLevel: 50 },
    { id: "earth",   name: "Earth",    leader: "Giovanni", location: "Viridian City",   image: KANTO.earth,   aceLevel: 55 },
  ],

  "sword-shield": [
    { id: "grass",    name: "Grass",    leader: "Milo",    location: "Turffield",     image: GALAR.grass,  aceLevel: 20 },
    { id: "water",    name: "Water",    leader: "Nessa",   location: "Hulbury",       image: GALAR.water,  aceLevel: 24 },
    { id: "fire",     name: "Fire",     leader: "Kabu",    location: "Motostoke",     image: GALAR.fire,   aceLevel: 29 },
    { id: "ghost",    name: "Ghost / Fighting", leader: "Allister / Bea", location: "Stow-on-Side", image: GALAR.ghost, aceLevel: 36 },
    { id: "fairy",    name: "Fairy",    leader: "Opal",    location: "Ballonlea",     image: GALAR.fairy,  aceLevel: 39 },
    { id: "rock",     name: "Rock / Ice", leader: "Gordie / Melony", location: "Circhester", image: GALAR.rock, aceLevel: 42 },
    { id: "dark",     name: "Dark",     leader: "Piers",   location: "Spikemuth",     image: GALAR.dark,   aceLevel: 45 },
    { id: "dragon",   name: "Dragon",   leader: "Raihan",  location: "Hammerlocke",   image: GALAR.dragon, aceLevel: 50 },
  ],

  "brilliant-diamond-shining-pearl": [
    { id: "coal",    name: "Coal",    leader: "Roark",        location: "Oreburgh City",  image: SINNOH.coal,   aceLevel: 14 },
    { id: "forest",  name: "Forest",  leader: "Gardenia",     location: "Eterna City",    image: SINNOH.forest, aceLevel: 22 },
    { id: "cobble",  name: "Cobble",  leader: "Maylene",      location: "Veilstone City", image: SINNOH.cobble, aceLevel: 30 },
    { id: "fen",     name: "Fen",     leader: "Crasher Wake", location: "Pastoria City",  image: SINNOH.fen,    aceLevel: 39 },
    { id: "relic",   name: "Relic",   leader: "Fantina",      location: "Hearthome City", image: SINNOH.relic,  aceLevel: 39 },
    { id: "mine",    name: "Mine",    leader: "Byron",        location: "Canalave City",  image: SINNOH.mine,   aceLevel: 39 },
    { id: "icicle",  name: "Icicle",  leader: "Candice",      location: "Snowpoint City", image: SINNOH.icicle, aceLevel: 44 },
    { id: "beacon",  name: "Beacon",  leader: "Volkner",      location: "Sunyshore City", image: SINNOH.beacon, aceLevel: 49 },
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
    // SV is open-world, so cap order is fuzzy — these are based on the
    // official recommended Victory Road order.
    { id: "bug",      name: "Bug",      leader: "Katy",    location: "Cortondo",   aceLevel: 15 },
    { id: "grass",    name: "Grass",    leader: "Brassius", location: "Artazon",   aceLevel: 17 },
    { id: "electric", name: "Electric", leader: "Iono",    location: "Levincia",   image: PALDEA.electric, aceLevel: 24 },
    { id: "water",    name: "Water",    leader: "Kofu",    location: "Cascarrafa", aceLevel: 30 },
    { id: "normal",   name: "Normal",   leader: "Larry",   location: "Medali",     image: PALDEA.normal, aceLevel: 36 },
    { id: "ghost",    name: "Ghost",    leader: "Ryme",    location: "Montenevera", aceLevel: 42 },
    { id: "psychic",  name: "Psychic",  leader: "Tulip",   location: "Alfornada",  aceLevel: 45 },
    { id: "ice",      name: "Ice",      leader: "Grusha",  location: "Glaseado",   aceLevel: 48 },
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
      encounters: Array.isArray(p.encounters) ? p.encounters : undefined,
      team: normalizeTeam(p.team),
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
