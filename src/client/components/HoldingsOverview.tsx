import type { BalancesResponse, SpotPricesResponse } from "@shared/api.ts";
import { Decimal, formatCurrency, formatQuantity } from "@shared/money.ts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api.ts";
import { Mascot } from "./Mascot.tsx";
import { Card } from "./ui/Card.tsx";

/** Dashboard summary: total portfolio value and per-asset holdings. */
export function HoldingsOverview({ baseCurrency }: { baseCurrency: string }) {
  const { t, i18n } = useTranslation();
  const [balances, setBalances] = useState<BalancesResponse | null>(null);
  const [prices, setPrices] = useState<SpotPricesResponse | null>(null);

  useEffect(() => {
    apiFetch<BalancesResponse>("/api/portfolio/balances")
      .then((bal) => {
        setBalances(bal);
        const assets = Object.keys(bal.totals);
        if (assets.length > 0) {
          return apiFetch<SpotPricesResponse>(
            `/api/prices/spot?assets=${encodeURIComponent(assets.join(","))}&currency=${baseCurrency}`,
          ).then(setPrices);
        }
      })
      .catch(() => setBalances(null));
  }, [baseCurrency]);

  const holdings = Object.entries(balances?.totals ?? {}).filter(
    ([, quantity]) => !new Decimal(quantity).isZero(),
  );
  if (!balances) return null;

  // Empty portfolio → the mascot invites the first transaction instead.
  if (holdings.length === 0) {
    return (
      <Card className="animate-pop flex w-full flex-col items-center gap-4 py-10">
        <Mascot size={110} />
        <p className="max-w-md text-ink-soft">{t("dashboard.empty")}</p>
      </Card>
    );
  }

  const totalValue = holdings.reduce((sum, [assetId, quantity]) => {
    const price = prices?.prices[assetId];
    return price ? sum.plus(new Decimal(quantity).times(price)) : sum;
  }, new Decimal(0));

  return (
    <Card className="animate-pop w-full">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">{t("holdings.title")}</h2>
        <p className="font-display text-2xl font-bold text-dough-dark">
          {prices
            ? formatCurrency(totalValue.toString(), baseCurrency, i18n.language)
            : t("holdings.noPrices")}
        </p>
      </div>
      {prices?.stale && (
        <p className="mt-1 text-sm font-semibold text-ink-soft">{t("transactions.staleprices")}</p>
      )}
      <ul className="mt-4 grid gap-2 text-left sm:grid-cols-2 lg:grid-cols-3">
        {holdings.map(([assetId, quantity]) => {
          const price = prices?.prices[assetId];
          const staked = balances.staked[assetId];
          return (
            <li key={assetId} className="wobbly-2 border-2 border-ink/10 bg-cream px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display font-bold uppercase">{assetId}</span>
                <span className="tabular-nums text-sm text-ink-soft">
                  {price
                    ? formatCurrency(
                        new Decimal(quantity).times(price).toString(),
                        baseCurrency,
                        i18n.language,
                      )
                    : "—"}
                </span>
              </div>
              <div className="text-sm tabular-nums">
                {formatQuantity(quantity, i18n.language)}
                {staked && !new Decimal(staked).isZero() && (
                  <span className="ml-2 text-matcha-dark">
                    🌾 {formatQuantity(staked, i18n.language)} {t("holdings.staked")}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
