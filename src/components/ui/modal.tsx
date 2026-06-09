import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useEscapeKey } from "@/lib/hooks";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-width class for the inner panel. Default: "max-w-lg" */
  maxWidth?: string;
  /** Extra classes for the inner panel (e.g. "max-h-[90vh] flex flex-col"). */
  className?: string;
  /** Blur the backdrop. Default: true */
  blur?: boolean;
}

/**
 * Centered modal dialog with a click-outside + Escape-to-close backdrop.
 * Portals to document.body so backdrop-filter blurs all page content uniformly.
 */
export function Modal({ onClose, children, maxWidth = "max-w-lg", className, blur = true }: ModalProps) {
  useEscapeKey(onClose);

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4",
        blur && "backdrop-blur-sm",
      )}
      onClick={onClose}
    >
      <div
        className={cn("relative w-full rounded-xl bg-background shadow-xl", maxWidth, className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
