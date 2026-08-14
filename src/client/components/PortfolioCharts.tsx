import type {
  PortfolioAllocationResponse,
  PortfolioHistoryResponse,
  PortfolioSummaryResponse,
} from "@shared/api.ts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api.ts";
import { DonutChart } from "./charts/DonutChart.tsx";
import { type Range, RangeSwitcher } from "./charts/RangeSwitcher.tsx";
import { StatsBlock } from "./charts/StatsBlock.tsx";
import { ValueChart } from "./charts/ValueChart.tsx";
import { Card } from "./ui/Card.tsx";
import { Skeleton } from "./ui/Skeleton.tsx";

/** Dashboard analytics: stats block, value-over-time chart, allocation donuts. */
export function PortfolioCharts() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<PortfolioSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PortfolioHistoryResponse | null>(null);
  const [allocation, setAllocation] = useState<PortfolioAllocationResponse | null>(null);
  const [range, setRange] = useState<Range>("90");

  useEffect(() => {
    apiFetch<PortfolioSummaryResponse>("/api/portfolio/summary")
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
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

  // Skeletons while the first fetch runs — content keeps its future shape.
  if (loading) {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }
  if (!summary || summary.totalValue === "0") return null;
  const currency = summary.baseCurrency;

  return (
    <div className="w-full space-y-6 text-left">
      {summary.missingPrices.length > 0 && (
        <p className="wobbly bg-cream-dark px-4 py-2 text-sm font-semibold text-ink-soft">
          {t("portfolio.missingPrices")}
        </p>
      )}

      <StatsBlock summary={summary} />

      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{t("portfolio.valueChart")}</h2>
          <RangeSwitcher value={range} onChange={setRange} />
        </div>
        {history === null ? (
          <Skeleton className="h-75 w-full" />
        ) : history.points.length > 1 ? (
          <ValueChart points={history.points} currency={currency} />
        ) : (
          <p className="text-ink-soft">{t("portfolio.chartNeedsHistory")}</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-xl font-bold">{t("portfolio.allocation.title")}</h2>
        {allocation === null ? (
          <Skeleton className="h-48 w-full" />
        ) : (
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
        )}
      </Card>
    </div>
  );
}
