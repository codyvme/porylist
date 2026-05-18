import { useState, useEffect, useCallback } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { persister, queryClient } from "@/lib/query-client";
import { PokemonTable } from "@/components/PokemonTable";
import { TeamBuilder } from "@/components/TeamBuilder";
import { CircleHelp, Moon, Search, Sun, X } from "lucide-react";
import { Input } from "@/components/ui/input";

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
        </div>
      </div>
    </div>
  );
}

export function App() {
  const { isDark, toggle } = useTheme();
  const [showAbout, setShowAbout] = useState(false);
  const [search, setSearch] = useState("");

  const [teamBuilderOpen, setTeamBuilderOpen] = useState(false);

  const [caught, setCaught] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem("porylist-caught") ?? "{}"); }
    catch { return {}; }
  });
  useEffect(() => {
    localStorage.setItem("porylist-caught", JSON.stringify(caught));
  }, [caught]);
  const toggleCaught = useCallback((name: string, gameKey: string) => {
    setCaught((prev) => {
      const current = prev[gameKey] ?? [];
      const next = current.includes(name)
        ? current.filter((n) => n !== name)
        : [...current, name];
      return { ...prev, [gameKey]: next };
    });
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
      <div className="min-h-screen bg-background">
        <header className="border-b border-slate-700/60 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
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
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="pl-9 w-full border-slate-600 bg-slate-800/80 text-white placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                aria-label="Search Pokémon"
              />
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
            </div>
          </div>
        </header>
        <main className="container py-6">
          <PokemonTable search={search} onSearchChange={setSearch} team={team} onAddToTeam={addToTeam} onRemoveFromTeam={removeFromTeam} teamBuilderOpen={teamBuilderOpen} caught={caught} onToggleCaught={toggleCaught} />
        </main>
        <footer className="border-t mt-6 pb-16">
          <div className="container py-6 space-y-1">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Porylist
            </p>
            <p className="text-xs text-muted-foreground">
              Porylist is an independent fan site and is not affiliated with,
              endorsed by, or connected to Nintendo, Game Freak, or The Pokémon
              Company. All Pokémon names, characters, and related media are
              trademarks and &copy; of their respective owners.
            </p>
          </div>
        </footer>
        {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
        <TeamBuilder team={team} onRemove={removeFromTeam} onClear={clearTeam} expanded={teamBuilderOpen} onExpandedChange={setTeamBuilderOpen} />
      </div>
    </PersistQueryClientProvider>
  );
}
