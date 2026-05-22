import React, { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from "react-router-dom";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { persister, queryClient } from "@/lib/query-client";
import { PokemonTable } from "@/components/PokemonTable";
import { RouteBrowser } from "@/components/RouteBrowser";
import { MovesTable } from "@/components/MovesTable";
import { AbilitiesTable } from "@/components/AbilitiesTable";
import { TeamBuilder } from "@/components/TeamBuilder";
import { BreedingTracker } from "@/components/BreedingTracker";
import { ItemsTable } from "@/components/ItemsTable";
import { CircleHelp, ClipboardList, Dna, List, LogOut, Menu, Moon, Backpack, Sparkles, Sun, Swords, Trash2, X } from "lucide-react";
import { SPRITES_ROOT } from "@/lib/games";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  supabase,
  signInWithEmail,
  signOut,
  fetchCaughtFromDB,
  insertCaught,
  deleteCaught,
  deleteAccount,
} from "@/lib/supabase";
import type { User } from "@/lib/supabase";

function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggle = useCallback(() => setIsDark((d) => !d), []);
  return { isDark, toggle };
}

function AboutModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-xl bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="mb-3 text-lg font-semibold">About Porylist</h2>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Porylist is an all-in-one Pokémon companion for players who want more than a plain Pokédex. Look up stats, moves, and type matchups; build and analyze teams; track your catches game-by-game; and plan out breeding chains — all in one place.
          </p>
          <p>Sign in to sync your progress across devices.</p>

          <a
            href="https://github.com/codyvme/porylist"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            View source on GitHub
          </a>

          <p className="pt-1 text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Porylist — an independent fan site not affiliated with Nintendo, Game Freak, or The Pokémon Company.
          </p>
        </div>
      </div>
    </div>
  );
}

function SignInModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await signInWithEmail(email.trim());
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-xl bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="mb-1 text-lg font-semibold">Sign in to Porylist</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Sign in to sync your progress across devices. Your email is only used for authentication and is never shared.
        </p>
        {sent ? (
          <div className="rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
            Check your inbox — we sent a magic link to <strong>{email}</strong>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function DeleteAccountModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div className="relative w-full max-w-sm rounded-xl bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 text-base font-semibold">Delete account?</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          This will permanently delete your account and all saved catch data. This action cannot be undone.
        </p>
        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const name = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "") as string;
  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-full p-0.5 ring-2 ring-transparent hover:ring-slate-500 transition-all"
          aria-label="User menu"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 text-xs font-semibold text-white">
              {initials || "?"}
            </div>
          )}
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border bg-background shadow-lg z-50">
            <div className="border-b px-4 py-3">
              <p className="truncate text-sm font-medium">{name}</p>
              {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
            </div>
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
            <button
              onClick={() => { setOpen(false); setShowDeleteConfirm(true); }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors rounded-b-xl"
            >
              <Trash2 className="h-4 w-4" />
              Delete account
            </button>
          </div>
        )}
      </div>
      {showDeleteConfirm && (
        <DeleteAccountModal
          onConfirm={onSignOut}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}

const NAV_ITEMS = [
  { to: "/pokedex",    label: "Pokédex",         Icon: List          },
  { to: "/moves",      label: "Moves",            Icon: Swords        },
  { to: "/abilities",  label: "Abilities",        Icon: Sparkles      },
  { to: "/items",      label: "Items",            Icon: Backpack      },
  { to: "/routes",     label: "Catch Tracker",    Icon: ClipboardList },
  { to: "/breeding",   label: "Breeding Tracker", Icon: Dna           },
] as const;

// ─── Icon Rail (desktop) ──────────────────────────────────────────────────────

function IconRail() {
  return (
    <aside className="hidden sm:flex flex-col w-44 shrink-0 border-r border-border bg-background dark:border-slate-700/60 dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-800 py-2">
      {NAV_ITEMS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => cn(
            "flex h-11 w-full items-center gap-3 border-l-2 px-4 text-sm transition-colors whitespace-nowrap",
            isActive
              ? "border-[hsl(var(--porygon-red))] bg-primary/10 font-semibold text-primary dark:bg-white/10 dark:text-white"
              : "border-transparent font-medium text-muted-foreground hover:bg-muted hover:text-foreground dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200",
          )}
          aria-label={label}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </aside>
  );
}

// ─── Mobile Drawer ────────────────────────────────────────────────────────────

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 transition-opacity sm:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 shadow-2xl transition-transform duration-200 sm:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
          <NavLink to="/pokedex" onClick={onClose} className="flex items-center gap-1">
            <img
              src={`${SPRITES_ROOT}/versions/generation-iv/diamond-pearl/137.png`}
              alt="Porygon"
              className="h-8 w-8 object-contain"
            />
            <span className="text-lg font-bold text-white">Porylist</span>
          </NavLink>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Nav items */}
        <nav className="flex flex-col py-2">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => cn(
                "flex items-center gap-3 border-l-2 px-5 py-3 text-sm transition-colors",
                isActive
                  ? "border-[hsl(var(--porygon-red))] bg-white/10 font-semibold text-white"
                  : "border-transparent font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  const { isDark, toggle } = useTheme();
  const [showAbout, setShowAbout] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [teamBuilderOpen, setTeamBuilderOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [caught, setCaught] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem("porylist-caught") ?? "{}"); }
    catch { return {}; }
  });
  useEffect(() => {
    localStorage.setItem("porylist-caught", JSON.stringify(caught));
  }, [caught]);

  // Auth: subscribe to session changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Sync from Supabase when user signs in
  const didSyncRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || didSyncRef.current === user.id) return;
    didSyncRef.current = user.id;
    fetchCaughtFromDB(user.id).then((remote) => {
      setCaught((local) => {
        const merged: Record<string, string[]> = { ...local };
        for (const [gameKey, names] of Object.entries(remote)) {
          const existing = new Set(merged[gameKey] ?? []);
          for (const n of names) existing.add(n);
          merged[gameKey] = Array.from(existing);
        }
        return merged;
      });
    });
  }, [user]);

  const toggleCaught = useCallback((name: string, gameKey: string) => {
    setCaught((prev) => {
      const current = prev[gameKey] ?? [];
      const isCaught = current.includes(name);
      const next = isCaught ? current.filter((n) => n !== name) : [...current, name];
      supabase.auth.getUser().then(({ data }) => {
        const uid = data.user?.id;
        if (!uid) return;
        if (isCaught) deleteCaught(uid, gameKey, name);
        else insertCaught(uid, gameKey, name);
      });
      return { ...prev, [gameKey]: next };
    });
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    didSyncRef.current = null;
  }, []);

  const [catchTrackerTarget, setCatchTrackerTarget] = useState<{ gameValue: string; locationKey: string } | null>(null);

  const handleOpenInCatchTracker = useCallback((gameValue: string, locationKey: string) => {
    setCatchTrackerTarget({ gameValue, locationKey });
    navigate(`/routes?routeGame=${gameValue}&route=${locationKey}`);
  }, [navigate]);

  const [team, setTeam] = useState<string[]>(() => {
    const urlTeam = new URLSearchParams(window.location.search).get('team');
    if (urlTeam) {
      const names = urlTeam.split(',').filter(Boolean).slice(0, 6);
      if (names.length > 0) return names;
    }
    try { return JSON.parse(localStorage.getItem("porylist-team") ?? "[]"); }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem("porylist-team", JSON.stringify(team));
  }, [team]);
  const addToTeam = useCallback((name: string) => {
    setTeam(prev => prev.includes(name) || prev.length >= 6 ? prev : [...prev, name]);
  }, []);
  const removeFromTeam = useCallback((name: string) => {
    setTeam(prev => prev.filter(n => n !== name));
  }, []);
  const clearTeam = useCallback(() => setTeam([]), []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 30 }}
    >
      <div className="h-screen flex flex-col overflow-hidden bg-background">

        {/* ── Header ── */}
        <header className="flex-shrink-0 border-b border-slate-700/60 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
          <div className="flex items-center gap-3 px-4">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="sm:hidden rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Logo */}
            <NavLink to="/pokedex" className="flex shrink-0 items-center py-3">
              <img
                src={`${SPRITES_ROOT}/versions/generation-iv/diamond-pearl/137.png`}
                alt="Porygon"
                className="h-10 w-10 object-contain"
              />
              <h1 className="text-2xl font-bold tracking-tight text-white">Porylist</h1>
            </NavLink>

            {/* Right-side actions */}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setShowAbout(true)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                aria-label="About"
              >
                <CircleHelp className="h-5 w-5" />
              </button>
              <button
                onClick={toggle}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              {user ? (
                <UserMenu user={user} onSignOut={handleSignOut} />
              ) : (
                <button
                  onClick={() => setShowSignIn(true)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ── Body (rail + content) ── */}
        <div className="flex flex-1 min-h-0">
          <IconRail />

          <main className={cn("flex-1 min-h-0 overflow-auto container py-6 flex flex-col", location.pathname === "/pokedex" && "pb-16")}>
            <Routes>
              <Route path="/" element={<Navigate to="/pokedex" replace />} />
              <Route path="/pokedex" element={
                <PokemonTable team={team} onAddToTeam={addToTeam} onRemoveFromTeam={removeFromTeam} teamBuilderOpen={teamBuilderOpen} caught={caught} onToggleCaught={toggleCaught} onOpenInCatchTracker={handleOpenInCatchTracker} />
              } />
              <Route path="/moves" element={<MovesTable />} />
              <Route path="/abilities" element={<AbilitiesTable />} />
              <Route path="/items" element={<ItemsTable />} />
              <Route path="/routes" element={
                <RouteBrowser caught={caught} onToggleCaught={toggleCaught} navigationTarget={catchTrackerTarget} />
              } />
              <Route path="/breeding" element={<BreedingTracker user={user} />} />
            </Routes>
          </main>
        </div>

        {/* ── Overlays ── */}
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
        {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
        {location.pathname === "/pokedex" && (
          <TeamBuilder team={team} onRemove={removeFromTeam} onClear={clearTeam} expanded={teamBuilderOpen} onExpandedChange={setTeamBuilderOpen} />
        )}
      </div>
    </PersistQueryClientProvider>
  );
}
