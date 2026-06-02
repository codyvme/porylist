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

// ── Playthroughs ──────────────────────────────────────────────────────────

export async function fetchPlaythroughsFromDB(userId: string): Promise<import("./playthroughs").Playthrough[]> {
  const { data, error } = await supabase
    .from("playthroughs")
    .select("data")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data.map((row) => row.data as import("./playthroughs").Playthrough);
}

export async function upsertPlaythrough(userId: string, playthrough: import("./playthroughs").Playthrough) {
  return supabase.from("playthroughs").upsert({
    id: playthrough.id,
    user_id: userId,
    data: playthrough,
    updated_at: new Date().toISOString(),
  });
}

export async function deletePlaythrough(playthroughId: string) {
  return supabase.from("playthroughs").delete().eq("id", playthroughId);
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

// ── Shiny hunts ────────────────────────────────────────────────────────────

export async function fetchShinyHuntsFromDB(userId: string): Promise<import("./shiny-hunts").ShinyHunt[]> {
  const { data, error } = await supabase
    .from("shiny_hunts")
    .select("data")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data.map((row) => row.data as import("./shiny-hunts").ShinyHunt);
}

export async function upsertShinyHunt(userId: string, hunt: import("./shiny-hunts").ShinyHunt) {
  return supabase.from("shiny_hunts").upsert({
    id: hunt.id,
    user_id: userId,
    data: hunt,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteShinyHunt(huntId: string) {
  return supabase.from("shiny_hunts").delete().eq("id", huntId);
}

// ── User profiles ─────────────────────────────────────────────────────────

export interface UserProfile {
  userId: string;
  username: string | null;
  avatarPokemon: string | null;
  avatarBgColor: string | null;
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("username, avatar_pokemon, avatar_bg_color")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    userId,
    username: data.username ?? null,
    avatarPokemon: data.avatar_pokemon ?? null,
    avatarBgColor: data.avatar_bg_color ?? null,
  };
}

export async function upsertUserProfile(profile: UserProfile): Promise<void> {
  await supabase.from("user_profiles").upsert({
    user_id: profile.userId,
    username: profile.username,
    avatar_pokemon: profile.avatarPokemon,
    avatar_bg_color: profile.avatarBgColor,
    updated_at: new Date().toISOString(),
  });
}

export async function fetchDashboardConfig(userId: string): Promise<Record<string, boolean> | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("dashboard_config")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { dashboard_config: Record<string, boolean> | null }).dashboard_config ?? null;
}

export async function upsertDashboardConfig(userId: string, config: Record<string, boolean>): Promise<void> {
  await supabase.from("user_profiles").upsert({
    user_id: userId,
    dashboard_config: config,
    updated_at: new Date().toISOString(),
  });
}

export async function purgeUserData(userId: string): Promise<void> {
  await Promise.all([
    supabase.from("caught_pokemon").delete().eq("user_id", userId),
    supabase.from("breeding_projects").delete().eq("user_id", userId),
    supabase.from("playthroughs").delete().eq("user_id", userId),
    supabase.from("shiny_hunts").delete().eq("user_id", userId),
  ]);
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
