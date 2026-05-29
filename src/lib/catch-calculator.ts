/**
 * Pokémon catch-rate calculator.
 *
 * Formula references:
 *   https://bulbapedia.bulbagarden.net/wiki/Catch_rate
 *
 * Supported generations: 1–9 (LGPE and PLA use entirely different mechanics
 * and are flagged separately).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatusCondition = "none" | "sleep" | "freeze" | "paralysis" | "burn" | "poison";

export interface BallContext {
  generation: number;
  level: number;
  /** PokéAPI weight in hectograms (10 hg = 1 kg). */
  weight: number;
  /** Type slugs, e.g. ["water", "flying"]. */
  types: string[];
  /** Whether the Pokémon has already been registered in the Pokédex. */
  alreadyCaught: boolean;
  /** True when in a cave or at night. */
  isDarkOrCave: boolean;
  /** True when the encounter was started via fishing (rod). */
  isFishing: boolean;
  /** True when battling on water surface / diving. */
  isWater: boolean;
  /** 1-based turn count of the current battle. */
  turnNumber: number;
  /** True if it's an Ultra Beast. */
  isUltraBeast: boolean;
  /** Player's lead Pokémon level (for Level Ball comparison). */
  playerLevel: number;
}

export interface Ball {
  id: string;
  name: string;
  /** Generation in which this ball was first available (in the main series). */
  minGeneration: number;
  /** Some balls only exist in specific game values. */
  onlyIn?: string[];
  /** Returns the effective catch multiplier given the current context.
   *  Returns Infinity for guaranteed catches (Master Ball, etc.). */
  getMultiplier(ctx: BallContext): number;
  /** Short human-readable description of the condition, e.g. "3× Bug/Water types". */
  conditionLabel(ctx: BallContext): string;
  /** True if modifier is additive (modifies catchRate directly) rather than multiplicative. */
  isAdditive?: boolean;
  /** For additive balls, returns the value to add to catchRate (may be negative). */
  getBonus?(ctx: BallContext): number;
}

// ─── Ball Definitions ─────────────────────────────────────────────────────────

// Nest Ball multiplier by level (Gen VI+)
function nestBallMult(level: number): number {
  return Math.max(1, (41 - level) / 10);
}

// Timer Ball multiplier by turn (Gen VI+: 1 + turn*1229/4096, max 4)
function timerBallMult(turn: number, generation: number): number {
  if (generation <= 4) return Math.min(4, 1 + Math.floor(turn / 10));
  return Math.min(4, 1 + Math.floor((turn * 1229) / 4096));
}

// Heavy Ball flat bonus to catch rate (Gen IV rules vs Gen VI+ rules)
function heavyBallBonus(weightHg: number, generation: number): number {
  const weightKg = weightHg / 10;
  if (generation <= 5) {
    // Gen II-V: brackets at 102.4, 204.8, 307.2 kg
    if (weightKg < 102.4) return -20;
    if (weightKg < 204.8) return 0;
    if (weightKg < 307.2) return 20;
    return 30;
  }
  // Gen VI+: brackets at 102.4, 204.8, 307.2 kg
  if (weightKg < 102.4) return -20;
  if (weightKg < 204.8) return 20;
  if (weightKg < 307.2) return 30;
  return 40;
}

