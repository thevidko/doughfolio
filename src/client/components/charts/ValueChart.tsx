import { formatCurrency } from "@shared/money.ts";
import { AreaSeries, createChart } from "lightweight-charts";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { chartTheme } from "./chartTheme.ts";

type ValueChartProps = {
  points: { date: string; value: number }[];
  currency: string;
};

/**
 * Portfolio value over time — an area chart with crosshair + tooltip
 * (dataviz interaction rule). Single series, so the card title is the legend.
 */
export function ValueChart({ points, currency }: ValueChartProps) {
  const { i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !tooltip || points.length === 0) return;

    const theme = chartTheme();
    const chart = createChart(container, {
      autoSize: true,
      height: 280,
      layout: {
        background: { color: "transparent" },
        textColor: theme.inkSoft,
        fontFamily: theme.fontFamily,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: theme.grid },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      localization: {
        priceFormatter: (value: number) => formatCurrency(value, currency, i18n.language),
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: theme.line,
      lineWidth: 2,
      topColor: `${theme.line}40`,
      bottomColor: `${theme.line}00`,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    series.setData(points.map((p) => ({ time: p.date, value: p.value })));
    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param) => {
      const data = param.seriesData.get(series) as { value?: number } | undefined;
      if (!param.point || !param.time || data?.value === undefined) {
        tooltip.style.display = "none";
        return;
      }
      tooltip.style.display = "block";
      tooltip.textContent = `${new Date(String(param.time)).toLocaleDateString(i18n.language)} · ${formatCurrency(data.value, currency, i18n.language)}`;
      const x = Math.min(param.point.x + 12, container.clientWidth - tooltip.clientWidth - 4);
      tooltip.style.transform = `translate(${x}px, 8px)`;
    });

    return () => chart.remove();
  }, [points, currency, i18n.language]);

  return (
    <div className="relative">
      <div ref={containerRef} className="h-70 w-full" />
      <div
        ref={tooltipRef}
        className="wobbly pointer-events-none absolute top-0 left-0 hidden border-2 border-ink/20 bg-surface px-3 py-1 text-sm font-semibold text-ink shadow-sm"
      />
    </div>
  );
}
