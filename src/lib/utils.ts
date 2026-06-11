import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turn a hyphenated API slug into a Title-Cased, space-separated label. */
export function titleCaseSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const POKEMON_NAME_OVERRIDES: Record<string, string> = {
  "nidoran-f": "Nidoran♀",
  "nidoran-m": "Nidoran♂",
};

export function formatPokemonName(apiName: string): string {
  if (POKEMON_NAME_OVERRIDES[apiName]) return POKEMON_NAME_OVERRIDES[apiName];
  return titleCaseSlug(apiName);
}
