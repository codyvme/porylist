import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

export function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

export function SortableTh<K extends string>({
  col,
  label,
  sortKey,
  sortDir,
  onSort,
  right,
  className,
}: {
  col: K;
  label: string;
  sortKey: K;
  sortDir: SortDir;
  onSort: (col: K) => void;
  right?: boolean;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "pb-2 pr-4 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground whitespace-nowrap",
        right ? "text-right" : "text-left",
        className,
      )}
      onClick={() => onSort(col)}
    >
      <span className={cn("flex items-center gap-1", right && "justify-end")}>
        {label}
        <SortIcon active={sortKey === col} dir={sortDir} />
      </span>
    </th>
  );
}
