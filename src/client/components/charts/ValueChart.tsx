import { formatCurrency } from "@shared/money.ts";
import { AreaSeries, createChart, LineSeries } from "lightweight-charts";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { chartTheme } from "./chartTheme.ts";

type ValueChartProps = {
  points: { date: string; value: number; invested: number }[];
  currency: string;
};

/**
 * Portfolio value over time (area) with cumulative invested funds (line) —
 * same unit, one axis. Two series → legend + both values in the crosshair
 * tooltip (dataviz rules).
 */
export function ValueChart({ points, currency }: ValueChartProps) {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !tooltip || points.length === 0) return;

    const theme = chartTheme();
    const investedColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-chart-2")
      .trim();

    const chart = createChart(container, {
      autoSize: true,
      height: 300,
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

    const valueSeries = chart.addSeries(AreaSeries, {
      lineColor: theme.line,
      lineWidth: 2,
      topColor: `${theme.line}40`,
      bottomColor: `${theme.line}00`,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    valueSeries.setData(points.map((p) => ({ time: p.date, value: p.value })));

    const investedSeries = chart.addSeries(LineSeries, {
      color: investedColor,
      lineWidth: 2,
      lineStyle: 1, // dotted — reads as "reference", also a CVD-safe cue
      priceLineVisible: false,
      lastValueVisible: false,
    });
    investedSeries.setData(points.map((p) => ({ time: p.date, value: p.invested })));

    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param) => {
      const value = (param.seriesData.get(valueSeries) as { value?: number } | undefined)?.value;
      const invested = (param.seriesData.get(investedSeries) as { value?: number } | undefined)
        ?.value;
      if (!param.point || !param.time || value === undefined) {
        tooltip.style.display = "none";
        return;
      }
      tooltip.style.display = "block";
      const date = new Date(String(param.time)).toLocaleDateString(i18n.language);
      const valueLine = `${t("portfolio.series.value")}: ${formatCurrency(value, currency, i18n.language)}`;
      const investedLine =
        invested === undefined
          ? ""
          : `\n${t("portfolio.series.invested")}: ${formatCurrency(invested, currency, i18n.language)}`;
      tooltip.textContent = `${date}\n${valueLine}${investedLine}`;
      const x = Math.min(param.point.x + 12, container.clientWidth - tooltip.clientWidth - 4);
      tooltip.style.transform = `translate(${x}px, 8px)`;
    });

    return () => chart.remove();
  }, [points, currency, i18n.language, t]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-sm font-semibold text-ink-soft">
        <span className="inline-flex items-center gap-2">
          <span
            className="h-1 w-5 rounded-full"
            style={{ backgroundColor: "var(--color-chart-1)" }}
            aria-hidden
          />
          {t("portfolio.series.value")}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="h-0 w-5 border-t-2 border-dotted"
            style={{ borderColor: "var(--color-chart-2)" }}
            aria-hidden
          />
          {t("portfolio.series.invested")}
        </span>
      </div>
      <div className="relative">
        <div ref={containerRef} className="h-75 w-full" />
        <div
          ref={tooltipRef}
          className="wobbly pointer-events-none absolute top-0 left-0 hidden whitespace-pre border-2 border-ink/20 bg-surface px-3 py-1 text-sm font-semibold text-ink shadow-sm"
        />
      </div>
    </div>
  );
}
