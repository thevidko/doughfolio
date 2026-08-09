import type { HTMLAttributes } from "react";

/** Paper card with a hand-drawn outline (DESIGN.md component baseline). */
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`wobbly-3 border-2 border-ink/15 bg-surface p-6 shadow-[0_4px_12px_rgb(74_55_40/0.08)] ${className}`}
      {...props}
    />
  );
}
