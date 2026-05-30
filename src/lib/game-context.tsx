import { createContext, useContext, type ReactNode } from "react";
import type { GameOption } from "@/lib/games";

interface GameContextValue {
  selectedGame: GameOption | null;
  setSelectedGame: (g: GameOption | null) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({
  value,
  children,
}: {
  value: GameContextValue;
  children: ReactNode;
}) {
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGameContext must be used inside <GameProvider>");
  return ctx;
}
