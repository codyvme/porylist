import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Mail, Trash2, UserRound, X } from "lucide-react";
import { cn, formatPokemonName } from "@/lib/utils";
import { usePokemonSummaryList } from "@/lib/pokeapi";
import { spriteUrl } from "@/lib/games";
import { SpriteImg } from "@/components/SpriteImg";
import {
  upsertUserProfile,
  updateEmail,
  purgeUserData,
  deleteAccount,
  type UserProfile,
  type User,
} from "@/lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#0883A4", "#FF6362", "#7C3AED", "#DB2777",
  "#2563EB", "#059669", "#CA8A04", "#EA580C",
  "#DC2626", "#0F766E", "#475569", "#1E293B",
];

// ─── UserAvatar (exported for use in UserMenu) ────────────────────────────────

export function UserAvatar({
  profile,
  email,
  className,
  size = 32,
}: {
  profile: UserProfile | null;
  email?: string;
  className?: string;
  size?: number;
}) {
  const { data: summaryList } = usePokemonSummaryList();

  if (profile?.avatarPokemon) {
    const entry = summaryList?.find((s) => s.name === profile.avatarPokemon);
    const bgColor = profile.avatarBgColor ?? "#0883A4";
    return (
      <div
        className={cn("shrink-0 overflow-hidden rounded-full", className)}
        style={{ width: size, height: size, backgroundColor: bgColor }}
      >
        {entry && (
          <SpriteImg src={spriteUrl(entry.id, undefined)} alt={profile.avatarPokemon} size="h-full w-full" />
        )}
      </div>
    );
  }

  // Initials fallback
  const initials = (email ?? "?")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-slate-600 text-white font-semibold",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

// ─── AccountSettingsModal ─────────────────────────────────────────────────────

export function AccountSettingsModal({
  user,
  profile,
  onProfileUpdate,
  onPurge,
  onClose,
}: {
  user: User;
  profile: UserProfile | null;
  onProfileUpdate: (p: UserProfile) => void;
  onPurge: () => void;
  onClose: () => void;
}) {
  const { data: summaryList } = usePokemonSummaryList();

  // Profile edit state
  const [username, setUsername] = useState(profile?.username ?? "");
  const [avatarPokemon, setAvatarPokemon] = useState<string | null>(profile?.avatarPokemon ?? null);
  const [avatarBgColor, setAvatarBgColor] = useState(profile?.avatarBgColor ?? "#0883A4");
  const [pokemonSearch, setPokemonSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Email change state
  const [emailStep, setEmailStep] = useState<"idle" | "editing" | "sent">("idle");
  const [newEmail, setNewEmail] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function handleChangeEmail() {
    setEmailSending(true);
    setEmailError(null);
    const { error } = await updateEmail(newEmail.trim());
    setEmailSending(false);
    if (error) {
      setEmailError(error.message);
    } else {
      setEmailStep("sent");
      setNewEmail("");
    }
  }

  // Data management state
  const [purgeStep, setPurgeStep] = useState<"idle" | "confirm">("idle");
  const [purging, setPurging] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deleting, setDeleting] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Pokémon search results
  const pokemonResults = useMemo(() => {
    if (!summaryList) return [];
    if (!pokemonSearch.trim()) return summaryList.slice(0, 30);
    const q = pokemonSearch.toLowerCase();
    return summaryList
      .filter((s) => s.name.includes(q) || formatPokemonName(s.name).toLowerCase().includes(q))
      .slice(0, 30);
  }, [summaryList, pokemonSearch]);

  const currentAvatarProfile: UserProfile = {
    userId: user.id,
    username: username || null,
    avatarPokemon,
    avatarBgColor,
  };

  async function handleSaveProfile() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await upsertUserProfile(currentAvatarProfile);
      onProfileUpdate(currentAvatarProfile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const caught = (() => {
      try { return JSON.parse(localStorage.getItem("porylist-caught") ?? "{}"); }
      catch { return {}; }
    })();
    const team = (() => {
      try { return JSON.parse(localStorage.getItem("porylist-team") ?? "[]"); }
      catch { return []; }
    })();
    const breeding = (() => {
      try { return JSON.parse(localStorage.getItem("porylist-breeding-v1") ?? "[]"); }
      catch { return []; }
    })();

    const payload = {
      exported_at: new Date().toISOString(),
      username: profile?.username ?? null,
      caught,
      team,
      breeding_projects: breeding,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `porylist-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePurge() {
    setPurging(true);
    setDataError(null);
    try {
      await purgeUserData(user.id);
      localStorage.removeItem("porylist-caught");
      localStorage.removeItem("porylist-team");
      localStorage.removeItem("porylist-breeding-v1");
      localStorage.removeItem("porylist-cache-v7");
      onPurge();
      window.location.reload();
    } catch {
      setDataError("Failed to purge data. Please try again.");
      setPurging(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDataError(null);
    try {
      await deleteAccount();
      localStorage.removeItem("porylist-caught");
      localStorage.removeItem("porylist-team");
      localStorage.removeItem("porylist-breeding-v1");
      localStorage.removeItem("porylist-cache-v7");
      window.location.reload();
    } catch {
      setDataError("Failed to delete account. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative flex w-full max-w-lg flex-col rounded-xl bg-background shadow-xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
          <h2 className="text-base font-semibold">Account Settings</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

          {/* ── Profile section ── */}
          <section>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profile</h3>

            {/* Preview + username row */}
            <div className="flex items-center gap-4 mb-5">
              <UserAvatar profile={currentAvatarProfile} email={user.email} size={56} />
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={user.email?.split("@")[0] ?? "Your name"}
                  maxLength={32}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Avatar builder */}
            <div className="rounded-lg border p-4 space-y-4">
              <p className="text-sm font-medium">Profile picture</p>

              {/* Color swatches */}
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Background color</p>
                <div className="flex flex-wrap items-center gap-2">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setAvatarBgColor(color)}
                      className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: color }}
                      aria-label={color}
                      title={color}
                    >
                      {avatarBgColor === color && (
                        <Check className="mx-auto h-3.5 w-3.5 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                  {/* Custom color picker */}
                  <div className="relative">
                    <input
                      type="color"
                      value={avatarBgColor}
                      onChange={(e) => setAvatarBgColor(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      title="Custom color"
                    />
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 text-[10px] font-bold text-muted-foreground hover:border-muted-foreground transition-colors"
                      title="Custom color"
                    >
                      +
                    </div>
                  </div>
                </div>
              </div>

              {/* Pokémon picker */}
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Pokémon sprite</p>
                <input
                  type="text"
                  value={pokemonSearch}
                  onChange={(e) => setPokemonSearch(e.target.value)}
                  placeholder="Search Pokémon…"
                  className="mb-3 h-8 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="grid grid-cols-6 gap-1.5 max-h-44 overflow-y-auto p-0.5">
                  {/* Clear selection */}
                  <button
                    onClick={() => setAvatarPokemon(null)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-md p-1.5 text-center transition-colors",
                      avatarPokemon === null
                        ? "bg-primary/10 ring-2 ring-primary"
                        : "hover:bg-muted",
                    )}
                    title="No sprite"
                  >
                    <UserRound className="h-8 w-8 text-muted-foreground/50" />
                    <span className="text-[9px] text-muted-foreground leading-none">None</span>
                  </button>

                  {pokemonResults.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => setAvatarPokemon(s.name)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-md p-1 text-center transition-colors",
                        avatarPokemon === s.name
                          ? "bg-primary/10 ring-2 ring-primary"
                          : "hover:bg-muted",
                      )}
                      title={formatPokemonName(s.name)}
                    >
                      <SpriteImg src={spriteUrl(s.id, undefined)} alt={s.name} size="h-8 w-8" />
                      <span className="line-clamp-1 text-[9px] text-muted-foreground leading-none">
                        {formatPokemonName(s.name)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save button */}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              {saved && (
                <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              )}
              {saveError && <span className="text-sm text-destructive">{saveError}</span>}
            </div>
          </section>

          {/* ── Email section ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Email</h3>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{user.email}</span>
            </div>
            {emailStep === "idle" && (
              <button
                onClick={() => { setEmailStep("editing"); setEmailError(null); }}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Change email
              </button>
            )}
            {emailStep === "editing" && (
              <div className="space-y-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newEmail.trim()) handleChangeEmail(); if (e.key === "Escape") { setEmailStep("idle"); setEmailError(null); } }}
                  placeholder="New email address"
                  autoFocus
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEmailStep("idle"); setEmailError(null); setNewEmail(""); }}
                    className="rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangeEmail}
                    disabled={emailSending || !newEmail.trim()}
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {emailSending ? "Sending…" : "Send confirmation"}
                  </button>
                </div>
              </div>
            )}
            {emailStep === "sent" && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Confirmation sent</p>
                  <p className="text-xs mt-0.5 opacity-80">Check your new inbox and click the link to confirm the change.</p>
                </div>
              </div>
            )}
          </section>

          {/* ── Data Management section ── */}
          <section className="space-y-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Data Management</h3>

            {/* Export */}
            <div>
              <p className="mb-1 text-sm font-medium">Export your data</p>
              <p className="mb-3 text-sm text-muted-foreground">
                Download a JSON file with all your caught Pokémon, breeding projects, and team.
              </p>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Download className="h-4 w-4" />
                Export data
              </button>
            </div>

            <hr className="border-border" />

            {/* Purge */}
            <div>
              <p className="mb-1 text-sm font-medium">Purge site data</p>
              <p className="mb-3 text-sm text-muted-foreground">
                Clears all your caught Pokémon and breeding projects from Porylist — locally and from our servers. Your account is kept.
              </p>
              {purgeStep === "idle" ? (
                <button
                  onClick={() => { setPurgeStep("confirm"); setDataError(null); }}
                  className="flex items-center gap-2 rounded-lg border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Purge data
                </button>
              ) : (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                  <p className="mb-3 text-sm font-medium">Are you sure? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPurgeStep("idle")}
                      disabled={purging}
                      className="rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePurge}
                      disabled={purging}
                      className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
                    >
                      {purging ? "Purging…" : "Yes, purge everything"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <hr className="border-border" />

            {/* Delete account */}
            <div>
              <p className="mb-1 text-sm font-medium">Delete account</p>
              <p className="mb-3 text-sm text-muted-foreground">
                Permanently deletes your account and all associated data. This cannot be undone.
              </p>
              {deleteStep === "idle" ? (
                <button
                  onClick={() => { setDeleteStep("confirm"); setDataError(null); }}
                  className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete account
                </button>
              ) : (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                  <p className="mb-3 text-sm font-medium">This will permanently delete your account and all data.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteStep("idle")}
                      disabled={deleting}
                      className="rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
                    >
                      {deleting ? "Deleting…" : "Yes, delete my account"}
                    </button>
                  </div>
                </div>
              )}

              {dataError && <p className="mt-3 text-sm text-destructive">{dataError}</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
