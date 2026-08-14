import type {
  PortfolioAllocationResponse,
  PortfolioHistoryResponse,
  PortfolioSummaryResponse,
} from "@shared/api.ts";
import { formatCurrency } from "@shared/money.ts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api.ts";
import { DonutChart } from "./charts/DonutChart.tsx";
import { type Range, RangeSwitcher } from "./charts/RangeSwitcher.tsx";
import { StatTile } from "./charts/StatTile.tsx";
import { ValueChart } from "./charts/ValueChart.tsx";
import { Card } from "./ui/Card.tsx";

/** Dashboard analytics: stat tiles, value-over-time chart, allocation donuts. */
export function PortfolioCharts() {
  const { t, i18n } = useTranslation();
  const [summary, setSummary] = useState<PortfolioSummaryResponse | null>(null);
  const [history, setHistory] = useState<PortfolioHistoryResponse | null>(null);
  const [allocation, setAllocation] = useState<PortfolioAllocationResponse | null>(null);
  const [range, setRange] = useState<Range>("90");

  useEffect(() => {
    apiFetch<PortfolioSummaryResponse>("/api/portfolio/summary")
      .then(setSummary)
      .catch(() => setSummary(null));
    apiFetch<PortfolioAllocationResponse>("/api/portfolio/allocation")
      .then(setAllocation)
      .catch(() => setAllocation(null));
  }, []);

  useEffect(() => {
    const query = range === "all" ? "" : `?days=${range}`;
    apiFetch<PortfolioHistoryResponse>(`/api/portfolio/history${query}`)
      .then(setHistory)
      .catch(() => setHistory(null));
  }, [range]);

  if (!summary || summary.totalValue === "0") return null;
  const currency = summary.baseCurrency;
  const money = (value: string) => formatCurrency(value, currency, i18n.language);

  return (
    <div className="w-full space-y-6 text-left">
      {summary.missingPrices.length > 0 && (
        <p className="wobbly bg-cream-dark px-4 py-2 text-sm font-semibold text-ink-soft">
          {t("portfolio.missingPrices")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label={t("portfolio.tiles.totalValue")} value={money(summary.totalValue)} />
        <StatTile
          label={t("portfolio.tiles.change24h")}
          value={summary.change24h ? money(summary.change24h) : "—"}
          signed={summary.change24h}
        />
        <StatTile
          label={t("portfolio.tiles.unrealized")}
          value={money(summary.unrealized)}
          signed={summary.unrealized}
        />
        <StatTile
          label={t("portfolio.tiles.realized")}
          value={money(summary.realized)}
          signed={summary.realized}
        />
        <StatTile label={t("portfolio.tiles.feesPaid")} value={money(summary.feesPaid)} />
        <StatTile label={t("portfolio.tiles.rewards")} value={money(summary.rewardsValue)} />
      </div>

      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{t("portfolio.valueChart")}</h2>
          <RangeSwitcher value={range} onChange={setRange} />
        </div>
        {history && history.points.length > 1 ? (
          <ValueChart points={history.points} currency={currency} />
        ) : (
          <p className="text-ink-soft">{t("portfolio.chartNeedsHistory")}</p>
        )}
      </Card>

      {allocation && (
        <Card>
          <h2 className="mb-4 text-xl font-bold">{t("portfolio.allocation.title")}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <DonutChart
              title={t("portfolio.allocation.byAsset")}
              slices={allocation.byAsset}
              currency={currency}
            />
            <DonutChart
              title={t("portfolio.allocation.byGroup")}
              slices={allocation.byGroup}
              currency={currency}
            />
            <DonutChart
              title={t("portfolio.allocation.byStorageType")}
              slices={allocation.byStorageType}
              currency={currency}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