export const BALLS: Ball[] = [
  {
    id: "poke-ball",
    name: "Poké Ball",
    minGeneration: 1,
    getMultiplier: () => 1,
    conditionLabel: () => "1×",
  },
  {
    id: "great-ball",
    name: "Great Ball",
    minGeneration: 1,
    getMultiplier: () => 1.5,
    conditionLabel: () => "1.5×",
  },
  {
    id: "ultra-ball",
    name: "Ultra Ball",
    minGeneration: 1,
    getMultiplier: () => 2,
    conditionLabel: () => "2×",
  },
  {
    id: "master-ball",
    name: "Master Ball",
    minGeneration: 1,
    getMultiplier: () => Infinity,
    conditionLabel: () => "Guaranteed catch",
  },
  {
    id: "safari-ball",
    name: "Safari Ball",
    minGeneration: 1,
    getMultiplier: () => 1.5,
    conditionLabel: () => "1.5× (Safari Zone)",
  },
  {
    id: "sport-ball",
    name: "Sport Ball",
    minGeneration: 2,
    getMultiplier: () => 1.5,
    conditionLabel: () => "1.5× (Bug Catching Contest)",
  },
  {
    id: "level-ball",
    name: "Level Ball",
    minGeneration: 2,
    getMultiplier: ({ playerLevel, level }) => {
      if (playerLevel >= level * 4) return 8;
      if (playerLevel >= level * 2) return 4;
      if (playerLevel > level) return 2;
      return 1;
    },
    conditionLabel: ({ playerLevel, level }) => {
      if (playerLevel >= level * 4) return "8× (player ≥4× Pokémon)";
      if (playerLevel >= level * 2) return "4× (player ≥2× Pokémon)";
      if (playerLevel > level) return "2× (player > Pokémon)";
      return "1× (player ≤ Pokémon)";
    },
  },
  {
    id: "lure-ball",
    name: "Lure Ball",
    minGeneration: 2,
    getMultiplier: ({ isFishing, generation }) =>
      isFishing ? (generation >= 6 ? 5 : 3) : 1,
    conditionLabel: ({ isFishing, generation }) =>
      isFishing ? `${generation >= 6 ? 5 : 3}× (fishing)` : "1× (not fishing)",
  },
  {
    id: "moon-ball",
    name: "Moon Ball",
    minGeneration: 2,
    getMultiplier: () => 4,
    conditionLabel: () => "4× (Moon Stone evolutions)",
  },
  {
    id: "friend-ball",
    name: "Friend Ball",
    minGeneration: 2,
    getMultiplier: () => 1,
    conditionLabel: () => "1×",
  },
  {
    id: "love-ball",
    name: "Love Ball",
    minGeneration: 2,
    getMultiplier: () => 8,
    conditionLabel: () => "8× (opposite gender, same species)",
  },
  {
    id: "heavy-ball",
    name: "Heavy Ball",
    minGeneration: 2,
    isAdditive: true,
    getMultiplier: () => 1,
    getBonus: ({ weight, generation }) => heavyBallBonus(weight, generation),
    conditionLabel: ({ weight, generation }) => {
      const b = heavyBallBonus(weight, generation);
      return b >= 0 ? `+${b} to catch rate (weight-based)` : `${b} to catch rate (weight-based)`;
    },
  },
  {
    id: "fast-ball",
    name: "Fast Ball",
    minGeneration: 2,
    getMultiplier: () => 4,
    conditionLabel: () => "4× (flee-prone / base Speed ≥100)",
  },
  {
    id: "net-ball",
    name: "Net Ball",
    minGeneration: 3,
    getMultiplier: ({ types, generation }) => {
      const matches = types.some((t) => t === "water" || t === "bug");
      if (!matches) return 1;
      return generation >= 6 ? 3.5 : 3;
    },
    conditionLabel: ({ types, generation }) => {
      const matches = types.some((t) => t === "water" || t === "bug");
      return matches ? `${generation >= 6 ? 3.5 : 3}× (Bug/Water type)` : "1× (not Bug/Water)";
    },
  },
  {
    id: "dive-ball",
    name: "Dive Ball",
    minGeneration: 3,
    getMultiplier: ({ isWater, generation }) =>
      isWater ? (generation >= 6 ? 3.5 : 3.5) : 1,
    conditionLabel: ({ isWater }) =>
      isWater ? "3.5× (surfing/diving)" : "1× (not on water)",
  },
  {
    id: "nest-ball",
    name: "Nest Ball",
    minGeneration: 3,
    getMultiplier: ({ level }) => nestBallMult(level),
    conditionLabel: ({ level }) => {
      const m = nestBallMult(level);
      return m > 1 ? `${m.toFixed(1)}× (level ${level})` : "1× (level ≥40)";
    },
  },
  {
    id: "repeat-ball",
    name: "Repeat Ball",
    minGeneration: 3,
    getMultiplier: ({ alreadyCaught, generation }) =>
      alreadyCaught ? (generation >= 6 ? 3.5 : 3) : 1,
    conditionLabel: ({ alreadyCaught, generation }) =>
      alreadyCaught
        ? `${generation >= 6 ? 3.5 : 3}× (previously caught)`
        : "1× (not yet caught)",
  },
  {
    id: "timer-ball",
    name: "Timer Ball",
    minGeneration: 3,
    getMultiplier: ({ turnNumber, generation }) => timerBallMult(turnNumber, generation),
    conditionLabel: ({ turnNumber, generation }) => {
      const m = timerBallMult(turnNumber, generation);
      return `${m.toFixed(2)}× (turn ${turnNumber})`;
    },
  },
  {
    id: "luxury-ball",
    name: "Luxury Ball",
    minGeneration: 3,
    getMultiplier: () => 1,
    conditionLabel: () => "1× (improves friendship)",
  },
  {
    id: "premier-ball",
    name: "Premier Ball",
    minGeneration: 3,
    getMultiplier: () => 1,
    conditionLabel: () => "1×",
  },
  {
    id: "dusk-ball",
    name: "Dusk Ball",
    minGeneration: 4,
    getMultiplier: ({ isDarkOrCave, generation }) =>
      isDarkOrCave ? (generation >= 6 ? 3 : 3.5) : 1,
    conditionLabel: ({ isDarkOrCave, generation }) =>
      isDarkOrCave ? `${generation >= 6 ? 3 : 3.5}× (night/cave)` : "1× (not night/cave)",
  },
  {
    id: "quick-ball",
    name: "Quick Ball",
    minGeneration: 4,
    getMultiplier: ({ turnNumber, generation }) =>
      turnNumber === 1 ? (generation >= 6 ? 5 : 4) : 1,
    conditionLabel: ({ turnNumber, generation }) =>
      turnNumber === 1 ? `${generation >= 6 ? 5 : 4}× (first turn!)` : "1× (not first turn)",
  },
  {
    id: "heal-ball",
    name: "Heal Ball",
    minGeneration: 4,
    getMultiplier: () => 1,
    conditionLabel: () => "1× (heals when caught)",
  },
  {
    id: "cherish-ball",
    name: "Cherish Ball",
    minGeneration: 4,
    getMultiplier: () => 1,
    conditionLabel: () => "1× (event Pokémon only)",
  },
  {
    id: "dream-ball",
    name: "Dream Ball",
    minGeneration: 5,
    getMultiplier: () => 1,
    conditionLabel: () => "1×",
  },
  {
    id: "beast-ball",
    name: "Beast Ball",
    minGeneration: 7,
    getMultiplier: ({ isUltraBeast }) => (isUltraBeast ? 5 : 0.1),
    conditionLabel: ({ isUltraBeast }) =>
      isUltraBeast ? "5× (Ultra Beast)" : "0.1× (not an Ultra Beast!)",
  },
];

