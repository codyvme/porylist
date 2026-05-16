import { useState, useEffect, useCallback } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { persister, queryClient } from "@/lib/query-client";
import { PokemonTable } from "@/components/PokemonTable";
import { CircleHelp, Moon, Sun, X } from "lucide-react";

function useTheme() {
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem("theme") === "dark",
  );

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
            Porylist is a Pokédex filtering tool for browsing and sorting
            Pokémon by game, type, and base stats.
          </p>
          <p>
            Use the <strong className="text-foreground">Game</strong> dropdown
            to filter Pokémon to those available in a specific game, with
            game-accurate typings and sprites. Enable{" "}
            <strong className="text-foreground">National Dex</strong> to show
            all Pokémon up to that generation instead.
          </p>
          <p>
            Click any Pokémon's name to open a detail view with its sprite,
            abilities, base stats, Pokédex entry, and full move list for the
            selected game.
          </p>
          <p>
            Data and sprites are sourced from{" "}
            <a
              href="https://pokeapi.co"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline"
            >
              PokéAPI
            </a>{" "}
            and the{" "}
            <a
              href="https://github.com/PokeAPI/sprites"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline"
            >
              PokeAPI sprites repo
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

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 30 }}
    >
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container flex items-center justify-between py-4">
            <div className="flex items-center gap-1">
              <img
                src="/poke-sprites/sprites/pokemon/versions/generation-iv/diamond-pearl/137.png"
                alt="Porygon"
                className="h-10 w-10 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              <h1 className="text-2xl font-bold tracking-tight">Porylist</h1>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowAbout(true)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="About"
              >
                <CircleHelp className="h-5 w-5" />
              </button>
              <button
                onClick={toggle}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </header>
        <main className="container py-6">
          <PokemonTable />
        </main>
        <footer className="border-t mt-6">
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
      </div>
    </PersistQueryClientProvider>
  );
}
