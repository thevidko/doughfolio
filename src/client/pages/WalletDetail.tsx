import type {
  BalancesResponse,
  SpotPricesResponse,
  TransactionDto,
  TransactionListResponse,
} from "@shared/api.ts";
import { Decimal, formatCurrency, formatQuantity } from "@shared/money.ts";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";
import { AppHeader } from "../components/AppHeader.tsx";
import { Splash } from "../components/Splash.tsx";
import { TransactionForm } from "../components/transactions/TransactionForm.tsx";
import { TransactionsTable } from "../components/transactions/TransactionsTable.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Card } from "../components/ui/Card.tsx";
import { useSetupStatus } from "../hooks/useSetupStatus.tsx";
import { useWalletStructure } from "../hooks/useWalletStructure.ts";
import { apiFetch, deleteJson } from "../lib/api.ts";

/** Wallet detail: holdings of one basket + its transaction history. */
export function WalletDetail() {
  const { t, i18n } = useTranslation();
  const { walletId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const setup = useSetupStatus();
  const baseCurrency = (setup.phase === "ready" ? setup.status.baseCurrency : null) ?? "usd";

  const { state: structure } = useWalletStructure();
  const [list, setList] = useState<TransactionListResponse | null>(null);
  const [balances, setBalances] = useState<BalancesResponse | null>(null);
  const [prices, setPrices] = useState<SpotPricesResponse | null>(null);
  const [adding, setAdding] = useState(searchParams.get("add") === "1");
  const [editing, setEditing] = useState<TransactionDto | null>(null);

  const reload = useCallback(async () => {
    const [txs, bal] = await Promise.all([
      apiFetch<TransactionListResponse>(`/api/wallets/${walletId}/transactions`),
      apiFetch<BalancesResponse>("/api/portfolio/balances"),
    ]);
    setList(txs);
    setBalances(bal);
    setAdding(false);
    setEditing(null);

    const assets = Object.keys(bal.wallets[walletId] ?? {});
    if (assets.length > 0) {
      apiFetch<SpotPricesResponse>(
        `/api/prices/spot?assets=${encodeURIComponent(assets.join(","))}&currency=${baseCurrency}`,
      )
        .then(setPrices)
        .catch(() => setPrices(null));
    }
  }, [walletId, baseCurrency]);

  useEffect(() => {
    reload().catch(() => setList(null));
  }, [reload]);

  if (structure.phase === "loading" || !list || !balances) return <Splash />;
  if (structure.phase === "failed") return <Splash failed />;

  const wallet = structure.wallets.find((w) => w.id === walletId);
  if (!wallet) return <Splash failed />;
  const storageType = structure.storageTypes.find((s) => s.id === wallet.storageTypeId);

  const holdings = Object.entries(balances.wallets[walletId] ?? {}).filter(
    ([, quantity]) => !new Decimal(quantity).isZero(),
  );
  const walletValue = holdings.reduce((sum, [assetId, quantity]) => {
    const price = prices?.prices[assetId];
    return price ? sum.plus(new Decimal(quantity).times(price)) : sum;
  }, new Decimal(0));
  const hasOverdraw = balances.overdrawn.some((pair) => pair.startsWith(`${walletId}:`));

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/wallets"
            className="text-ink-soft hover:text-ink"
            aria-label={t("common.back")}
          >
            ←
          </Link>
          <h1 className="text-3xl font-bold">{wallet.name}</h1>
          {storageType && (
            <span className="wobbly bg-cream-dark px-2 py-0.5 text-xs font-semibold text-ink-soft">
              {storageType.name}
            </span>
          )}
        </div>

        {hasOverdraw && (
          <p role="alert" className="wobbly bg-blush/20 px-4 py-2 font-semibold text-blush-dark">
            ⚠️ {t("transactions.overdrawnWarning")}
          </p>
        )}
        {prices?.stale && (
          <p className="wobbly bg-cream-dark px-4 py-2 text-sm font-semibold text-ink-soft">
            {t("transactions.staleprices")}
          </p>
        )}

        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-bold">{t("holdings.title")}</h2>
            <p className="font-display text-lg font-bold">
              {t("holdings.walletValue")}:{" "}
              {prices
                ? formatCurrency(walletValue.toString(), baseCurrency, i18n.language)
                : t("holdings.noPrices")}
            </p>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {holdings.map(([assetId, quantity]) => {
              const price = prices?.prices[assetId];
              return (
                <li key={assetId} className="wobbly-2 border-2 border-ink/10 bg-cream px-3 py-2">
                  <span className="font-display font-bold uppercase">{assetId}</span>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="tabular-nums">{formatQuantity(quantity, i18n.language)}</span>
                    <span className="tabular-nums text-ink-soft">
                      {price
                        ? formatCurrency(
                            new Decimal(quantity).times(price).toString(),
                            baseCurrency,
                            i18n.language,
                          )
                        : "—"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{t("transactions.title")}</h2>
            {!adding && !editing && (
              <Button onClick={() => setAdding(true)}>+ {t("transactions.add")}</Button>
            )}
          </div>

          {(adding || editing) && (
            <div className="animate-pop mt-4 border-ink/10 border-b pb-6">
              <TransactionForm
                wallets={structure.wallets}
                walletId={walletId}
                baseCurrency={baseCurrency}
                editing={editing}
                onSaved={reload}
                onCancel={() => {
                  setAdding(false);
                  setEditing(null);
                }}
              />
            </div>
          )}

          <div className="mt-4">
            {list.transactions.length === 0 ? (
              <p className="text-ink-soft">{t("transactions.empty")}</p>
            ) : (
              <TransactionsTable
                transactions={list.transactions}
                runningBalances={list.runningBalances}
                onEdit={setEditing}
                onDelete={(tx) => {
                  if (confirm(t("transactions.confirmDelete"))) {
                    deleteJson(`/api/transactions/${tx.id}`).then(reload);
                  }
                }}
              />
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
