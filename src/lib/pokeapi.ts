import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

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
  types: PokemonType[];
  past_types: PokemonPastType[];
  sprites: PokemonSprites;
  stats: PokemonStat[];
  abilities: PokemonAbility[];
  moves: PokemonMove[];
  species: { name: string; url: string };
}

export interface PokemonSpecies {
  flavor_text_entries: Array<{
    flavor_text: string;
    language: { name: string; url: string };
    version: { name: string; url: string };
  }>;
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
  pokemon: Pokemon,
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
  if (!res.ok) throw new Error(`PokeAPI ${res.status}: ${url}`);
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

export type PokemonDetailsMap = Record<string, Pokemon>;

export function useAllPokemonDetails(names: string[]) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["pokemon-details-map", names.length],
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

export interface PokedexResponse {
  name: string;
  pokemon_entries: Array<{
    entry_number: number;
    pokemon_species: { name: string; url: string };
  }>;
}

export function usePokedexes(names: string[]) {
  return useQueries({
    queries: names.map((name) => ({
      queryKey: ["pokedex", name],
      queryFn: () => fetchJson<PokedexResponse>(`${BASE}/pokedex/${name}`),
      staleTime: Infinity,
    })),
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
