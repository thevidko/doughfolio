import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "wobbly border-2 border-ink bg-dough font-display font-semibold text-ink shadow-sm hover:-rotate-1 hover:bg-dough-dark",
  secondary:
    "wobbly-2 border-2 border-ink bg-surface font-display font-semibold text-ink hover:rotate-1 hover:bg-cream-dark",
  ghost: "font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline",
};

/** Hand-drawn button: crayon outline, squash on press, tiny tilt on hover. */
export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 transition-transform duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
