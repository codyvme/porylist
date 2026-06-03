import { useEffect } from "react";

/**
 * Calls `onEscape` whenever the Escape key is pressed while the component is mounted.
 * Pass `enabled = false` to temporarily disable (e.g. when a nested modal is open).
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape, enabled]);
}