/** Returns the list of balls valid for a given generation, sorted as a sensible pick list. */
export function ballsForGeneration(generation: number): Ball[] {
  return BALLS.filter((b) => b.minGeneration <= generation);
}

// ─── Status bonuses ───────────────────────────────────────────────────────────

/** Returns the status multiplier for Gen III+ (Gen V uses 2.5 for sleep/freeze). */
export function statusMultiplier(status: StatusCondition, generation: number): number {
  if (status === "sleep" || status === "freeze") {
    return generation >= 5 ? 2.5 : 2;
  }
  if (status === "paralysis" || status === "burn" || status === "poison") {
    return 1.5;
  }
  return 1;
}

/** Gen II status bonus (flat addition to `a`). */
export function statusBonusGen2(status: StatusCondition): number {
  if (status === "sleep" || status === "freeze") return 10;
  // Bug in Gen II: paralysis/burn/poison give no bonus
  return 0;
}

/** Gen I status threshold (added to m before comparison). */
export function statusThresholdGen1(status: StatusCondition): number {
  if (status === "sleep" || status === "freeze") return 25;
  if (status === "paralysis" || status === "burn" || status === "poison") return 12;
  return 0;
}

// ─── HP formula ───────────────────────────────────────────────────────────────

/** Estimate max HP at a given level (Gen III+), using 31 IVs / 0 EVs / neutral nature. */
export function estimateMaxHp(baseHp: number, level: number): number {
  if (level === 1) return Math.floor(((2 * baseHp + 31) / 100) + 12); // level-1 edge
  return Math.floor(((2 * baseHp + 31) * level) / 100) + level + 10;
}

