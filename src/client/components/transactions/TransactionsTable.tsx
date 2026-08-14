import type { TransactionDto } from "@shared/api.ts";
import { formatCurrency, formatQuantity } from "@shared/money.ts";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";

type TransactionsTableProps = {
  transactions: TransactionDto[];
  runningBalances: string[];
  onEdit: (tx: TransactionDto) => void;
  onDelete: (tx: TransactionDto) => void;
};

const TYPE_ICONS: Record<TransactionDto["type"], string> = {
  buy: "🛒",
  sell: "💰",
  transfer_in: "📥",
  transfer_out: "📤",
  reward: "🌾",
};

const OUTFLOW = new Set(["sell", "transfer_out"]);

/** Per-wallet transaction history with running balances. */
export function TransactionsTable({
  transactions,
  runningBalances,
  onEdit,
  onDelete,
}: TransactionsTableProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-160 text-left text-sm">
        <thead>
          <tr className="border-ink/15 border-b-2 font-display text-ink-soft">
            <th className="px-2 py-2">{t("transactions.table.date")}</th>
            <th className="px-2 py-2">{t("transactions.table.type")}</th>
            <th className="px-2 py-2">{t("transactions.table.asset")}</th>
            <th className="px-2 py-2 text-right">{t("transactions.table.quantity")}</th>
            <th className="px-2 py-2 text-right">{t("transactions.table.price")}</th>
            <th className="px-2 py-2 text-right">{t("transactions.table.fee")}</th>
            <th className="px-2 py-2 text-right">{t("transactions.table.balance")}</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, index) => {
            const outflow = OUTFLOW.has(tx.type);
            return (
              <tr key={tx.id} className="border-ink/10 border-b align-top">
                <td className="whitespace-nowrap px-2 py-2">
                  {new Date(tx.occurredAt).toLocaleDateString(locale)}
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  <span aria-hidden>{TYPE_ICONS[tx.type]}</span>{" "}
                  {t(`transactions.types.${tx.type}`)}
                </td>
                <td className="px-2 py-2 font-semibold uppercase">{tx.assetId}</td>
                <td
                  className={`px-2 py-2 text-right tabular-nums ${
                    outflow ? "text-blush-dark" : "text-matcha-dark"
                  }`}
                >
                  {outflow ? "−" : "+"}
                  {formatQuantity(tx.quantity, locale)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {tx.unitPrice && tx.priceCurrency
                    ? formatCurrency(tx.unitPrice, tx.priceCurrency, locale)
                    : "—"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {tx.feeQuantity && tx.feeAssetId
                    ? `${formatQuantity(tx.feeQuantity, locale)} ${tx.feeAssetId.toUpperCase()}`
                    : "—"}
                </td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">
                  {formatQuantity(runningBalances[index] ?? "0", locale)}
                </td>
                <td className="whitespace-nowrap px-2 py-1 text-right">
                  <Button variant="ghost" onClick={() => onEdit(tx)}>
                    {t("transactions.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={t("common.delete")}
                    onClick={() => onDelete(tx)}
                  >
                    ✕
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
