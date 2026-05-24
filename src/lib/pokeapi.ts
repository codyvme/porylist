import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import pokemonSummaryRaw from "../data/pokemon-summary.json";

const BASE = "https://pokeapi.co/api/v2";

export interface PokemonListEntry {
  name: string;
  url: string;
}

export interface PokemonListResponse {
  count: number;
  results: PokemonListEntry[];
}

export interface PokemonType {
  slot: number;
  type: { name: string; url: string };
}

export interface PokemonSprites {
  front_default: string | null;
  versions?: {
    "generation-v"?: {
      "black-white"?: {
        animated?: { front_default: string | null };
      };
    };
  };
}

export interface PokemonAbility {
  ability: { name: string; url: string };
  is_hidden: boolean;
  slot: number;
}

export interface PokemonMoveVersionGroupDetail {
  level_learned_at: number;
  move_learn_method: { name: string; url: string };
  version_group: { name: string; url: string };
}

export interface PokemonMove {
  move: { name: string; url: string };
  version_group_details: PokemonMoveVersionGroupDetail[];
}

export interface MoveEffectEntry {
  effect: string;
  short_effect: string;
  language: { name: string; url: string };
}

export interface MoveFlavorTextEntry {
  flavor_text: string;
  language: { name: string; url: string };
  version_group: { name: string; url: string };
}

export interface AbilityFlavorTextEntry {
  flavor_text: string;
  language: { name: string; url: string };
  version_group: { name: string; url: string };
}

export interface MoveDetail {
  id: number;
  name: string;
  type: { name: string; url: string };
  damage_class: { name: string; url: string };
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  effect_chance: number | null;
  effect_entries: MoveEffectEntry[];
  flavor_text_entries: MoveFlavorTextEntry[];
  names: Array<{ name: string; language: { name: string; url: string } }>;
  machines: Array<{ machine: { url: string }; version_group: { name: string; url: string } }>;
}

export interface MachineDetail {
  id: number;
  item: { name: string; url: string };
  move: { name: string; url: string };
  version_group: { name: string; url: string };
}

export interface AbilityDetail {
  id: number;
  name: string;
  effect_entries: MoveEffectEntry[];
  flavor_text_entries: AbilityFlavorTextEntry[];
}

export interface PokemonStat {
  base_stat: number;
  effort: number;
  stat: { name: string; url: string };
}

export interface PokemonPastType {
  generation: { name: string; url: string };
  types: PokemonType[];
}

export interface Pokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: PokemonType[];
  past_types: PokemonPastType[];
  sprites: PokemonSprites;
  stats: PokemonStat[];
  abilities: PokemonAbility[];
  moves: PokemonMove[];
  species: { name: string; url: string };
}

/** Compact summary used for the Pokédex table — single file, no per-Pokémon fetches. */
export interface PokemonSummary {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: PokemonType[];
  past_types: PokemonPastType[];
  stats: Array<{ base_stat: number; stat: { name: string } }>;
  abilities: Array<{ ability: { name: string }; is_hidden: boolean; slot: number }>;
  species: { name: string };
  /** moveName → sorted array of generation numbers the move is available in */
  moves: Record<string, number[]>;
}

export interface PokemonSpecies {
  capture_rate: number;
  base_happiness: number;
  growth_rate: { name: string; url: string };
  gender_rate: number;
  color: { name: string; url: string };
  is_baby: boolean;
  is_legendary: boolean;
  is_mythical: boolean;
  evolves_from_species: { name: string; url: string } | null;
  genera: Array<{ genus: string; language: { name: string; url: string } }>;
  egg_groups: Array<{ name: string; url: string }>;
  flavor_text_entries: Array<{
    flavor_text: string;
    language: { name: string; url: string };
    version: { name: string; url: string };
  }>;
  evolution_chain: { url: string };
}

export type PokemonSpeciesMap = Record<string, PokemonSpecies>;

export function useAllPokemonSpecies(names: string[]) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["pokemon-species-all", [...names].sort().join(",")],
    enabled: names.length > 0,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    queryFn: async () => {
      const results = await Promise.allSettled(
        names.map((name) =>
          queryClient.fetchQuery<PokemonSpecies>({
            queryKey: ["pokemon-species", name],
            queryFn: () => fetchJson<PokemonSpecies>(`${BASE}/pokemon-species/${name}`),
            staleTime: Infinity,
          }),
        ),
      );
      const map: PokemonSpeciesMap = {};
      for (let i = 0; i < names.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled") map[names[i]] = r.value;
      }
      return map;
    },
  });
}

export interface EvolutionDetail {
  trigger: { name: string; url: string };
  min_level: number | null;
  item: { name: string; url: string } | null;
  held_item: { name: string; url: string } | null;
  min_happiness: number | null;
  min_beauty: number | null;
  min_affection: number | null;
  time_of_day: string;
  known_move: { name: string; url: string } | null;
  known_move_type: { name: string; url: string } | null;
  location: { name: string; url: string } | null;
  gender: number | null;
  needs_overworld_rain: boolean;
  relative_physical_stats: number | null;
  trade_species: { name: string; url: string } | null;
  turn_upside_down: boolean;
}

