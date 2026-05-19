import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.top + window.scrollY - 8,
      left: rect.left + rect.width / 2 + window.scrollX,
    });
  }, [visible]);

  return (
    <>
      <span
        ref={triggerRef}
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
            className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full rounded bg-foreground px-2 py-1 text-xs text-background shadow-md whitespace-nowrap"
          >
            {content}
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground" />
          </div>,
          document.body,
        )}
    </>
  );
}
