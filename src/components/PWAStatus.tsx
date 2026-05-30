import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Download, RefreshCw, WifiOff, X } from "lucide-react";

// ─── Update / install / offline banner stack ────────────────────────────────
// Renders 0–3 small dismissible chips fixed to the bottom-right (above the
// mobile tab bar). Each one is independent: an update toast when a new SW is
// ready, an install prompt when the browser fires beforeinstallprompt, and an
// offline indicator that auto-disappears once the network comes back.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_DISMISSED_KEY = "porylist-install-dismissed";

export function PWAStatus() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) { console.error("SW registration error", err); },
  });

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);

  // Install prompt — beforeinstallprompt is a Chromium thing; iOS Safari has
  // no equivalent so users on iOS install via Share → Add to Home Screen.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      e.preventDefault();
      if (localStorage.getItem(INSTALL_DISMISSED_KEY)) return;
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Online/offline state
  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function dismissInstall() {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    setInstallPrompt(null);
  }

  return (
    <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)_+_4.5rem)] right-3 z-40 flex flex-col gap-2 sm:bottom-4">
      {offline && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm dark:text-amber-300">
          <WifiOff className="h-3.5 w-3.5" />
          You're offline — cached data only
        </div>
      )}

      {installPrompt && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-lg">
          <Download className="h-4 w-4 text-primary" />
          <span className="flex-1">Install Porylist?</span>
          <button
            onClick={handleInstall}
            className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Install
          </button>
          <button
            onClick={dismissInstall}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {needRefresh && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-lg">
          <RefreshCw className="h-4 w-4 text-primary" />
          <span className="flex-1">New version available</span>
          <button
            onClick={() => updateServiceWorker(true)}
            className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Reload
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
