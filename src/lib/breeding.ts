// Types, constants, storage, and plan-generation for the Breeding Tracker.

export type StatName =
  | "hp"
  | "attack"
  | "defense"
  | "special-attack"
  | "special-defense"
  | "speed";

export const STATS: StatName[] = [
  "hp",
  "attack",
  "defense",
  "special-attack",
  "special-defense",
  "speed",
];

export const STAT_LABELS: Record<StatName, string> = {
  hp: "HP",
  attack: "Atk",
  defense: "Def",
  "special-attack": "SpA",
  "special-defense": "SpD",
  speed: "Spe",
};

export const STAT_FULL_LABELS: Record<StatName, string> = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  "special-attack": "Sp. Atk",
  "special-defense": "Sp. Def",
  speed: "Speed",
};

export const POWER_ITEMS: Record<StatName, string> = {
  hp: "Power Weight",
  attack: "Power Bracer",
  defense: "Power Belt",
  "special-attack": "Power Lens",
  "special-defense": "Power Band",
  speed: "Power Anklet",
};

export const NATURES = [
  "adamant", "bashful", "bold", "brave", "calm",
  "careful", "docile", "gentle", "hardy", "hasty",
  "impish", "jolly", "lax", "lazy", "lax", "lonely",
  "mild", "modest", "naive", "naughty", "quiet",
  "quirky", "rash", "relaxed", "rash", "sassy",
  "serious", "timid",
].filter((v, i, a) => a.indexOf(v) === i).sort();

// Natures with a stat boost, grouped by the stat they raise
export const NATURE_BOOSTS: Record<string, { up: string; down: string } | null> = {
  adamant: { up: "Atk", down: "SpA" },
  bashful: null,
  bold: { up: "Def", down: "Atk" },
  brave: { up: "Atk", down: "Spe" },
  calm: { up: "SpD", down: "Atk" },
  careful: { up: "SpD", down: "SpA" },
  docile: null,
  gentle: { up: "SpD", down: "Def" },
  hardy: null,
  hasty: { up: "Spe", down: "Def" },
  impish: { up: "Def", down: "SpA" },
  jolly: { up: "Spe", down: "SpA" },
  lax: { up: "Def", down: "SpD" },
  lonely: { up: "Atk", down: "Def" },
  mild: { up: "SpA", down: "Def" },
  modest: { up: "SpA", down: "Atk" },
  naive: { up: "Spe", down: "SpD" },
  naughty: { up: "Atk", down: "SpD" },
  quiet: { up: "SpA", down: "Spe" },
  quirky: null,
  rash: { up: "SpA", down: "SpD" },
  relaxed: { up: "Def", down: "Spe" },
  sassy: { up: "SpD", down: "Spe" },
  serious: null,
  timid: { up: "Spe", down: "Atk" },
};

export type AbilitySlot = "slot1" | "slot2" | "hidden" | "any";
export type GenderTarget = "male" | "female" | "either";

export interface BreedingProject {
  id: string;
  name: string; // e.g. "Jolly Garchomp"
  createdAt: number;
  updatedAt: number;
  status: "active" | "completed" | "abandoned";
  completedAt?: number;

  // Target configuration
  gameValue: string;
  targetSpecies: string; // PokéAPI slug
  targetSpeciesName: string; // display name
  targetNature: string | null;
  targetAbility: AbilitySlot;
  targetGender: GenderTarget;
  targetIVs: StatName[];
  targetEggMoves: string[]; // move slugs
  masudaMethod: boolean;
  shinyHunting: boolean;

  // Hatch log
  hatches: HatchEntry[];
}

export interface HatchEntry {
  id: string;
  timestamp: number;
  perfectIVs: StatName[];
  nature: string | null;
  gender: "male" | "female" | null;
  eggMoves: string[]; // which target egg moves this hatch has
  isShiny: boolean;
  notes: string;
  isSuccess: boolean; // user marked "this was the one"
}

// Gen 6+ games that support Destiny Knot mechanics
export const BREEDING_GAMES = [
  "x-y",
  "omega-ruby-alpha-sapphire",
  "sun-moon",
  "ultra-sun-ultra-moon",
  "sword-shield",
  "brilliant-diamond-shining-pearl",
  "scarlet-violet",
];

const STORAGE_KEY = "porylist-breeding-v1";