// ─── Core catch formulas ─────────────────────────────────────────────────────

/** Gen I probability (simplified to a single probability value). */
function catchProbGen1(
  catchRate: number,
  maxHp: number,
  currentHp: number,
  ballId: string,
  status: StatusCondition,
): number {
  // Ball divisor: Great Ball = 8, others = 12
  const ballDiv = ballId === "great-ball" ? 8 : 12;
  // Random range: Poke=256, Great=201, Ultra/Safari=151
  const randRange = ballId === "ultra-ball" || ballId === "safari-ball" ? 151 : ballId === "great-ball" ? 201 : 256;

  const f = Math.min(255, Math.floor((maxHp * 255 * 4) / (currentHp * ballDiv)));
  const m = Math.floor((f * catchRate) / 255);
  const T = statusThresholdGen1(status);

  // P(first check passes) = (m + T + 1) / randRange
  const pFirst = Math.min(1, Math.max(0, (m + T + 1) / randRange));

  // Each shake check: gen I uses catchRate for the shake probability
  // simplified: use same m/255 as shake probability for 4 checks
  const shakePct = Math.min(1, (m + T + 1) / 256);
  const pShake = Math.pow(shakePct, 4);

  // Overall: pass first check AND 4 shake checks
  return pFirst * pShake;
}

/** Gen II probability. */
function catchProbGen2(
  catchRate: number,
  maxHp: number,
  currentHp: number,
  ballMult: number,
  status: StatusCondition,
): number {
  // rateModified = catchRate modified by ball (in Gen II, ball adjusts catch rate directly)
  // We approximate: treat ballMult as multiplying catch rate, cap at 255
  const rateModified = Math.min(255, Math.floor(catchRate * ballMult));
  const a = Math.min(255, Math.max(1,
    Math.floor((3 * maxHp - 2 * currentHp) * rateModified / (3 * maxHp))
  ) + statusBonusGen2(status));

  // In Gen II there's a b lookup table; approximate with (a/255)
  // 4 shake checks at the lookup probability
  return Math.pow(Math.min(1, a / 255), 4) * 0.5 + Math.min(1, a / 255) * 0.5;
  // Rough: linear interpolation between linear and power law for Gen II's table
}

/** Shared Gen III/IV formula → returns probability. */
function catchProbGen34(
  catchRate: number,
  maxHp: number,
  currentHp: number,
  ballMult: number,
  statusMult: number,
): number {
  const a = Math.min(255, Math.max(0,
    (3 * maxHp - 2 * currentHp) / (3 * maxHp) * catchRate * ballMult * statusMult
  ));
  if (a >= 255) return 1;
  // 4 shake checks, each with probability (a/255)^(1/4)
  // P = ((a/255)^(1/4))^4 = a/255
  return a / 255;
}

/** Gen V formula → returns probability. */
function catchProbGen5(
  catchRate: number,
  maxHp: number,
  currentHp: number,
  ballMult: number,
  statusMult: number,
): number {
  const inner = Math.floor(
    (3 * maxHp - 2 * currentHp) / (3 * maxHp) * 4096 * catchRate * ballMult
  );
  const a = inner * statusMult;
  const MAX_A = 1044480; // 255 * 4096
  if (a >= MAX_A) return 1;
  if (a <= 0) return 0;
  // 3 shake checks
  const b = Math.floor(65536 * Math.sqrt(a / MAX_A));
  return Math.pow(b / 65536, 3);
}

