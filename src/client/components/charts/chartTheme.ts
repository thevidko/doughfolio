/**
 * Chart styling reads the live design tokens so lightweight-charts (canvas,
 * no CSS) matches the current theme. Colors resolve at mount time.
 */
export function chartTheme() {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    ink: token("--color-ink"),
    inkSoft: token("--color-ink-soft"),
    surface: token("--color-surface"),
    line: token("--color-chart-1"),
    up: token("--color-matcha-dark"),
    down: token("--color-blush-dark"),
    grid: `${token("--color-ink")}14`,
    fontFamily: token("--font-sans") || "Nunito, sans-serif",
  };
}

/** Fixed categorical assignment order (dataviz: never cycled, never re-ranked). */
export function categoricalColor(index: number): string {
  const style = getComputedStyle(document.documentElement);
  const slot = Math.min(index, 5) + 1;
  return style.getPropertyValue(`--color-chart-${slot}`).trim();
}
