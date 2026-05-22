import { createClient } from "@supabase/supabase-js";
import type { Session, User } from "@supabase/supabase-js";

export type { Session, User };

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

export async function signInWithEmail(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function fetchCaughtFromDB(userId: string): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from("caught_pokemon")
    .select("game_key, pokemon_name")
    .eq("user_id", userId);

  if (error || !data) return {};

  const result: Record<string, string[]> = {};
  for (const row of data) {
    if (!result[row.game_key]) result[row.game_key] = [];
    result[row.game_key].push(row.pokemon_name);
  }
  return result;
}

export async function insertCaught(userId: string, gameKey: string, pokemonName: string) {
  return supabase
    .from("caught_pokemon")
    .insert({ user_id: userId, game_key: gameKey, pokemon_name: pokemonName });
}

export async function deleteCaught(userId: string, gameKey: string, pokemonName: string) {
  return supabase
    .from("caught_pokemon")
    .delete()
    .eq("user_id", userId)
    .eq("game_key", gameKey)
    .eq("pokemon_name", pokemonName);
}

// ── Breeding projects ──────────────────────────────────────────────────────

export async function fetchBreedingProjectsFromDB(userId: string): Promise<import("./breeding").BreedingProject[]> {
  const { data, error } = await supabase
    .from("breeding_projects")
    .select("data")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data.map((row) => row.data as import("./breeding").BreedingProject);
}

export async function upsertBreedingProject(userId: string, project: import("./breeding").BreedingProject) {
  return supabase.from("breeding_projects").upsert({
    id: project.id,
    user_id: userId,
    data: project,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteBreedingProject(projectId: string) {
  return supabase.from("breeding_projects").delete().eq("id", projectId);
}

// ── Account deletion ───────────────────────────────────────────────────────

export async function deleteAccount() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Failed to delete account");
  }

  // Sign out locally after successful deletion
  await supabase.auth.signOut();
}
