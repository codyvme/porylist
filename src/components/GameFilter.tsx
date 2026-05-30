import { GAMES } from "@/lib/games";
import { Select } from "@/components/ui/select";
import { useGameContext } from "@/lib/game-context";
import { cn } from "@/lib/utils";

interface GameFilterProps {
  className?: string;
}

export function GameFilter({ className }: GameFilterProps) {
  const { selectedGame, setSelectedGame } = useGameContext();

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <label className="hidden sm:inline text-xs font-medium text-muted-foreground">
        Game:
      </label>
      <Select
        value={selectedGame?.value ?? ""}
        onChange={(e) => setSelectedGame(GAMES.find((g) => g.value === e.target.value) ?? null)}
        className="w-44 sm:w-56"
        aria-label="Game"
      >
        <option value="">All Games</option>
        {GAMES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
      </Select>
    </div>
  );
}
