import { memo } from "react";
import { cn } from "@/lib/utils";
import { typeStyle } from "@/lib/types";

interface TypeBadgeProps {
  type: string;
  /** sm = 9px pill, md = 10px pill (default). */
  size?: "sm" | "md";
  /** Override/extend classes — useful for uppercase variants or layout (shrink-0 etc.). */
  className?: string;
}

const SIZES = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
} as const;

/** Colored type pill (e.g. "Fire", "Water"). Single source of truth for type badge styling. */
export const TypeBadge = memo(function TypeBadge({ type, size = "md", className }: TypeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-block rounded text-center font-semibold capitalize text-white",
        SIZES[size],
        className,
      )}
      style={typeStyle(type)}
    >
      {type}
    </span>
  );
});
