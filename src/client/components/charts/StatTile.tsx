import { Decimal } from "@shared/money.ts";

type StatTileProps = {
  label: string;
  value: string;
  /** Signed decimal string — colors the value and prepends an arrow. */
  signed?: string | null;
};

/**
 * Headline number tile (dataviz: a single value is a stat tile, not a chart).
 * Polarity is never color-alone — signed values also carry an arrow and sign.
 */
export function StatTile({ label, value, signed = null }: StatTileProps) {
  const polarity = signed === null ? 0 : new Decimal(signed).comparedTo(0);
  const tone = polarity > 0 ? "text-matcha-dark" : polarity < 0 ? "text-blush-dark" : "text-ink";
  const arrow = polarity > 0 ? "▲ " : polarity < 0 ? "▼ " : "";

  return (
    <div className="wobbly-2 border-2 border-ink/10 bg-surface px-4 py-3">
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className={`font-display text-lg font-bold tabular-nums ${tone}`}>
        {arrow}
        {value}
      </p>
    </div>
  );
}
