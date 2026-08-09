import type { InputHTMLAttributes } from "react";

/** Text input whose outline "draws itself" thicker on focus (DESIGN.md). */
export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`wobbly-2 w-full border-2 border-ink-soft/60 bg-cream px-4 py-2.5 text-ink outline-none transition-colors placeholder:text-ink-soft/70 focus:border-ink ${className}`}
      {...props}
    />
  );
}