export interface ChainLink {
  species: { name: string; url: string };
  evolution_details: EvolutionDetail[];
  evolves_to: ChainLink[];
}

export interface EvolutionChain {
  id: number;
  chain: ChainLink;
}

const GEN_NAME_TO_NUM: Record<string, number> = {
  "generation-i": 1,
  "generation-ii": 2,
  "generation-iii": 3,
  "generation-iv": 4,
  "generation-v": 5,
  "generation-vi": 6,
  "generation-vii": 7,
  "generation-viii": 8,
  "generation-ix": 9,
};

/**
 * Resolves a Pokémon's types as they were in a given generation, accounting
 * for retconned typings (e.g. Fairy added in gen 6). Pass `undefined` for the
 * current/latest typing.
 */
export function typesForGeneration(
  pokemon: { types: PokemonType[]; past_types: PokemonPastType[] },
  generation: number | undefined,
): string[] {
  if (generation == null || pokemon.past_types.length === 0) {
    return pokemon.types.map((t) => t.type.name);
  }
  const past = pokemon.past_types
    .map((p) => ({
      gen: GEN_NAME_TO_NUM[p.generation.name] ?? 99,
      types: p.types,
    }))
    .sort((a, b) => a.gen - b.gen);
  for (const p of past) {
    if (generation <= p.gen) return p.types.map((t) => t.type.name);
  }
  return pokemon.types.map((t) => t.type.name);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

export function extractIdFromUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : 0;
}

export function usePokemonList(limit = 1025) {
  return useQuery({
    queryKey: ["pokemon-list", limit],
    queryFn: () =>
      fetchJson<PokemonListResponse>(`${BASE}/pokemon?limit=${limit}&offset=0`),
    staleTime: Infinity,
  });
}

export function usePokemonDetails(names: string[]) {
  return useQueries({
    queries: names.map((name) => ({
      queryKey: ["pokemon", name],
      queryFn: () => fetchJson<Pokemon>(`${BASE}/pokemon/${name}`),
      staleTime: Infinity,
    })),
  });
}

export function usePokemonSummaryList() {
  return {
    data: pokemonSummaryRaw as PokemonSummary[],
    isLoading: false as const,
    error: null,
  };
}

type PokemonDetailsMap = Record<string, Pokemon>;

export const VERSION_GROUP_TO_GEN: Record<string, number> = {
  "red-blue": 1, "yellow": 1,
  "gold-silver": 2, "crystal": 2,
  "ruby-sapphire": 3, "emerald": 3, "firered-leafgreen": 3, "colosseum": 3, "xd": 3,
  "diamond-pearl": 4, "platinum": 4, "heartgold-soulsilver": 4,
  "black-white": 5, "black-2-white-2": 5,
  "x-y": 6, "omega-ruby-alpha-sapphire": 6,
  "sun-moon": 7, "ultra-sun-ultra-moon": 7, "lets-go-pikachu-lets-go-eevee": 7,
  "sword-shield": 8, "brilliant-diamond-and-shining-pearl": 8, "legends-arceus": 8,
  "scarlet-violet": 9,
};

export interface PokemonForm {
  id: number;
  name: string;
  form_name: string;
  is_default: boolean;
  is_mega: boolean;
  version_group: { name: string; url: string } | null;
  names: Array<{ name: string; language: { name: string; url: string } }>;
  form_names: Array<{ name: string; language: { name: string; url: string } }>;
}

export type PokemonFormDataMap = Record<string, PokemonForm>;

export function useAllPokemonEntries() {
  return useQuery({
    queryKey: ["pokemon-all-entries"],
    queryFn: () =>
      fetchJson<PokemonListResponse>(`${BASE}/pokemon?limit=10000&offset=0`),
    staleTime: Infinity,
  });
}

export function useFormDetails(names: string[]) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["form-details", [...names].sort()],
    enabled: names.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const results = await Promise.all(
        names.map((name) =>
          queryClient.fetchQuery<Pokemon>({
            queryKey: ["pokemon", name],
            queryFn: () => fetchJson<Pokemon>(`${BASE}/pokemon/${name}`),
            staleTime: Infinity,
          }),
        ),
      );
      const map: PokemonDetailsMap = {};
      for (const d of results) map[d.name] = d;
      return map;
    },
  });
}

export function usePokemonFormData(names: string[]) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["pokemon-form-data", [...names].sort()],
    enabled: names.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const results = await Promise.all(
        names.map((name) =>
          queryClient.fetchQuery<PokemonForm>({
            queryKey: ["pokemon-form", name],
            queryFn: () =>
              fetchJson<PokemonForm>(`${BASE}/pokemon-form/${name}`),
            staleTime: Infinity,
          }),
        ),
      );
      const map: PokemonFormDataMap = {};
      for (const d of results) map[d.name] = d;
      return map;
    },
  });
}

export function useSinglePokemon(name: string | null) {
  return useQuery({
    queryKey: ["pokemon", name],
    enabled: name != null,
    queryFn: () => fetchJson<Pokemon>(`${BASE}/pokemon/${name}`),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
  });
}

