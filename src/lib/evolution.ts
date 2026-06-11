// Evolution display helpers shared by PokemonModal and the playthrough team
// "Coming up" digest. Pure formatting + chain traversal — no React.

import type { ChainLink, EvolutionDetail } from "@/lib/pokeapi";

export function formatItemName(name: string): string {
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatLocationName(apiName: string): string {
  let name = apiName
    .replace(/-area$/, "")
    .replace(/-/g, " ");
  // B1F, 1F floor notation
  name = name.replace(/\bb(\d+)f\b/gi, (_, n) => `B${n}F`);
  name = name.replace(/\b(\d+)f\b/gi, (_, n) => `${n}F`);
  // Capitalize words
  name = name.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  // Fix abbreviations
  name = name.replace(/\bMt\b/g, "Mt.").replace(/\bSs\b/g, "SS");
  return name;
}

export function formatEvolutionMethod(detail: EvolutionDetail): string {
  const trigger = detail.trigger.name;
  const parts: string[] = [];

  switch (trigger) {
    case "level-up":
      if (detail.min_level) parts.push(`Level ${detail.min_level}`);
      else if (detail.min_happiness) parts.push("High Friendship");
      else if (detail.min_beauty) parts.push("High Beauty");
      else if (detail.min_affection) parts.push("High Affection");
      else if (detail.known_move) parts.push(`Know ${formatItemName(detail.known_move.name)}`);
      else if (detail.known_move_type) parts.push(`Know a ${formatItemName(detail.known_move_type.name)}-type move`);
      else if (detail.location) parts.push(`At ${formatLocationName(detail.location.name)}`);
      else parts.push("Level up");
      if (detail.time_of_day === "day") parts.push("(Day)");
      else if (detail.time_of_day === "night") parts.push("(Night)");
      if (detail.needs_overworld_rain) parts.push("(Rain)");
      if (detail.gender === 1) parts.push("(♀)");
      if (detail.gender === 2) parts.push("(♂)");
      if (detail.relative_physical_stats === 1) parts.push("(Atk > Def)");
      else if (detail.relative_physical_stats === -1) parts.push("(Atk < Def)");
      else if (detail.relative_physical_stats === 0) parts.push("(Atk = Def)");
      if (detail.turn_upside_down) parts.push("(Upside down)");
      break;
    case "use-item":
      parts.push(`Use ${formatItemName(detail.item?.name ?? "item")}`);
      break;
    case "trade":
      if (detail.held_item) parts.push(`Trade holding ${formatItemName(detail.held_item.name)}`);
      else if (detail.trade_species) parts.push(`Trade for ${formatItemName(detail.trade_species.name)}`);
      else parts.push("Trade");
      break;
    case "shed": parts.push("Level 20 + empty party slot"); break;
    case "three-critical-hits": parts.push("3 critical hits in one battle"); break;
    case "take-damage": parts.push("Travel after taking damage"); break;
    case "agile-style-move": parts.push("Use agile style 20 times"); break;
    case "strong-style-move": parts.push("Use strong style 20 times"); break;
    case "recoil-damage": parts.push("Take 294+ recoil damage"); break;
    case "tower-of-darkness": parts.push("Tower of Darkness"); break;
    case "tower-of-waters": parts.push("Tower of Waters"); break;
    default: parts.push(trigger.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
  }

  return parts.join(" ");
}

export interface NextEvolution {
  /** Species slug this Pokémon evolves into. */
  species: string;
  /** Formatted requirement(s), e.g. "Level 16" or "Use Water Stone". */
  methods: string[];
}

/**
 * The immediate next evolution(s) for a species within its chain. Returns an
 * empty array when the species is already fully evolved (or not found).
 */
export function immediateEvolutions(chain: ChainLink, speciesName: string): NextEvolution[] {
  const node = findChainNode(chain, speciesName);
  if (!node) return [];
  return node.evolves_to.map((child) => ({
    species: child.species.name,
    methods: [...new Set(child.evolution_details.map(formatEvolutionMethod))].filter(Boolean),
  }));
}

function findChainNode(link: ChainLink, speciesName: string): ChainLink | null {
  if (link.species.name === speciesName) return link;
  for (const child of link.evolves_to) {
    const found = findChainNode(child, speciesName);
    if (found) return found;
  }
  return null;
}
