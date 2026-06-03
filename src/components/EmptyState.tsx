import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  /** Optional supporting line. Can include links/JSX. */
  description?: ReactNode;
  /** Optional action element (e.g. a button), rendered centered below. */
  action?: ReactNode;
  className?: string;
}

/** Dashed-border placeholder for empty lists/sections (icon + title + optional description/action). */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("rounded-xl border border-dashed p-6 text-center", className)}>
      <Icon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}
