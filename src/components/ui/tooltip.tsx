import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom";
}

export function Tooltip({ content, children, className, side = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: side === "bottom"
        ? rect.bottom + window.scrollY + 8
        : rect.top + window.scrollY - 8,
      left: rect.left + rect.width / 2 + window.scrollX,
    });
  }, [visible, side]);

  return (
    <>
      <span
        ref={triggerRef}
        className={className}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className={`pointer-events-none absolute z-50 -translate-x-1/2 rounded bg-foreground px-2 py-1 text-xs text-background shadow-md whitespace-nowrap ${side === "bottom" ? "" : "-translate-y-full"}`}
          >
            {content}
            {side === "bottom" ? (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-foreground" />
            ) : (
              <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground" />
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
