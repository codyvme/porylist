import { useEffect } from "react";
import { Search, Gamepad2, CloudUpload, X } from "lucide-react";

const STORAGE_KEY = "porylist-welcomed-v1";

export function shouldShowWelcome(): boolean {
  try { return !localStorage.getItem(STORAGE_KEY); } catch { return false; }
}

export function markWelcomed() {
  try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
}

interface WelcomeModalProps {
  onClose: () => void;
  onOpenPalette: () => void;
}

export function WelcomeModal({ onClose, onOpenPalette }: WelcomeModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isMac = navigator.platform.toLowerCase().includes("mac");
  const shortcut = isMac ? "⌘K" : "Ctrl K";

  const tips = [
    {
      Icon: Search,
      title: "Search anything with the command palette",
      body: (
        <>
          Press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">{shortcut}</kbd> to instantly find any Pokémon, move, ability, or item. Also reachable from the search icon in the header.
        </>
      ),
    },
    {
      Icon: Gamepad2,
      title: "Filter to your game",
      body: "Use the Game dropdown at the top of each page to scope the Pokédex, moves, abilities, and items to the game you're playing.",
    },
    {
      Icon: CloudUpload,
      title: "Sign in to sync across devices",
      body: "Optional — sign in with email and your caught Pokémon, playthroughs, and breeding projects follow you everywhere.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
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

        <h2 className="text-lg font-semibold">Welcome to Porylist 👋</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Three quick things to know before you dive in:
        </p>

        <ul className="mt-5 space-y-4">
          {tips.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex gap-2">
          <button
            onClick={() => { onOpenPalette(); onClose(); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Search className="h-4 w-4" />
            Try the palette
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
