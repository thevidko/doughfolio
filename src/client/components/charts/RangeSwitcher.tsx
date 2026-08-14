import { useTranslation } from "react-i18next";

export type Range = "7" | "30" | "90" | "365" | "all";
export const RANGES: readonly Range[] = ["7", "30", "90", "365", "all"];

/** Time-range filter row shared by the portfolio and asset charts. */
export function RangeSwitcher({
  value,
  onChange,
}: {
  value: Range;
  onChange: (range: Range) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="flex gap-1 border-0 p-0">
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={value === range}
          onClick={() => onChange(range)}
          className={`wobbly px-3 py-1 text-sm font-display font-semibold transition-colors ${
            value === range ? "bg-dough text-ink" : "text-ink-soft hover:text-ink"
          }`}
        >
          {t(`portfolio.ranges.${range}`)}
        </button>
      ))}
    </fieldset>
  );
}