/** Gen VI–VII formula → returns probability. */
function catchProbGen67(
  catchRate: number,
  maxHp: number,
  currentHp: number,
  ballMult: number,
  statusMult: number,
): number {
  const inner = Math.floor(
    (3 * maxHp - 2 * currentHp) / (3 * maxHp) * 4096 * catchRate * ballMult
  );
  const a = inner * statusMult;
  const MAX_A = 1044480;
  if (a >= MAX_A) return 1;
  if (a <= 0) return 0;
  // 4 shake checks
  const b = Math.floor(65536 * Math.pow(a / MAX_A, 0.1875));
  return Math.pow(b / 65536, 4);
}

/** Gen VIII (SwSh/BDSP) formula — adds level bonus. */
function catchProbGen8(
  catchRate: number,
  maxHp: number,
  currentHp: number,
  ballMult: number,
  statusMult: number,
  level: number,
): number {
  const bonusLevel = Math.max(1, (30 - level) / 10);
  const inner = Math.floor(
    (3 * maxHp - 2 * currentHp) / (3 * maxHp) * 4096 * catchRate * ballMult
  );
  const a = inner * bonusLevel * statusMult;
  const MAX_A = 1044480;
  if (a >= MAX_A) return 1;
  if (a <= 0) return 0;
  const b = Math.floor(65536 * Math.pow(a / MAX_A, 0.1875));
  return Math.pow(b / 65536, 4);
}

