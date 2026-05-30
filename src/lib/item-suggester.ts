/**
 * Heuristic held-item suggestions for a Pokémon based on its base stats and types.
 *
 * Returns 2–3 item slugs (PokéAPI names) ordered from most-recommended down. The
 * UI is responsible for looking up display names and sprites from the item list.
 *
 * This is intentionally simple — it picks well-known generalist items
 * (Choice Band/Specs/Scarf, Life Orb, Leftovers, Focus Sash, Assault Vest,
 * Eviolite, Heavy-Duty Boots) plus one type-flavoured pick. It is not a
 * competitive-tier recommendation engine.
 */

type Stats = {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
};

const TYPE_ITEM: Record<string, string> = {
  fire:     "charcoal",
  water:    "mystic-water",
  grass:    "miracle-seed",
  electric: "magnet",
  ice:      "never-melt-ice",
  fighting: "black-belt",
  poison:   "poison-barb",
  ground:   "soft-sand",
  flying:   "sharp-beak",
  psychic:  "twisted-spoon",
  bug:      "silver-powder",
  rock:     "hard-stone",
  ghost:    "spell-tag",
  dragon:   "dragon-fang",
  dark:     "black-glasses",
  steel:    "metal-coat",
  fairy:    "fairy-feather",
  normal:   "silk-scarf",
};

export function suggestItems(stats: Stats, types: string[]): string[] {
  const { hp, attack, defense, specialAttack, specialDefense, speed } = stats;
  const physBulk = hp + defense;
  const specBulk = hp + specialDefense;
  const totalBulk = hp + defense + specialDefense;

  const isFast = speed >= 95;
  const isVeryFast = speed >= 110;
  const isSlow = speed <= 60;
  const isPhysical = attack >= specialAttack + 15;
  const isSpecial = specialAttack >= attack + 15;
  const isMixed = !isPhysical && !isSpecial && (attack >= 80 || specialAttack >= 80);
  const isBulky = totalBulk >= 270;
  const isVeryBulky = totalBulk >= 320;
  const isFrail = totalBulk < 220;
  const isWallish = (defense >= 100 || specialDefense >= 100) && attack < 90 && specialAttack < 90;

  // Use a Map to preserve insertion order while de-duping.
  const picks = new Map<string, true>();
  const add = (slug: string) => { if (!picks.has(slug)) picks.set(slug, true); };

  // Role-driven primary picks
  if (isPhysical) {
    if (isVeryFast) add("life-orb");
    else if (isFast)  add("choice-band");
    else if (isSlow)  add("choice-band");
    else              add("life-orb");
  }
  if (isSpecial) {
    if (isVeryFast) add("life-orb");
    else if (isFast)  add("choice-specs");
    else if (isBulky) add("assault-vest");
    else              add("life-orb");
  }
  if (isMixed) {
    add("life-orb");
    if (isFast) add("expert-belt");
  }

  // Speed control
  if (isSlow && (isPhysical || isSpecial) && totalBulk < 280) {
    add("choice-scarf");
  }
  if (isFast && !isVeryFast && !isPhysical && !isSpecial) {
    add("choice-scarf");
  }

  // Survivability
  if (isFrail) add("focus-sash");
  if (isVeryBulky || isWallish) add("leftovers");
  if (physBulk >= 200 && specBulk < physBulk) add("rocky-helmet");
  if (specBulk >= 200 && !isPhysical) add("assault-vest");

  // Defensive pivots almost always want boots in modern formats
  if (isWallish || isBulky) add("heavy-duty-boots");

  // Type-flavoured fallback if we don't have much
  if (picks.size < 3 && types[0]) {
    const t = TYPE_ITEM[types[0]];
    if (t) add(t);
  }

  // Always-safe defaults
  if (picks.size === 0) {
    add("leftovers");
    add("life-orb");
  }

  return [...picks.keys()].slice(0, 3);
}
