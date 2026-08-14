import type { AllocationSlice } from "@shared/api.ts";
import { formatCurrency } from "@shared/money.ts";
import { useTranslation } from "react-i18next";
import { categoricalColor } from "./chartTheme.ts";

type DonutChartProps = {
  title: string;
  slices: AllocationSlice[];
  currency: string;
};

const MAX_SLICES = 5;
const R = 42;
const STROKE = 20;
const GAP_ANGLE = 0.05; // ~2px surface gap between segments (dataviz spacer rule)

function arcPath(startAngle: number, endAngle: number): string {
  const start = {
    x: 60 + R * Math.cos(startAngle),
    y: 60 + R * Math.sin(startAngle),
  };
  const end = { x: 60 + R * Math.cos(endAngle), y: 60 + R * Math.sin(endAngle) };
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${large} 1 ${end.x} ${end.y}`;
}

/**
 * Allocation donut (custom SVG). Top slices in fixed categorical order, the
 * tail folds into "Other" (dataviz: a 7th series is never a new hue). Legend
 * with direct labels + shares is always rendered — identity is never
 * color-alone, and the 2px gaps double as CVD-safe secondary encoding.
 */
export function DonutChart({ title, slices, currency }: DonutChartProps) {
  const { t, i18n } = useTranslation();

  const sorted = [...slices].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, MAX_SLICES);
  const rest = sorted.slice(MAX_SLICES);
  const shown = [...top];
  if (rest.length > 0) {
    shown.push({
      key: "other",
      label: t("portfolio.allocation.other"),
      value: rest.reduce((sum, s) => sum + s.value, 0),
    });
  }
  const total = shown.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;

  let angle = -Math.PI / 2;
  const segments = shown.map((slice, index) => {
    const sweep = (slice.value / total) * (Math.PI * 2 - GAP_ANGLE * shown.length);
    const path = arcPath(angle, angle + sweep);
    angle += sweep + GAP_ANGLE;
    return { ...slice, path, color: categoricalColor(index) };
  });

  return (
    <div>
      <h3 className="mb-2 font-display text-sm font-bold text-ink-soft">{title}</h3>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" className="size-32 shrink-0" role="img" aria-label={title}>
          {segments.map((segment) => (
            <path
              key={segment.key}
              d={segment.path}
              fill="none"
              stroke={segment.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <ul className="min-w-0 space-y-1 text-sm">
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
                aria-hidden
              />
              <span className="truncate font-semibold uppercase">{segment.label}</span>
              <span className="ml-auto whitespace-nowrap tabular-nums text-ink-soft">
                {((segment.value / total) * 100).toFixed(1)} %
              </span>
            </li>
          ))}
          <li className="pt-1 text-xs text-ink-soft">
            {formatCurrency(total, currency, i18n.language)}
          </li>
        </ul>
      </div>
    </div>
  );
}