export function loadProjects(): BreedingProject[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveProjects(projects: BreedingProject[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export async function saveProjectsAsync(projects: BreedingProject[]): Promise<void> {
  const json = JSON.stringify(projects);
  try { localStorage.setItem(STORAGE_KEY, json); } catch {}
  const { dbSet } = await import("./db");
  await dbSet(STORAGE_KEY, json);
}

// Masuda Method: 6/4096 per egg (Gen 6+). Base: 1/4096.
const MASUDA_RATE = 6 / 4096;
const BASE_SHINY_RATE = 1 / 4096;

/** Cumulative probability of at least one shiny in `eggs` eggs. */
export function shinyOdds(eggs: number, masuda: boolean): number {
  const rate = masuda ? MASUDA_RATE : BASE_SHINY_RATE;
  return 1 - Math.pow(1 - rate, eggs);
}

/** How many eggs for a given cumulative shiny probability. */
export function eggsForOdds(targetProb: number, masuda: boolean): number {
  const rate = masuda ? MASUDA_RATE : BASE_SHINY_RATE;
  return Math.ceil(Math.log(1 - targetProb) / Math.log(1 - rate));
}

// ─── Plan generation ────────────────────────────────────────────────────────

export type StepType = "prerequisite" | "parent" | "breed" | "note";

export interface BreedingStep {
  id: string;
  phase: number;
  type: StepType;
  title: string;
  description: string;
  details: string[];
}

type EggParentData = Record<
  string,
  { n: string; p: string; i: number; g: string[]; l: Record<string, number> }
>;

function slugToDisplay(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function gameToGeneration(gameValue: string): number {
  const map: Record<string, number> = {
    "x-y": 6,
    "omega-ruby-alpha-sapphire": 6,
    "sun-moon": 7,
    "ultra-sun-ultra-moon": 7,
    "sword-shield": 8,
    "brilliant-diamond-shining-pearl": 8,
    "scarlet-violet": 9,
    "legends-za": 9,
  };
  return map[gameValue] ?? 6;
}

export function generateBreedingPlan(
  project: BreedingProject,
  eggData: EggParentData | null,
): BreedingStep[] {
  const steps: BreedingStep[] = [];
  let phase = 1;

  const {
    targetSpecies,
    targetIVs,
    targetNature,
    targetAbility,
    targetGender,
    targetEggMoves,
    gameValue,
  } = project;

  const speciesDisplay = slugToDisplay(targetSpecies);
  const smogonKey = targetSpecies.replace(/-/g, "");
  const speciesEntry = eggData?.[smogonKey];
  const eggGroups: string[] = speciesEntry?.g ?? [];
  const canBreedWithDitto =
    eggGroups.length > 0 &&
    !eggGroups.includes("Undiscovered") &&
    !eggGroups.includes("Ditto");

  // ── Step: Undiscovered egg group ──────────────────────────────────────────
  if (!canBreedWithDitto && targetIVs.length > 0) {
    steps.push({
      id: "undiscovered",
      phase,
      type: "note",
      title: "Undiscovered egg group — breed a pre-evolution",
      description: `${speciesDisplay} cannot breed directly. You'll need to breed its pre-evolution and evolve the result.`,
      details: [
        "Find the first evolution in the chain that can breed (not in the Undiscovered group).",
        "Breed that Pokémon with the same strategy below, then evolve the result.",
        "Baby Pokémon (Pichu, Cleffa, etc.) require an Incense in the daycare to produce the baby egg form.",
      ],
    });
    phase++;
  }

  // ── Step: Egg moves ────────────────────────────────────────────────────────
  if (targetEggMoves.length > 0) {
    const genNum = gameToGeneration(gameValue);
    const genMask = 1 << (genNum - 1);

    for (const moveName of targetEggMoves) {
      const smogonMove = moveName.replace(/-/g, "");
      const moveDisplay = slugToDisplay(moveName);
      const compatibleParents: { name: string; id: number }[] = [];

      if (eggData && eggGroups.length > 0) {
        for (const [sid, data] of Object.entries(eggData)) {
          if (sid === smogonKey) continue;
          if (!data.g.some((g) => eggGroups.includes(g))) continue;
          if (!((data.l[smogonMove] ?? 0) & genMask)) continue;
          compatibleParents.push({ name: data.n, id: data.i });
        }
        compatibleParents.sort((a, b) => a.id - b.id);
      }

      const parentList =
        compatibleParents.length > 0
          ? compatibleParents
              .slice(0, 6)
              .map((p) => p.name)
              .join(", ") +
            (compatibleParents.length > 6
              ? ` +${compatibleParents.length - 6} more`
              : "")
          : null;

      steps.push({
        id: `egg-move-${moveName}`,
        phase,
        type: "prerequisite",
        title: `Get egg move: ${moveDisplay}`,
        description:
          compatibleParents.length > 0
            ? `Acquire a compatible parent that knows ${moveDisplay}. It shares an egg group with ${speciesDisplay} so the move will be passed down.`
            : `${moveDisplay} may require chain breeding — find an intermediate species that shares an egg group with ${speciesDisplay} and can learn the move.`,
        details: [
          parentList
            ? `Compatible parents (${eggGroups.join("/")} egg group): ${parentList}`
            : `Search for a Pokémon in the ${eggGroups.join("/")} egg group that learns ${moveDisplay}.`,
          `Catch or breed that parent Pokémon so it knows ${moveDisplay}, then place it in the daycare with ${speciesDisplay}.`,
          `The egg move will be passed to the offspring automatically.`,
          gameValue === "scarlet-violet"
            ? `In Scarlet/Violet: you can also use the egg move mirror mechanic — two Pokémon of the same species can share egg moves at a picnic.`
            : "",
        ].filter(Boolean),
      });
      phase++;
    }
  }

  // ── Step: Nature ───────────────────────────────────────────────────────────
  if (targetNature) {
    const natureDisplay =
      targetNature.charAt(0).toUpperCase() + targetNature.slice(1);
    const boost = NATURE_BOOSTS[targetNature];
    const boostNote = boost ? ` (+${boost.up} / -${boost.down})` : " (neutral)";

    steps.push({
      id: "nature",
      phase,
      type: "parent",
      title: `Prepare a ${natureDisplay} nature parent`,
      description: `You need a ${speciesDisplay} (or compatible parent) with ${natureDisplay}${boostNote} nature holding an Everstone to guarantee nature inheritance.`,
      details: [
        `Find a ${speciesDisplay} with ${natureDisplay} nature — check the wild or your PC.`,
        `Give it the Everstone. 100% of offspring will inherit the holder's nature.`,
        `This parent can also be your IV-breeding parent later once you've built up good IVs.`,
        gameValue.startsWith("sun") || gameValue.startsWith("ultra") || gameValue.startsWith("sword") || gameValue.startsWith("scarlet")
          ? `Alternative (Gen 7+): use a Nature Mint after hatching to change the displayed nature — but mints don't help during active breeding.`
          : "",
      ].filter(Boolean),
    });
    phase++;
  }

  // ── Step: Hidden Ability ──────────────────────────────────────────────────
  if (targetAbility === "hidden") {
    steps.push({
      id: "hidden-ability",
      phase,
      type: "note",
      title: `Get a Hidden Ability parent`,
      description: `${speciesDisplay}'s Hidden Ability must already be on a parent — it cannot be bred onto a Pokémon that doesn't have it.`,
      details: [
        `X/Y: Friend Safari (the type matching ${speciesDisplay}'s type gives ~5% HA rate).`,
        `ORAS: DexNav — high chain counts raise the odds of a Hidden Ability encounter.`,
        `Sun/Moon/USUM: SOS battles — the ally called in has ~5% chance to have the HA.`,
        `Sword/Shield: Ability Patch from the Crown Tundra DLC directly grants the HA.`,
        `Scarlet/Violet: Ability Patch (costs LP at the Auction House).`,
        `Once you have one, the HA passes to ~60% of offspring when the female parent (or the non-Ditto parent) carries it.`,
      ],
    });
    phase++;
  }

  // ── Steps: IV parents ─────────────────────────────────────────────────────
  if (targetIVs.length === 0) {
    steps.push({
      id: "no-ivs",
      phase,
      type: "note",
      title: "No IV targets selected",
      description: "You haven't selected any IVs to optimize. Add IV targets in the project settings to get a breeding plan.",
      details: [],
    });
    return steps;
  }

  if (!canBreedWithDitto && eggData) {
    // Already warned above — skip IV steps
    return steps;
  }

  if (targetIVs.length <= 3) {
    // ── Simple: one Ditto covers ≤3 stats ───────────────────────────────────
    steps.push({
      id: "parent-ditto",
      phase,
      type: "parent",
      title: `Acquire a Ditto with perfect ${targetIVs.map((s) => STAT_LABELS[s]).join("/")} IVs`,
      description: `A Ditto with perfect IVs in ${targetIVs.map((s) => STAT_FULL_LABELS[s]).join(", ")} is your primary parent. Ditto can breed with ${speciesDisplay} regardless of gender.`,
      details: [
        `Trade for one online (Wonder Trade, GTS, or a trading Discord) — a 5-6 IV Ditto is widely available.`,
        `If catching from the wild: use the IV judge to check stats and soft-reset for good IVs.`,
        `Ditto's nature doesn't matter — it won't pass nature unless it holds an Everstone.`,
      ],
    });
    phase++;

    steps.push({
      id: "breed-simple",
      phase,
      type: "breed",
      title: `Breed ${speciesDisplay} × Ditto`,
      description: `Destiny Knot passes 5 of the 12 combined IVs. Power item on one parent guarantees a specific IV is always passed.`,
      details: [
        `Ditto holds: Destiny Knot`,
        `${speciesDisplay} holds: ${POWER_ITEMS[targetIVs[0]]} (guarantees ${STAT_FULL_LABELS[targetIVs[0]]} IV is passed)`,
        targetNature
          ? `When you get an offspring with the right nature and good IVs, give it the Everstone and continue.`
          : ``,
        `Keep the best offspring each round and use it as the new ${speciesDisplay} parent. The IVs stack over generations.`,
        `Target: offspring with ${targetIVs.map((s) => STAT_FULL_LABELS[s]).join(", ")} all at 31.`,
      ].filter(Boolean),
    });
  } else if (targetIVs.length <= 5) {
    // ── Two-parent approach for 4-5 IVs ─────────────────────────────────────
    const mid = Math.ceil(targetIVs.length / 2);
    const batchA = targetIVs.slice(0, mid);
    const batchB = targetIVs.slice(mid);

    steps.push({
      id: "parent-a",
      phase,
      type: "parent",
      title: `Build Parent A — ${batchA.map((s) => STAT_LABELS[s]).join("/")} IVs`,
      description: `Get or breed a Ditto with perfect IVs in ${batchA.map((s) => STAT_FULL_LABELS[s]).join(", ")}.`,
      details: [
        `Ditto holds: Destiny Knot`,
        `${speciesDisplay} holds: ${POWER_ITEMS[batchA[0]]} (guarantees ${STAT_FULL_LABELS[batchA[0]]})`,
        `Breed until you have a ${speciesDisplay} offspring with all of ${batchA.map((s) => STAT_FULL_LABELS[s]).join(", ")} perfect. This is your Parent A.`,
        `Tip: keep replacing the ${speciesDisplay} parent with the best offspring each round.`,
      ],
    });
    phase++;

    steps.push({
      id: "parent-b",
      phase,
      type: "parent",
      title: `Build Parent B — ${batchB.map((s) => STAT_LABELS[s]).join("/")} IVs`,
      description: `Get or breed a separate Ditto with perfect IVs in ${batchB.map((s) => STAT_FULL_LABELS[s]).join(", ")}.`,
      details: [
        `Ditto holds: Destiny Knot`,
        `${speciesDisplay} holds: ${POWER_ITEMS[batchB[0]]} (guarantees ${STAT_FULL_LABELS[batchB[0]]})`,
        `Breed until you have a ${speciesDisplay} with ${batchB.map((s) => STAT_FULL_LABELS[s]).join(", ")} perfect. This is your Parent B.`,
      ],
    });
    phase++;

    steps.push({
      id: "breed-combine",
      phase,
      type: "breed",
      title: `Combine: Parent A × Ditto (Parent B IVs)`,
      description: `With both IV batches covered, breeding them together gives you a high chance of all target IVs appearing in one offspring.`,
      details: [
        `Parent A (${speciesDisplay} with ${batchA.map((s) => STAT_LABELS[s]).join("/")}) holds: Destiny Knot`,
        `Ditto (with ${batchB.map((s) => STAT_LABELS[s]).join("/")}) holds: ${POWER_ITEMS[batchB[0]]}`,
        targetNature
          ? `Once you hatch a ${targetNature} offspring with 4+ IVs, give it the Everstone and keep breeding.`
          : ``,
        `Keep improving: replace the weaker parent each time you get a better offspring.`,
        `Target: all ${targetIVs.map((s) => STAT_LABELS[s]).join("/")} at 31.`,
      ].filter(Boolean),
    });
  } else {
    // ── Full 6-IV approach: two Dittos + combine ─────────────────────────────
    const batchA: StatName[] = ["hp", "attack", "defense"].filter((s) =>
      targetIVs.includes(s as StatName)
    ) as StatName[];
    const batchB: StatName[] = [
      "special-attack",
      "special-defense",
      "speed",
    ].filter((s) => targetIVs.includes(s as StatName)) as StatName[];
    // Fallback: if all 6 are selected, use natural split
    const a = batchA.length > 0 ? batchA : (["hp", "attack", "defense"] as StatName[]);
    const b = batchB.length > 0 ? batchB : (["special-attack", "special-defense", "speed"] as StatName[]);

    steps.push({
      id: "parent-a",
      phase,
      type: "parent",
      title: `Build Parent A — ${a.map((s) => STAT_LABELS[s]).join("/")} IVs`,
      description: `Get a Ditto with perfect IVs in ${a.map((s) => STAT_FULL_LABELS[s]).join(", ")} (the "physical" stats). Trade for one or catch and check IVs.`,
      details: [
        `Ditto holds: Destiny Knot`,
        `${speciesDisplay} holds: ${POWER_ITEMS[a[0]]} (guarantees ${STAT_FULL_LABELS[a[0]]})`,
        `Breed until you hatch a ${speciesDisplay} with all of ${a.map((s) => STAT_FULL_LABELS[s]).join(", ")} at 31.`,
        `Replace the ${speciesDisplay} parent with the best offspring each round to accumulate IVs faster.`,
      ],
    });
    phase++;

    steps.push({
      id: "parent-b",
      phase,
      type: "parent",
      title: `Build Parent B — ${b.map((s) => STAT_LABELS[s]).join("/")} IVs`,
      description: `Get a second Ditto covering ${b.map((s) => STAT_FULL_LABELS[s]).join(", ")} (the "special" stats).`,
      details: [
        `Ditto holds: Destiny Knot`,
        `${speciesDisplay} holds: ${POWER_ITEMS[b[0]]}`,
        `Breed ${speciesDisplay} × this Ditto until you get an offspring with ${b.map((s) => STAT_FULL_LABELS[s]).join(", ")} at 31. This is Parent B.`,
      ],
    });
    phase++;

    steps.push({
      id: "breed-combine-6iv",
      phase,
      type: "breed",
      title: `Combine: breed Parent A × Ditto B for 5-6 IVs`,
      description: `Both parents now cover all 6 target stats between them. Destiny Knot passes 5 of the 12 combined IVs per egg — you'll hit 5 perfect IVs frequently.`,
      details: [
        `Parent A (${speciesDisplay} with ${a.map((s) => STAT_LABELS[s]).join("/")}) holds: Destiny Knot`,
        `Ditto B (with ${b.map((s) => STAT_LABELS[s]).join("/")}) holds: ${POWER_ITEMS[b[0]]}`,
        `With both parents covering all 6 stats, roughly 1 in 32 eggs will have 5 perfect IVs. 6 IVs is about 1 in 200.`,
        targetNature
          ? `Once you get a ${targetNature} offspring with 5 IVs, swap it in and give it the Everstone.`
          : ``,
      ].filter(Boolean),
    });
    phase++;

    steps.push({
      id: "final-6iv",
      phase,
      type: "breed",
      title: `Final polish: iterate to 6 perfect IVs`,
      description: `Keep replacing the weaker parent with your best hatch. Each generation narrows the remaining variance.`,
      details: [
        `Each time you hatch something better, make it the new ${speciesDisplay} parent (with Destiny Knot).`,
        targetNature
          ? `Keep the Everstone on the ${targetNature} nature parent to lock in nature.`
          : ``,
        `Tip: walk in circles while hatching eggs — Route 7 loop in X/Y and similar flat loops in other games work well.`,
        `The Oval Charm (post-game reward in most Gen 6+ games) roughly triples egg generation speed.`,
        gameValue === "scarlet-violet"
          ? `In Scarlet/Violet: make Egg Power sandwiches (Great Peanut Butter Sandwich = Egg Power Lv. 2) to speed up egg generation.`
          : ``,
      ].filter(Boolean),
    });
  }

  // ── Step: Gender note ─────────────────────────────────────────────────────
  if (targetGender !== "either") {
    steps.push({
      id: "gender",
      phase,
      type: "note",
      title: `Target gender: ${targetGender === "male" ? "♂ Male" : "♀ Female"}`,
      description: `Egg gender is random based on the species' gender ratio — just log each hatch and set aside the ones with the wrong gender.`,
      details: [
        targetAbility === "hidden"
          ? `Important: Hidden Ability passes at ~60% through the female parent. Use the female HA parent for best results.`
          : ``,
        `If you need a specific gender for passing egg moves, keep a good-IV male and female from your breeding pool.`,
      ].filter(Boolean),
    });
  }

  return steps;
}
