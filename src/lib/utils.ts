import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const POKEMON_NAME_OVERRIDES: Record<string, string> = {
  "nidoran-f": "Nidoran♀",
  "nidoran-m": "Nidoran♂",
};

export function formatPokemonName(apiName: string): string {
  if (POKEMON_NAME_OVERRIDES[apiName]) return POKEMON_NAME_OVERRIDES[apiName];
  return apiName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
