import React from "react";

const SPARKLE_COLORS = ["#facc15", "#f97316", "#ec4899", "#22c55e", "#3b82f6", "#a855f7", "#14b8a6", "#f43f5e"];

export function SparkleBurst() {
  return (
    <>
      {SPARKLE_COLORS.map((color, i) => {
        const angle = (i / SPARKLE_COLORS.length) * 360;
        const dist = 20 + (i % 3) * 6;
        return (
          <span
            key={i}
            className="sparkle-particle"
            style={{
              width: i % 2 === 0 ? 5 : 4,
              height: i % 2 === 0 ? 5 : 4,
              backgroundColor: color,
              "--angle": `${angle}deg`,
              "--dist": `${dist}px`,
              animationDelay: `${i * 25}ms`,
            } as React.CSSProperties}
          />
        );
      })}
    </>
  );
}
