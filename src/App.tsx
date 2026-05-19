import React, { useState, useEffect, useCallback, useRef } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { persister, queryClient } from "@/lib/query-client";
import { PokemonTable } from "@/components/PokemonTable";
import { RouteBrowser } from "@/components/RouteBrowser";
import { TeamBuilder } from "@/components/TeamBuilder";
import { CircleHelp, ClipboardList, List, LogOut, Moon, Search, Sun, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  supabase,
  signInWithEmail,
  signOut,
  fetchCaughtFromDB,
  insertCaught,
  deleteCaught,
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
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Porylist is a Pokédex browsing and team-building tool for filtering,
            sorting, and analyzing Pokémon by game, type, and base stats.
          </p>
          <p>
            Use the <strong className="text-foreground">Game</strong> dropdown
            to filter Pokémon to those available in a specific game, with
            game-accurate typings and sprites. Enable{" "}
            <strong className="text-foreground">National Dex</strong> to show
            all Pokémon up to that generation instead.
          </p>
          <p>
            Use the <strong className="text-foreground">Filter</strong> button
            to narrow results by type, show only legendary or mythical Pokémon,
            filter by move learnability, or show only caught/uncaught Pokémon.
            Use <strong className="text-foreground">Columns</strong> to toggle
            optional columns like height, weight, catch rate, and egg group.
          </p>
          <p>
            Click any Pokémon's name to open a detail view with its sprite,
            abilities, base stats, type effectiveness, Pokédex entry, evolution
            chain, encounter locations, and full move list for the selected game.
            Mark it as caught with the Pokéball button.
          </p>
          <p>
            The <strong className="text-foreground">Team Builder</strong> panel
            at the bottom lets you pick up to 6 Pokémon. Expand it to see a
            defensive matchups grid (per-type damage multipliers for each member
            plus a shared weakness count) and an offensive STAB coverage summary.
            Your team is saved automatically and can be shared via the share button.
          </p>
          <p>
            Data is sourced from{" "}
            <a
              href="https://pokeapi.co"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline"
            >
              PokéAPI
            </a>{" "}
            and served as static JSON from Cloudflare R2 — no live API calls at
            runtime. Sprites from the{" "}
            <a
              href="https://github.com/PokeAPI/sprites"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline"
            >
              PokeAPI sprites repo
            </a>
            . Type icons by{" "}
            <a
              href="https://github.com/partywhale/pokemon-type-icons"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline"
            >
              partywhale
            </a>
            .
          </p>
          <p className="pt-2 text-xs text-muted-foreground/60">
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
          Sync your caught Pokémon across devices.
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

function UserMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
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

type Tab = "pokedex" | "routes";

export function App() {
  const { isDark, toggle } = useTheme();
  const [showAbout, setShowAbout] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const p = new URLSearchParams(window.location.search).get("tab");
    return p === "routes" ? "routes" : "pokedex";
  });

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === "pokedex") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);
  const [search, setSearch] = useState("");

  const [teamBuilderOpen, setTeamBuilderOpen] = useState(false);

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
      // Sync to Supabase in background
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
  useEffect(() => {
    const url = new URL(window.location.href);
    if (team.length > 0) {
      url.searchParams.set('team', team.join(','));
    } else {
      url.searchParams.delete('team');
    }
    history.replaceState(null, '', url.toString());
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
        <header className="flex-shrink-0 border-b border-slate-700/60 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
          <div className="container flex items-center gap-4 py-4">
            <div className="flex items-center shrink-0">
              <img
                src="https://sprites.porylist.com/sprites/pokemon/versions/generation-iv/diamond-pearl/137.png"
                alt="Porygon"
                className="h-10 w-10 object-contain"
              />
              <h1 className="text-2xl font-bold tracking-tight text-white">Porylist</h1>
            </div>
            <div className="relative flex-1">
              {activeTab === "pokedex" && (
                <>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="pl-9 w-full border-slate-600 bg-slate-800/80 text-white placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                    aria-label="Search Pokémon"
                  />
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
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
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </header>
        {/* Tab bar */}
        <div className="flex-shrink-0 border-b bg-background">
          <div className="container flex gap-0">
            {([
              { id: "pokedex", label: "Pokédex", Icon: List },
              { id: "routes", label: "Catch Tracker", Icon: ClipboardList },
            ] as { id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[]).map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <main className={cn("flex-1 min-h-0 container py-6 flex flex-col", activeTab === "pokedex" && "pb-16")}>
          {activeTab === "pokedex" && (
            <PokemonTable search={search} onSearchChange={setSearch} team={team} onAddToTeam={addToTeam} onRemoveFromTeam={removeFromTeam} teamBuilderOpen={teamBuilderOpen} caught={caught} onToggleCaught={toggleCaught} />
          )}
          {activeTab === "routes" && (
            <RouteBrowser caught={caught} onToggleCaught={toggleCaught} />
          )}
        </main>
        {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
        {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
        {activeTab === "pokedex" && <TeamBuilder team={team} onRemove={removeFromTeam} onClear={clearTeam} expanded={teamBuilderOpen} onExpandedChange={setTeamBuilderOpen} />}
      </div>
    </PersistQueryClientProvider>
  );
}
