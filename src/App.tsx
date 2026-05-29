import React, { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, NavLink, useNavigate, useLocation } from "react-router-dom";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { persister, queryClient } from "@/lib/query-client";
import { PokemonTable } from "@/components/PokemonTable";
import { PlaythroughTracker } from "@/components/PlaythroughTracker";
import { MovesTable } from "@/components/MovesTable";
import { AbilitiesTable } from "@/components/AbilitiesTable";
import { TeamBuilder } from "@/components/TeamBuilder";
import { BreedingTracker } from "@/components/BreedingTracker";
import { CompareView } from "@/components/CompareView";
import { NaturesTable } from "@/components/NaturesTable";
import { ItemsTable } from "@/components/ItemsTable";
import { CatchCalculator } from "@/components/CatchCalculator";
import { HomePage } from "@/components/HomePage";
import { CircleHelp, Crosshair, Dna, House, Leaf, List, LogOut, Menu, Moon, Backpack, Scale, Settings, Sparkles, Sun, Swords, Trophy, Users, X } from "lucide-react";
import { GAMES, SPRITES_ROOT, type GameOption } from "@/lib/games";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  supabase,
  signInWithEmail,
  signOut,
  fetchCaughtFromDB,
  fetchUserProfile,
} from "@/lib/supabase";
import type { User, UserProfile } from "@/lib/supabase";
import { AccountSettingsModal, UserAvatar } from "@/components/AccountSettingsModal";

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
            Pokédex, moves, abilities, items, and natures for every game. Simulate catch probabilities, compare Pokémon side-by-side, build and analyze teams, track playthroughs with route encounter tables, and plan breeding chains — all in one place.
          </p>

          <div className="flex gap-2">
            <Tooltip content="Coming soon..." className="flex flex-1 cursor-not-allowed">
            <button
              disabled
              className="flex flex-1 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground opacity-50 pointer-events-none whitespace-nowrap"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.028.02.056.041.074a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .041-.074c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Join us on Discord
            </button>
            </Tooltip>
            <a
              href="https://github.com/codyvme/porylist"
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              View on GitHub
            </a>
          </div>

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

