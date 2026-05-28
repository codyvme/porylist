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
    { id: "boulder", name: "Boulder",  leader: "Brock",    location: "Pewter City",      image: KANTO.boulder },
    { id: "cascade", name: "Cascade",  leader: "Misty",    location: "Cerulean City",    image: KANTO.cascade },
    { id: "thunder", name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City",  image: KANTO.thunder },
    { id: "rainbow", name: "Rainbow",  leader: "Erika",    location: "Celadon City",     image: KANTO.rainbow },
    { id: "soul",    name: "Soul",     leader: "Koga",     location: "Fuchsia City",     image: KANTO.soul },
    { id: "marsh",   name: "Marsh",    leader: "Sabrina",  location: "Saffron City",     image: KANTO.marsh },
    { id: "volcano", name: "Volcano",  leader: "Blaine",   location: "Cinnabar Island",  image: KANTO.volcano },
    { id: "earth",   name: "Earth",    leader: "Giovanni", location: "Viridian City",    image: KANTO.earth },
  ],

  "gold-silver-crystal": [
    // Johto
    { id: "zephyr",   name: "Zephyr",   leader: "Falkner", location: "Violet City",      image: JOHTO.zephyr },
    { id: "hive",     name: "Hive",     leader: "Bugsy",   location: "Azalea Town",      image: JOHTO.hive },
    { id: "plain",    name: "Plain",    leader: "Whitney",  location: "Goldenrod City",  image: JOHTO.plain },
    { id: "fog",      name: "Fog",      leader: "Morty",   location: "Ecruteak City",    image: JOHTO.fog },
    { id: "storm",    name: "Storm",    leader: "Chuck",   location: "Cianwood City",    image: JOHTO.storm },
    { id: "mineral",  name: "Mineral",  leader: "Jasmine", location: "Olivine City",     image: JOHTO.mineral },
    { id: "glacier",  name: "Glacier",  leader: "Pryce",   location: "Mahogany Town",    image: JOHTO.glacier },
    { id: "rising",   name: "Rising",   leader: "Clair",   location: "Blackthorn City",  image: JOHTO.rising },
    // Kanto
    { id: "boulder",  name: "Boulder",  leader: "Brock",   location: "Pewter City",      image: KANTO.boulder },
    { id: "cascade",  name: "Cascade",  leader: "Misty",   location: "Cerulean City",    image: KANTO.cascade },
    { id: "thunder",  name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City", image: KANTO.thunder },
    { id: "rainbow",  name: "Rainbow",  leader: "Erika",   location: "Celadon City",     image: KANTO.rainbow },
    { id: "soul",     name: "Soul",     leader: "Koga",    location: "Fuchsia City",     image: KANTO.soul },
    { id: "marsh",    name: "Marsh",    leader: "Sabrina", location: "Saffron City",     image: KANTO.marsh },
    { id: "volcano",  name: "Volcano",  leader: "Blaine",  location: "Cinnabar Island",  image: KANTO.volcano },
    { id: "earth",    name: "Earth",    leader: "Blue",    location: "Viridian City",    image: KANTO.earth },
  ],

  "ruby-sapphire-emerald": [
    { id: "stone",   name: "Stone",   leader: "Roxanne", location: "Rustboro City",    image: HOENN.stone },
    { id: "knuckle", name: "Knuckle", leader: "Brawly",  location: "Dewford Town",     image: HOENN.knuckle },
    { id: "dynamo",  name: "Dynamo",  leader: "Wattson", location: "Mauville City",    image: HOENN.dynamo },
    { id: "heat",    name: "Heat",    leader: "Flannery", location: "Lavaridge Town",  image: HOENN.heat },
    { id: "balance", name: "Balance", leader: "Norman",  location: "Petalburg City",   image: HOENN.balance },
    { id: "feather", name: "Feather", leader: "Winona",  location: "Fortree City",     image: HOENN.feather },
    { id: "mind",    name: "Mind",    leader: "Tate & Liza", location: "Mossdeep City", image: HOENN.mind },
    { id: "rain",    name: "Rain",    leader: "Wallace", location: "Sootopolis City",  image: HOENN.rain },
  ],

  "firered-leafgreen": [
    { id: "boulder", name: "Boulder",  leader: "Brock",    location: "Pewter City",      image: KANTO.boulder },
    { id: "cascade", name: "Cascade",  leader: "Misty",    location: "Cerulean City",    image: KANTO.cascade },
    { id: "thunder", name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City",  image: KANTO.thunder },
    { id: "rainbow", name: "Rainbow",  leader: "Erika",    location: "Celadon City",     image: KANTO.rainbow },
    { id: "soul",    name: "Soul",     leader: "Koga",     location: "Fuchsia City",     image: KANTO.soul },
    { id: "marsh",   name: "Marsh",    leader: "Sabrina",  location: "Saffron City",     image: KANTO.marsh },
    { id: "volcano", name: "Volcano",  leader: "Blaine",   location: "Cinnabar Island",  image: KANTO.volcano },
    { id: "earth",   name: "Earth",    leader: "Giovanni", location: "Viridian City",    image: KANTO.earth },
  ],

  "diamond-pearl-platinum": [
    { id: "coal",    name: "Coal",    leader: "Roark",        location: "Oreburgh City",  image: SINNOH.coal },
    { id: "forest",  name: "Forest",  leader: "Gardenia",     location: "Eterna City",    image: SINNOH.forest },
    { id: "cobble",  name: "Cobble",  leader: "Maylene",      location: "Veilstone City", image: SINNOH.cobble },
    { id: "fen",     name: "Fen",     leader: "Crasher Wake", location: "Pastoria City",  image: SINNOH.fen },
    { id: "relic",   name: "Relic",   leader: "Fantina",      location: "Hearthome City", image: SINNOH.relic },
    { id: "mine",    name: "Mine",    leader: "Byron",        location: "Canalave City",  image: SINNOH.mine },
    { id: "icicle",  name: "Icicle",  leader: "Candice",      location: "Snowpoint City", image: SINNOH.icicle },
    { id: "beacon",  name: "Beacon",  leader: "Volkner",      location: "Sunyshore City", image: SINNOH.beacon },
  ],

  "heartgold-soulsilver": [
    // Johto
    { id: "zephyr",   name: "Zephyr",   leader: "Falkner", location: "Violet City",      image: JOHTO.zephyr },
    { id: "hive",     name: "Hive",     leader: "Bugsy",   location: "Azalea Town",      image: JOHTO.hive },
    { id: "plain",    name: "Plain",    leader: "Whitney",  location: "Goldenrod City",  image: JOHTO.plain },
    { id: "fog",      name: "Fog",      leader: "Morty",   location: "Ecruteak City",    image: JOHTO.fog },
    { id: "storm",    name: "Storm",    leader: "Chuck",   location: "Cianwood City",    image: JOHTO.storm },
    { id: "mineral",  name: "Mineral",  leader: "Jasmine", location: "Olivine City",     image: JOHTO.mineral },
    { id: "glacier",  name: "Glacier",  leader: "Pryce",   location: "Mahogany Town",    image: JOHTO.glacier },
    { id: "rising",   name: "Rising",   leader: "Clair",   location: "Blackthorn City",  image: JOHTO.rising },
    // Kanto
    { id: "boulder",  name: "Boulder",  leader: "Brock",   location: "Pewter City",      image: KANTO.boulder },
    { id: "cascade",  name: "Cascade",  leader: "Misty",   location: "Cerulean City",    image: KANTO.cascade },
    { id: "thunder",  name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City", image: KANTO.thunder },
    { id: "rainbow",  name: "Rainbow",  leader: "Erika",   location: "Celadon City",     image: KANTO.rainbow },
    { id: "soul",     name: "Soul",     leader: "Koga",    location: "Fuchsia City",     image: KANTO.soul },
    { id: "marsh",    name: "Marsh",    leader: "Sabrina", location: "Saffron City",     image: KANTO.marsh },
    { id: "volcano",  name: "Volcano",  leader: "Blaine",  location: "Cinnabar Island",  image: KANTO.volcano },
    { id: "earth",    name: "Earth",    leader: "Blue",    location: "Viridian City",    image: KANTO.earth },
  ],

  "black-white": [
    { id: "trio",   name: "Trio",   leader: "Cilan / Chili / Cress", location: "Striaton City",  image: UNOVA.trio },
    { id: "basic",  name: "Basic",  leader: "Lenora",  location: "Nacrene City",                  image: UNOVA.basic },
    { id: "insect", name: "Insect", leader: "Burgh",   location: "Castelia City",                 image: UNOVA.insect },
    { id: "bolt",   name: "Bolt",   leader: "Elesa",   location: "Nimbasa City",                  image: UNOVA.bolt },
    { id: "quake",  name: "Quake",  leader: "Clay",    location: "Driftveil City",                image: UNOVA.quake },
    { id: "jet",    name: "Jet",    leader: "Skyla",   location: "Mistralton City",               image: UNOVA.jet },
    { id: "freeze", name: "Freeze", leader: "Brycen",  location: "Icirrus City",                  image: UNOVA.freeze },
    { id: "legend", name: "Legend", leader: "Drayden / Iris", location: "Opelucid City",          image: UNOVA.legend },
  ],

  "black2-white2": [
    { id: "basic",  name: "Basic",  leader: "Cheren",  location: "Aspertia City",  image: UNOVA.basic },
    { id: "toxic",  name: "Toxic",  leader: "Roxie",   location: "Virbank City",   image: UNOVA.toxic },
    { id: "insect", name: "Insect", leader: "Burgh",   location: "Castelia City",  image: UNOVA.insect },
    { id: "bolt",   name: "Bolt",   leader: "Elesa",   location: "Nimbasa City",   image: UNOVA.bolt },
    { id: "quake",  name: "Quake",  leader: "Clay",    location: "Driftveil City", image: UNOVA.quake },
    { id: "jet",    name: "Jet",    leader: "Skyla",   location: "Mistralton City", image: UNOVA.jet },
    { id: "legend", name: "Legend", leader: "Drayden", location: "Opelucid City",  image: UNOVA.legend },
    { id: "wave",   name: "Wave",   leader: "Marlon",  location: "Humilau City",   image: UNOVA.wave },
  ],

  "x-y": [
    { id: "bug",     name: "Bug",     leader: "Viola",   location: "Santalune City", image: KALOS.bug },
    { id: "cliff",   name: "Cliff",   leader: "Grant",   location: "Cyllage City",   image: KALOS.cliff },
    { id: "rumble",  name: "Rumble",  leader: "Korrina", location: "Shalour City",   image: KALOS.rumble },
    { id: "plant",   name: "Plant",   leader: "Ramos",   location: "Coumarine City", image: KALOS.plant },
    { id: "voltage", name: "Voltage", leader: "Clemont", location: "Lumiose City",   image: KALOS.voltage },
    { id: "fairy",   name: "Fairy",   leader: "Valerie", location: "Laverre City",   image: KALOS.fairy },
    { id: "psychic", name: "Psychic", leader: "Olympia", location: "Anistar City",   image: KALOS.psychic },
    { id: "iceberg", name: "Iceberg", leader: "Wulfric", location: "Snowbelle City", image: KALOS.iceberg },
  ],

  "omega-ruby-alpha-sapphire": [
    { id: "stone",   name: "Stone",   leader: "Roxanne", location: "Rustboro City",    image: HOENN.stone },
    { id: "knuckle", name: "Knuckle", leader: "Brawly",  location: "Dewford Town",     image: HOENN.knuckle },
    { id: "dynamo",  name: "Dynamo",  leader: "Wattson", location: "Mauville City",    image: HOENN.dynamo },
    { id: "heat",    name: "Heat",    leader: "Flannery", location: "Lavaridge Town",  image: HOENN.heat },
    { id: "balance", name: "Balance", leader: "Norman",  location: "Petalburg City",   image: HOENN.balance },
    { id: "feather", name: "Feather", leader: "Winona",  location: "Fortree City",     image: HOENN.feather },
    { id: "mind",    name: "Mind",    leader: "Tate & Liza", location: "Mossdeep City", image: HOENN.mind },
    { id: "rain",    name: "Rain",    leader: "Wallace", location: "Sootopolis City",  image: HOENN.rain },
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
    { id: "boulder", name: "Boulder",  leader: "Brock",    location: "Pewter City",      image: KANTO.boulder },
    { id: "cascade", name: "Cascade",  leader: "Misty",    location: "Cerulean City",    image: KANTO.cascade },
    { id: "thunder", name: "Thunder",  leader: "Lt. Surge", location: "Vermilion City",  image: KANTO.thunder },
    { id: "rainbow", name: "Rainbow",  leader: "Erika",    location: "Celadon City",     image: KANTO.rainbow },
    { id: "soul",    name: "Soul",     leader: "Koga",     location: "Fuchsia City",     image: KANTO.soul },
    { id: "marsh",   name: "Marsh",    leader: "Sabrina",  location: "Saffron City",     image: KANTO.marsh },
    { id: "volcano", name: "Volcano",  leader: "Blaine",   location: "Cinnabar Island",  image: KANTO.volcano },
    { id: "earth",   name: "Earth",    leader: "Giovanni", location: "Viridian City",    image: KANTO.earth },
  ],

  "sword-shield": [
    { id: "grass",    name: "Grass",    leader: "Milo",    location: "Turffield",     image: GALAR.grass },
    { id: "water",    name: "Water",    leader: "Nessa",   location: "Hulbury",       image: GALAR.water },
    { id: "fire",     name: "Fire",     leader: "Kabu",    location: "Motostoke",     image: GALAR.fire },
    { id: "ghost",    name: "Ghost / Fighting", leader: "Allister / Bea", location: "Stow-on-Side", image: GALAR.ghost },
    { id: "fairy",    name: "Fairy",    leader: "Opal",    location: "Ballonlea",     image: GALAR.fairy },
    { id: "rock",     name: "Rock / Ice", leader: "Gordie / Melony", location: "Circhester", image: GALAR.rock },
    { id: "dark",     name: "Dark",     leader: "Piers",   location: "Spikemuth",     image: GALAR.dark },
    { id: "dragon",   name: "Dragon",   leader: "Raihan",  location: "Hammerlocke",   image: GALAR.dragon },
  ],

  "brilliant-diamond-shining-pearl": [
    { id: "coal",    name: "Coal",    leader: "Roark",        location: "Oreburgh City",  image: SINNOH.coal },
    { id: "forest",  name: "Forest",  leader: "Gardenia",     location: "Eterna City",    image: SINNOH.forest },
    { id: "cobble",  name: "Cobble",  leader: "Maylene",      location: "Veilstone City", image: SINNOH.cobble },
    { id: "fen",     name: "Fen",     leader: "Crasher Wake", location: "Pastoria City",  image: SINNOH.fen },
    { id: "relic",   name: "Relic",   leader: "Fantina",      location: "Hearthome City", image: SINNOH.relic },
    { id: "mine",    name: "Mine",    leader: "Byron",        location: "Canalave City",  image: SINNOH.mine },
    { id: "icicle",  name: "Icicle",  leader: "Candice",      location: "Snowpoint City", image: SINNOH.icicle },
    { id: "beacon",  name: "Beacon",  leader: "Volkner",      location: "Sunyshore City", image: SINNOH.beacon },
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
    { id: "electric", name: "Electric", leader: "Iono",    location: "Levincia",   image: PALDEA.electric },
    { id: "water",    name: "Water",    leader: "Kofu",    location: "Cascarrafa" },
    { id: "normal",   name: "Normal",   leader: "Larry",   location: "Medali",     image: PALDEA.normal },
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
