import type { AssetDetailResponse } from "@shared/api.ts";
import { formatCurrency, formatQuantity } from "@shared/money.ts";
import { createChart, createSeriesMarkers, LineSeries } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { AppHeader } from "../components/AppHeader.tsx";
import { chartTheme } from "../components/charts/chartTheme.ts";
import { type Range, RangeSwitcher } from "../components/charts/RangeSwitcher.tsx";
import { StatTile } from "../components/charts/StatTile.tsx";
import { Splash } from "../components/Splash.tsx";
import { Card } from "../components/ui/Card.tsx";
import { apiFetch } from "../lib/api.ts";

/** Per-asset view: price line with the user's own trades marked on it. */
export function AssetDetail() {
  const { t, i18n } = useTranslation();
  const { assetId = "" } = useParams();
  const [detail, setDetail] = useState<AssetDetailResponse | null>(null);
  const [range, setRange] = useState<Range>("365");
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const query = range === "all" ? "?days=3650" : `?days=${range}`;
    apiFetch<AssetDetailResponse>(`/api/portfolio/asset/${assetId}${query}`)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [assetId, range]);

  useEffect(() => {
    const container = chartRef.current;
    if (!container || !detail || detail.series.length === 0) return;

    const theme = chartTheme();
    const chart = createChart(container, {
      autoSize: true,
      height: 300,
      layout: {
        background: { color: "transparent" },
        textColor: theme.inkSoft,
        fontFamily: theme.fontFamily,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: theme.grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      localization: {
        priceFormatter: (value: number) =>
          formatCurrency(value, detail.baseCurrency, i18n.language),
      },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addSeries(LineSeries, {
      color: theme.line,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    series.setData(detail.series.map((p) => ({ time: p.date, value: p.price })));

    // Trade markers: ▲ buys below the line (matcha), ▼ sells above (blush).
    const inRange = new Set(detail.series.map((p) => p.date));
    createSeriesMarkers(
      series,
      detail.markers
        .filter((m) => inRange.has(m.date))
        .map((marker) => ({
          time: marker.date,
          position: marker.type === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
          shape: marker.type === "buy" ? ("arrowUp" as const) : ("arrowDown" as const),
          color: marker.type === "buy" ? theme.up : theme.down,
          text: `${marker.type === "buy" ? "+" : "−"}${formatQuantity(marker.quantity, i18n.language)}`,
        })),
    );
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [detail, i18n.language]);

  if (!detail) return <Splash />;
  const money = (value: string) => formatCurrency(value, detail.baseCurrency, i18n.language);

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-ink-soft hover:text-ink" aria-label={t("assetDetail.back")}>
            ←
          </Link>
          <h1 className="font-display text-3xl font-bold uppercase">{detail.assetId}</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label={t("assetDetail.quantity")}
            value={formatQuantity(detail.quantity, i18n.language)}
          />
          <StatTile
            label={t("assetDetail.value")}
            value={detail.value ? money(detail.value) : "—"}
          />
          <StatTile label={t("assetDetail.costBasis")} value={money(detail.costBasis)} />
          <StatTile
            label={t("portfolio.tiles.realized")}
            value={money(detail.realized)}
            signed={detail.realized}
          />
          <StatTile label={t("portfolio.tiles.feesPaid")} value={money(detail.feesPaid)} />
        </div>

        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">{t("assetDetail.priceChart")}</h2>
            <RangeSwitcher value={range} onChange={setRange} />
          </div>
          <div ref={chartRef} className="h-75 w-full" />
        </Card>
      </main>
    </div>
  );
}