function UserMenu({
  user,
  profile,
  onSignOut,
  onOpenSettings,
}: {
  user: User;
  profile: UserProfile | null;
  onSignOut: () => void;
  onOpenSettings: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const displayName = profile?.username ?? user.email?.split("@")[0] ?? "User";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-0.5 ring-2 ring-transparent hover:ring-slate-500 transition-all"
        aria-label="User menu"
      >
        <UserAvatar profile={profile} email={user.email} size={32} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-background shadow-lg z-50">
          {/* Identity */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <UserAvatar profile={profile} email={user.email} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{displayName}</p>
              {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
            </div>
          </div>
          {/* Actions */}
          <button
            onClick={() => { setOpen(false); onOpenSettings(); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
            Account settings
          </button>
          <button
            onClick={() => { setOpen(false); onSignOut(); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors rounded-b-xl"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS = [
  { to: "/",           label: "Dashboard",         Icon: House         },
  null, // separator
  { to: "/abilities",  label: "Abilities",         Icon: Sparkles      },
  { to: "/items",      label: "Items",             Icon: Backpack      },
  { to: "/moves",      label: "Moves",             Icon: Swords        },
  { to: "/natures",    label: "Natures",           Icon: Leaf          },
  { to: "/pokedex",    label: "Pokédex",           Icon: List          },
  null, // separator
  { to: "/breeding",   label: "Breeding Tracker",  Icon: Dna           },
  { to: "/catch",      label: "Catch Calculator",  Icon: Crosshair     },
  { to: "/compare",    label: "Compare",           Icon: Scale         },
  { to: "/routes",     label: "Playthroughs",      Icon: Trophy        },
  { to: "/team",       label: "Team Builder",      Icon: Users         },
] as const;

// ─── Icon Rail (desktop) ──────────────────────────────────────────────────────

function IconRail() {
  const [navExpanded, setNavExpanded] = useState(
    () => window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setNavExpanded(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <aside className="hidden sm:flex flex-col w-14 lg:w-44 shrink-0 border-r border-border bg-background dark:border-[hsl(193_60%_18%/0.6)] dark:bg-[hsl(193_90%_9%)] py-2">
      {NAV_ITEMS.map((item, i) =>
        item === null ? (
          <div key={`sep-${i}`} className="my-1.5 border-t border-border dark:border-[hsl(193_60%_18%/0.6)]" />
        ) : (
          <Tooltip key={item.to} content={item.label} side="right" className="block w-full" disabled={navExpanded}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => cn(
                "flex h-11 w-full items-center border-l-2 px-3 text-sm transition-colors",
                "justify-center lg:justify-start gap-0 lg:gap-3 lg:px-4",
                isActive
                  ? "border-[hsl(var(--porygon-red))] bg-primary/10 font-semibold text-primary dark:bg-white/10 dark:text-white"
                  : "border-transparent font-medium text-muted-foreground hover:bg-muted hover:text-foreground dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200",
              )}
              aria-label={item.label}
            >
              <item.Icon className="h-4 w-4 shrink-0" />
              <span className="hidden lg:block whitespace-nowrap">{item.label}</span>
            </NavLink>
          </Tooltip>
        )
      )}
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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-200 sm:hidden",
          "bg-background dark:bg-[hsl(193_90%_9%)] border-r border-border dark:border-[hsl(193_60%_18%/0.6)]",
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        )}
      >
        {/* Drawer header — close button only */}
        <div className="flex items-center justify-end border-b border-border dark:border-[hsl(193_60%_18%/0.6)] px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-white/10"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Nav items */}
        <nav className="flex flex-col py-2">
          {NAV_ITEMS.map((item, i) =>
            item === null ? (
              <div key={`sep-${i}`} className="my-1.5 border-t border-border dark:border-[hsl(193_60%_18%/0.6)]" />
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={onClose}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 border-l-2 px-5 py-3 text-sm transition-colors whitespace-nowrap",
                  isActive
                    ? "border-[hsl(var(--porygon-red))] bg-primary/10 font-semibold text-primary dark:bg-white/10 dark:text-white"
                    : "border-transparent font-medium text-muted-foreground hover:bg-muted hover:text-foreground dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200",
                )}
              >
                <item.Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            )
          )}
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
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
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
    fetchUserProfile(user.id).then((p) => setUserProfile(p));
  }, [user]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    didSyncRef.current = null;
    setUserProfile(null);
  }, []);

  const [selectedGame, setSelectedGame] = useState<GameOption | null>(() => {
    try {
      const saved = localStorage.getItem("porylist-game");
      return GAMES.find((g) => g.value === saved) ?? null;
    } catch { return null; }
  });
  useEffect(() => {
    localStorage.setItem("porylist-game", selectedGame?.value ?? "");
  }, [selectedGame]);

  const [catchTrackerTarget, setCatchTrackerTarget] = useState<{ gameValue: string; locationKey: string } | null>(null);

  const handleOpenInCatchTracker = useCallback((gameValue: string, locationKey: string) => {
    const game = GAMES.find((g) => g.value === gameValue) ?? null;
    setSelectedGame(game);
    setCatchTrackerTarget({ gameValue, locationKey });
    navigate(`/routes?route=${locationKey}`);
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
      <div className="h-dvh flex flex-col overflow-hidden bg-background">

        {/* ── Header ── */}
        <header className="flex-shrink-0 border-b border-[hsl(193_60%_18%/0.6)] bg-[hsl(193_90%_9%)] pt-[env(safe-area-inset-top)]">
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
            <NavLink to="/" className="group flex shrink-0 items-center py-3">
              <div className="relative h-10 w-10">
                <img
                  src={`${SPRITES_ROOT}/versions/generation-iv/diamond-pearl/137.png`}
                  alt="Porygon"
                  className="h-10 w-10 object-contain group-hover:opacity-0"
                />
                <img
                  src="https://archives.bulbagarden.net/media/upload/7/78/Spr_4d_137.png"
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-10 w-10 object-contain opacity-0 group-hover:opacity-100"
                />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Porylist</h1>
            </NavLink>

            {/* Global game filter — always dark since the header is always dark */}
            <div className="dark hidden sm:flex items-center gap-1.5 ml-6">
              <Select
                value={selectedGame?.value ?? ""}
                onChange={(e) => setSelectedGame(GAMES.find((g) => g.value === e.target.value) ?? null)}
                className="w-64 bg-white/10 border-white/20 text-white"
              >
                <option value="">All Games</option>
                {GAMES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </Select>
              <Tooltip content="Filters the Pokédex, moves, abilities, items, and more to only show what's available in the selected game." side="bottom">
                <CircleHelp className="h-4 w-4 text-slate-400 hover:text-slate-200 transition-colors cursor-default" />
              </Tooltip>
            </div>

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
                <UserMenu user={user} profile={userProfile} onSignOut={handleSignOut} onOpenSettings={() => setShowAccountSettings(true)} />
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

          <main className={cn(
            "flex-1 min-h-0 overflow-auto container !px-0 pb-[calc(env(safe-area-inset-bottom)_+_1.5rem)] sm:pb-6 flex flex-col",
            ["/routes", "/breeding"].includes(location.pathname) && "!pb-0",
          )}>
            <Routes>
              <Route path="/" element={<HomePage game={selectedGame} user={user} />} />
              <Route path="/pokedex" element={
                <PokemonTable game={selectedGame} onOpenInCatchTracker={handleOpenInCatchTracker} />
              } />
              <Route path="/moves" element={<MovesTable game={selectedGame} />} />
              <Route path="/abilities" element={<AbilitiesTable game={selectedGame} />} />
              <Route path="/items" element={<ItemsTable game={selectedGame} />} />
              <Route path="/routes" element={
                <PlaythroughTracker navigationTarget={catchTrackerTarget} user={user} />
              } />
              <Route path="/natures" element={<NaturesTable />} />
              <Route path="/catch" element={<CatchCalculator game={selectedGame} />} />
              <Route path="/breeding" element={<BreedingTracker user={user} />} />
              <Route path="/compare" element={<CompareView game={selectedGame} />} />
              <Route path="/team" element={
                <TeamBuilder team={team} onAdd={addToTeam} onRemove={removeFromTeam} onClear={clearTeam} />
              } />
            </Routes>
          </main>
        </div>

        {/* ── Overlays ── */}
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
        {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
        {showAccountSettings && user && (
          <AccountSettingsModal
            user={user}
            profile={userProfile}
            onProfileUpdate={setUserProfile}
            onPurge={() => { setCaught({}); }}
            onClose={() => setShowAccountSettings(false)}
          />
        )}
      </div>
    </PersistQueryClientProvider>
  );
}
