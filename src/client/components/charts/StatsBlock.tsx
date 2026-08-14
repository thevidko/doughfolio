import type { PortfolioSummaryResponse } from "@shared/api.ts";
import { Decimal, formatCurrency } from "@shared/money.ts";
import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card.tsx";

/**
 * All headline stats in one card (owner request). Polarity is never
 * color-alone (arrow + sign); each entry carries a plain-words hint so terms
 * like unrealized vs. realized explain themselves.
 */
export function StatsBlock({ summary }: { summary: PortfolioSummaryResponse }) {
  const { t, i18n } = useTranslation();
  const money = (value: string) => formatCurrency(value, summary.baseCurrency, i18n.language);

  const entries: {
    key: string;
    label: string;
    hint: string;
    value: string;
    signed?: string | null;
    big?: boolean;
  }[] = [
    {
      key: "totalValue",
      label: t("stats.totalValue"),
      hint: "",
      value: money(summary.totalValue),
      big: true,
    },
    {
      key: "invested",
      label: t("stats.invested"),
      hint: t("stats.investedHint"),
      value: money(summary.invested),
      big: true,
    },
    {
      key: "change24h",
      label: t("stats.change24h"),
      hint: t("stats.change24hHint"),
      value: summary.change24h ? money(summary.change24h) : "—",
      signed: summary.change24h,
    },
    {
      key: "unrealized",
      label: t("stats.unrealized"),
      hint: t("stats.unrealizedHint"),
      value: money(summary.unrealized),
      signed: summary.unrealized,
    },
    {
      key: "realized",
      label: t("stats.realized"),
      hint: t("stats.realizedHint"),
      value: money(summary.realized),
      signed: summary.realized,
    },
    {
      key: "feesPaid",
      label: t("stats.feesPaid"),
      hint: t("stats.feesPaidHint"),
      value: money(summary.feesPaid),
    },
    {
      key: "rewards",
      label: t("stats.rewards"),
      hint: t("stats.rewardsHint"),
      value: money(summary.rewardsValue),
    },
  ];

  return (
    <Card className="w-full">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-left sm:grid-cols-3 xl:grid-cols-7">
        {entries.map((entry) => {
          const polarity = entry.signed == null ? 0 : new Decimal(entry.signed).comparedTo(0);
          const tone =
            polarity > 0 ? "text-matcha-dark" : polarity < 0 ? "text-blush-dark" : "text-ink";
          const arrow = polarity > 0 ? "▲ " : polarity < 0 ? "▼ " : "";
          return (
            <div key={entry.key} title={entry.hint}>
              <dt className="text-xs font-semibold text-ink-soft">{entry.label}</dt>
              <dd
                className={`whitespace-nowrap font-display font-bold tabular-nums ${
                  entry.big ? "text-xl text-dough-dark" : `text-base ${tone}`
                }`}
              >
                {arrow}
                {entry.value}
              </dd>
              {entry.hint && (
                <p className="mt-0.5 hidden text-[11px] leading-tight text-ink-soft/80 xl:block">
                  {entry.hint}
                </p>
              )}
            </div>
          );
        })}
      </dl>
    </Card>
  );
}
