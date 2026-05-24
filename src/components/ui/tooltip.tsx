import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom" | "right";
}

export function Tooltip({ content, children, className, side = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (side === "bottom") {
      setPos({ top: rect.bottom + window.scrollY + 8, left: rect.left + rect.width / 2 + window.scrollX });
    } else if (side === "right") {
      setPos({ top: rect.top + rect.height / 2 + window.scrollY, left: rect.right + window.scrollX + 8 });
    } else {
      setPos({ top: rect.top + window.scrollY - 8, left: rect.left + rect.width / 2 + window.scrollX });
    }
  }, [visible, side]);

  const boxCls =
    side === "right"
      ? "pointer-events-none absolute z-50 -translate-y-1/2 rounded bg-foreground px-2 py-1 text-xs text-background shadow-md whitespace-nowrap"
      : side === "bottom"
      ? "pointer-events-none absolute z-50 -translate-x-1/2 rounded bg-foreground px-2 py-1 text-xs text-background shadow-md whitespace-nowrap"
      : "pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full rounded bg-foreground px-2 py-1 text-xs text-background shadow-md whitespace-nowrap";

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
          <div role="tooltip" style={{ top: pos.top, left: pos.left }} className={boxCls}>
            {content}
            {side === "bottom" && <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-foreground" />}
            {side === "top"    && <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground" />}
            {side === "right"  && <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />}
          </div>,
          document.body,
        )}
    </>
  );
}
