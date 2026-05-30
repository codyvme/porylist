import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom" | "right";
  disabled?: boolean;
}

export function Tooltip({ content, children, className, side = "top", disabled = false }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  // After centering, the tooltip may extend off the viewport edge for triggers
  // near the right/left side. We shift it back inward by this many pixels and
  // expose the shift so the arrow can stay anchored over the trigger.
  const [edgeShift, setEdgeShift] = useState(0);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Single layout effect: compute anchor position from the trigger, then on
  // the next frame measure the rendered tooltip and clamp it inside the
  // viewport. Doing both in one effect avoids races where a second hover
  // sees identical pos values and skips the re-clamp.
  useLayoutEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    let nextPos: { top: number; left: number };
    if (side === "bottom") {
      nextPos = { top: rect.bottom + window.scrollY + 8, left: rect.left + rect.width / 2 + window.scrollX };
    } else if (side === "right") {
      nextPos = { top: rect.top + rect.height / 2 + window.scrollY, left: rect.right + window.scrollX + 8 };
    } else {
      nextPos = { top: rect.top + window.scrollY - 8, left: rect.left + rect.width / 2 + window.scrollX };
    }
    setPos(nextPos);
    setEdgeShift(0);

    if (side === "right") return; // no horizontal centering to clamp

    // Measure on the next frame, after the portal has rendered at nextPos
    // with edgeShift=0.
    const raf = requestAnimationFrame(() => {
      if (!boxRef.current) return;
      const tipRect = boxRef.current.getBoundingClientRect();
      const margin = 8;
      let shift = 0;
      if (tipRect.right > window.innerWidth - margin) {
        shift = window.innerWidth - margin - tipRect.right;
      } else if (tipRect.left < margin) {
        shift = margin - tipRect.left;
      }
      if (shift !== 0) setEdgeShift(shift);
    });
    return () => cancelAnimationFrame(raf);
  }, [visible, side, content]);

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
        onMouseEnter={() => { if (!disabled) setVisible(true); }}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => { if (!disabled) setVisible(true); }}
        onBlur={() => setVisible(false)}
      >
        {children}
      </span>
      {!disabled && visible &&
        createPortal(
          <div
            ref={boxRef}
            role="tooltip"
            style={{ top: pos.top, left: pos.left + edgeShift }}
            className={boxCls}
          >
            {content}
            {/* Arrow stays visually over the trigger by counter-shifting from the box */}
            {side === "bottom" && <div className="absolute bottom-full border-4 border-transparent border-b-foreground" style={{ left: `calc(50% - ${edgeShift}px - 4px)` }} />}
            {side === "top"    && <div className="absolute top-full border-4 border-transparent border-t-foreground" style={{ left: `calc(50% - ${edgeShift}px - 4px)` }} />}
            {side === "right"  && <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />}
          </div>,
          document.body,
        )}
    </>
  );
}