export function usePokemonSpecies(speciesName: string | null) {
  return useQuery({
    queryKey: ["pokemon-species", speciesName],
    enabled: speciesName != null,
    queryFn: () => fetchJson<PokemonSpecies>(`${BASE}/pokemon-species/${speciesName}`),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
  });
}

export function useMoveDetails(names: string[]) {
  return useQueries({
    queries: names.map((name) => ({
      queryKey: ["move", name],
      queryFn: () => fetchJson<MoveDetail>(`${BASE}/move/${name}`),
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60 * 24 * 30,
    })),
  });
}

export interface EncounterDetail {
  chance: number;
  condition_values: Array<{ name: string; url: string }>;
  max_level: number;
  method: { name: string; url: string };
  min_level: number;
}

export interface LocationAreaEncounter {
  location_area: { name: string; url: string };
  version_details: Array<{
    encounter_details: EncounterDetail[];
    max_chance: number;
    version: { name: string; url: string };
  }>;
}

export function usePokemonEncounters(pokemonId: number | null) {
  return useQuery({
    queryKey: ["pokemon-encounters", pokemonId],
    enabled: pokemonId != null,
    queryFn: () =>
      fetchJson<LocationAreaEncounter[]>(`${BASE}/pokemon/${pokemonId}/encounters`),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
  });
}

export function useMachineDetails(urls: string[]) {
  return useQueries({
    queries: urls.map((url) => ({
      queryKey: ["machine", url],
      queryFn: () => fetchJson<MachineDetail>(url),
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60 * 24 * 30,
    })),
  });
}

export function useAbilityDetails(names: string[]) {
  return useQueries({
    queries: names.map((name) => ({
      queryKey: ["ability", name],
      queryFn: () => fetchJson<AbilityDetail>(`${BASE}/ability/${name}`),
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60 * 24 * 30,
    })),
  });
}

export function useEvolutionChain(url: string | null) {
  return useQuery({
    queryKey: ["evolution-chain", url],
    enabled: url != null,
    queryFn: () => fetchJson<EvolutionChain>(url!),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
  });
}

export interface VersionExclusiveEntry {
  key: string;
  label: string;
  exclusiveIds: number[];
}

export interface VersionExclusiveGroup {
  versions: VersionExclusiveEntry[];
}

export type VersionExclusivesData = Record<string, VersionExclusiveGroup>;

export interface HeldItem {
  item: string;
  rarity: number;
}

export interface RouteEncounter {
  id: number;
  name: string;
  version: string;
  method: string;
  methodLabel: string;
  timeOfDay: string;  // "morning" | "day" | "night" | ""
  minLevel: number;
  maxLevel: number;
  chance: number;
  heldItems: HeldItem[];
}

export interface RouteLocation {
  key: string;
  label: string;
  encounters: RouteEncounter[];
}

export interface RouteData {
  locations: RouteLocation[];
}

export function useRouteData(gameValue: string | null) {
  return useQuery({
    queryKey: ["route-data", gameValue],
    enabled: gameValue != null,
    queryFn: () => fetchJson<RouteData>(`/data/route-data/${gameValue}.json`),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
  });
}

export interface MoveListEntry {
  id: number;
  name: string;
  displayName: string;
  type: string;
  category: string;     // "physical" | "special" | "status"
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  effectChance: number | null;
  shortEffect: string;
  generationId: number; // 1–9, generation the move was introduced
}

export interface AbilityListEntry {
  id: number;
  name: string;
  displayName: string;
  shortEffect: string;
  generationId: number; // 1–9
}

export interface ItemListEntry {
  id: number;
  name: string;
  displayName: string;
  category: string;        // slug, e.g. "held-items"
  categoryDisplay: string; // e.g. "Held Items"
  shortEffect: string;
  cost: number;            // buy price in PokéDollars; 0 = not sold
  generationId: number;    // 3–9 (PokéAPI doesn't track items before Gen III)
}

export function useMoveList() {
  return useQuery({
    queryKey: ["move-list"],
    queryFn: () => fetchJson<MoveListEntry[]>(`/data/moves.json`),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
  });
}

export function useAbilityList() {
  return useQuery({
    queryKey: ["ability-list"],
    queryFn: () => fetchJson<AbilityListEntry[]>(`/data/abilities.json`),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
  });
}

export function useItemList() {
  return useQuery({
    queryKey: ["item-list"],
    queryFn: () => fetchJson<ItemListEntry[]>(`/data/items.json`),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
  });
}

export function useSingleMoveDetail(name: string | null) {
  return useQuery({
    queryKey: ["move", name],
    enabled: name != null,
    queryFn: () => fetchJson<MoveDetail>(`${BASE}/move/${name}`),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
  });
}

export function useSingleAbilityDetail(name: string | null) {
  return useQuery({
    queryKey: ["ability", name],
    enabled: name != null,
    queryFn: () => fetchJson<AbilityDetail>(`${BASE}/ability/${name}`),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
  });
}

export function useVersionExclusives() {
  return useQuery({
    queryKey: ["version-exclusives"],
    queryFn: () => fetchJson<VersionExclusivesData>(`/data/version-exclusives.json`),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
  });
}