/** Gen IX (SV) formula — adds level bonus for low-level Pokémon. */
function catchProbGen9(
  catchRate: number,
  maxHp: number,
  currentHp: number,
  ballMult: number,
  statusMult: number,
  level: number,
): number {
  const bonusLevel = level < 13 ? Math.max(1, (36 - 2 * level) / 10) : 1;
  const inner = Math.floor(
    (3 * maxHp - 2 * currentHp) / (3 * maxHp) * 4096 * catchRate * ballMult
  );
  const a = inner * bonusLevel * statusMult;
  const MAX_A = 1044480;
  if (a >= MAX_A) return 1;
  if (a <= 0) return 0;
  const b = Math.floor(65536 * Math.pow(a / MAX_A, 0.1875));
  return Math.pow(b / 65536, 4);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CatchInputs {
  /** PokéAPI catch rate, 0–255. */
  catchRate: number;
  /** Base HP stat. */
  baseHp: number;
  level: number;
  /** 0–100 (inclusive). */
  hpPercent: number;
  ball: Ball;
  ballContext: BallContext;
  status: StatusCondition;
  generation: number;
}

export interface CatchResult {
  /** 0–1. */
  probability: number;
  /** Expected number of throws (1 / probability, or 1 for guaranteed). */
  expectedThrows: number;
  /** The effective ball multiplier for display. */
  effectiveBallMult: number;
  /** The effective status multiplier for display. */
  effectiveStatusMult: number;
  /** Estimated max HP. */
  maxHp: number;
  /** Estimated current HP. */
  currentHp: number;
  /** The intermediate a value (if applicable). */
  aValue: number | null;
}

export function calculateCatch(inputs: CatchInputs): CatchResult {
  const { catchRate, baseHp, level, hpPercent, ball, ballContext, status, generation } = inputs;

  const maxHp = estimateMaxHp(baseHp, level);
  const currentHp = Math.max(1, Math.floor(maxHp * hpPercent / 100));

  // Handle guaranteed catch
  if (ball.getMultiplier(ballContext) === Infinity) {
    return { probability: 1, expectedThrows: 1, effectiveBallMult: Infinity, effectiveStatusMult: 1, maxHp, currentHp, aValue: null };
  }

  // Resolve effective catch rate (Heavy Ball is additive)
  let effectiveCatchRate = catchRate;
  if (ball.isAdditive && ball.getBonus) {
    effectiveCatchRate = Math.min(255, Math.max(0, catchRate + ball.getBonus(ballContext)));
  }
  const ballMult = ball.isAdditive ? 1 : ball.getMultiplier(ballContext);
  const statusMult = statusMultiplier(status, generation);

  let probability: number;
  let aValue: number | null = null;

  if (generation === 1) {
    probability = catchProbGen1(effectiveCatchRate, maxHp, currentHp, ball.id, status);
  } else if (generation === 2) {
    probability = catchProbGen2(effectiveCatchRate, maxHp, currentHp, ballMult, status);
  } else if (generation <= 4) {
    const a = Math.min(255, Math.max(0,
      (3 * maxHp - 2 * currentHp) / (3 * maxHp) * effectiveCatchRate * ballMult * statusMult
    ));
    aValue = a;
    probability = catchProbGen34(effectiveCatchRate, maxHp, currentHp, ballMult, statusMult);
  } else if (generation === 5) {
    const inner = Math.floor(
      (3 * maxHp - 2 * currentHp) / (3 * maxHp) * 4096 * effectiveCatchRate * ballMult
    );
    aValue = inner * statusMult;
    probability = catchProbGen5(effectiveCatchRate, maxHp, currentHp, ballMult, statusMult);
  } else if (generation <= 7) {
    const inner = Math.floor(
      (3 * maxHp - 2 * currentHp) / (3 * maxHp) * 4096 * effectiveCatchRate * ballMult
    );
    aValue = inner * statusMult;
    probability = catchProbGen67(effectiveCatchRate, maxHp, currentHp, ballMult, statusMult);
  } else if (generation === 8) {
    const bonusLevel = Math.max(1, (30 - level) / 10);
    const inner = Math.floor(
      (3 * maxHp - 2 * currentHp) / (3 * maxHp) * 4096 * effectiveCatchRate * ballMult
    );
    aValue = inner * bonusLevel * statusMult;
    probability = catchProbGen8(effectiveCatchRate, maxHp, currentHp, ballMult, statusMult, level);
  } else {
    // Gen 9+
    const bonusLevel = level < 13 ? Math.max(1, (36 - 2 * level) / 10) : 1;
    const inner = Math.floor(
      (3 * maxHp - 2 * currentHp) / (3 * maxHp) * 4096 * effectiveCatchRate * ballMult
    );
    aValue = inner * bonusLevel * statusMult;
    probability = catchProbGen9(effectiveCatchRate, maxHp, currentHp, ballMult, statusMult, level);
  }

  probability = Math.min(1, Math.max(0, probability));
  const expectedThrows = probability > 0 ? 1 / probability : Infinity;

  return { probability, expectedThrows, effectiveBallMult: ballMult, effectiveStatusMult: statusMult, maxHp, currentHp, aValue };
}

/** Map from game value to generation number (returns 9 for unknown). */
export function generationForGame(gameValue: string | null): number {
  const map: Record<string, number> = {
    "red-blue-yellow": 1,
    "gold-silver-crystal": 2,
    "ruby-sapphire-emerald": 3,
    "firered-leafgreen": 3,
    "diamond-pearl-platinum": 4,
    "heartgold-soulsilver": 4,
    "black-white": 5,
    "black2-white2": 5,
    "x-y": 6,
    "omega-ruby-alpha-sapphire": 6,
    "sun-moon": 7,
    "ultra-sun-ultra-moon": 7,
    "lets-go": 7,       // LGPE uses a unique system; approximate with Gen VII
    "sword-shield": 8,
    "brilliant-diamond-shining-pearl": 8,
    "legends-arceus": 8, // PLA uses a unique system; approximate with Gen VIII
    "scarlet-violet": 9,
  };
  return map[gameValue ?? ""] ?? 9;
}

/** Returns a short note for games that use a significantly different catch system. */
export function catchSystemNote(gameValue: string | null): string | null {
  if (gameValue === "lets-go") return "Pokémon: Let's Go uses a throw-accuracy system — results here are an approximation.";
  if (gameValue === "legends-arceus") return "Legends: Arceus uses a different formula involving Star Rank and field behavior — results here are an approximation.";
  return null;
}
