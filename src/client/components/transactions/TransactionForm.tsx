import type { AssetDto, TransactionDto, WalletDto } from "@shared/api.ts";
import { SUPPORTED_CURRENCIES } from "@shared/currencies.ts";
import { isPositiveDecimalString, normalizeDecimalInput } from "@shared/money.ts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { translateServerKey } from "../../i18n/index.ts";
import { ApiRequestError, patchJson, postJson } from "../../lib/api.ts";
import { Button } from "../ui/Button.tsx";
import { TextInput } from "../ui/TextInput.tsx";
import { AssetPicker } from "./AssetPicker.tsx";

type FormType = "buy" | "sell" | "transfer" | "reward";

type TransactionFormProps = {
  wallets: WalletDto[];
  walletId: string;
  baseCurrency: string;
  /** When set, the form edits this transaction instead of creating one. */
  editing?: TransactionDto | null;
  onSaved: () => Promise<void>;
  onCancel?: () => void;
};

/** Local datetime-local value for "now" (or a stored ISO timestamp). */
function toLocalInput(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Type-aware add/edit form for transactions (manual-transactions spec). */
export function TransactionForm({
  wallets,
  walletId,
  baseCurrency,
  editing = null,
  onSaved,
  onCancel,
}: TransactionFormProps) {
  const { t } = useTranslation();
  const editingType: FormType | null = editing
    ? editing.type === "transfer_in" || editing.type === "transfer_out"
      ? "transfer"
      : editing.type
    : null;

  const [type, setType] = useState<FormType>(editingType ?? "buy");
  const [asset, setAsset] = useState<AssetDto | null>(
    editing ? { id: editing.assetId, symbol: editing.assetId, name: "" } : null,
  );
  const [quantity, setQuantity] = useState(editing?.quantity ?? "");
  const [unitPrice, setUnitPrice] = useState(editing?.unitPrice ?? "");
  const [priceCurrency, setPriceCurrency] = useState(editing?.priceCurrency ?? baseCurrency);
  const [toWalletId, setToWalletId] = useState(wallets.find((w) => w.id !== walletId)?.id ?? "");
  const [withFee, setWithFee] = useState(Boolean(editing?.feeQuantity));
  const [feeQuantity, setFeeQuantity] = useState(editing?.feeQuantity ?? "");
  const [feeAsset, setFeeAsset] = useState<AssetDto | null>(
    editing?.feeAssetId ? { id: editing.feeAssetId, symbol: editing.feeAssetId, name: "" } : null,
  );
  const [occurredAt, setOccurredAt] = useState(toLocalInput(editing?.occurredAt));
  const [note, setNote] = useState(editing?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const qty = normalizeDecimalInput(quantity);
  const price = normalizeDecimalInput(unitPrice);
  const feeQty = normalizeDecimalInput(feeQuantity);
  const priced = type === "buy" || type === "sell";

  const valid =
    asset !== null &&
    isPositiveDecimalString(qty) &&
    (!priced || isPositiveDecimalString(price)) &&
    (type !== "transfer" || (toWalletId && toWalletId !== walletId)) &&
    (!withFee || (isPositiveDecimalString(feeQty) && feeAsset !== null));

  async function submit() {
    if (!valid || !asset || busy) return;
    setBusy(true);
    setErrorMessage(null);

    const fee = withFee && feeAsset ? { quantity: feeQty, assetId: feeAsset.id } : undefined;
    const common = {
      assetId: asset.id,
      quantity: qty,
      occurredAt: new Date(occurredAt).toISOString(),
      note: note.trim() || undefined,
      fee,
    };

    try {
      if (editing) {
        await patchJson(`/api/transactions/${editing.id}`, {
          ...common,
          fee: fee ?? null,
          note: note.trim() || null,
          ...(priced ? { unitPrice: price, priceCurrency } : {}),
        });
      } else if (type === "transfer") {
        await postJson("/api/transactions", {
          type,
          fromWalletId: walletId,
          toWalletId,
          ...common,
        });
      } else {
        await postJson("/api/transactions", {
          type,
          walletId,
          ...common,
          ...(priced ? { unitPrice: price, priceCurrency } : {}),
        });
      }
      await onSaved();
    } catch (error) {
      setErrorMessage(
        translateServerKey(error instanceof ApiRequestError ? error.messageKey : "errors.network"),
      );
    } finally {
      setBusy(false);
    }
  }

  const labelClass = "block text-sm font-semibold text-ink-soft mb-1";
  const selectClass =
    "wobbly-2 w-full border-2 border-ink-soft/60 bg-cream px-3 py-2.5 text-ink outline-none focus:border-ink";

  return (
    <div className="space-y-4">
      {!editing && (
        <div className="flex flex-wrap gap-2" role="tablist">
          {(["buy", "sell", "transfer", "reward"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={type === option}
              onClick={() => setType(option)}
              className={`wobbly border-2 px-4 py-1.5 font-display font-semibold transition-transform active:scale-95 ${
                type === option
                  ? "border-ink bg-dough text-ink"
                  : "border-ink/20 bg-surface text-ink-soft hover:border-ink/50"
              }`}
            >
              {t(`transactions.types.${option}`)}
            </button>
          ))}
        </div>
      )}

      <div>
        <label className={labelClass} htmlFor="tx-asset">
          {t("transactions.form.asset")}
        </label>
        <AssetPicker
          inputId="tx-asset"
          value={asset}
          onChange={setAsset}
          placeholder={t("transactions.form.assetPlaceholder")}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="tx-quantity">
            {t("transactions.form.quantity")}
          </label>
          <TextInput
            id="tx-quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.5"
            inputMode="decimal"
            aria-invalid={quantity.length > 0 && !isPositiveDecimalString(qty)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="tx-date">
            {t("transactions.form.date")}
          </label>
          <TextInput
            id="tx-date"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>
      </div>

      {priced && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="tx-price">
              {t("transactions.form.unitPrice")}
            </label>
            <TextInput
              id="tx-price"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="50000"
              inputMode="decimal"
              aria-invalid={unitPrice.length > 0 && !isPositiveDecimalString(price)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="tx-currency">
              {t("transactions.form.priceCurrency")}
            </label>
            <select
              id="tx-currency"
              className={selectClass}
              value={priceCurrency}
              onChange={(e) => setPriceCurrency(e.target.value)}
            >
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {type === "transfer" && !editing && (
        <div>
          <label className={labelClass} htmlFor="tx-to-wallet">
            {t("transactions.form.toWallet")}
          </label>
          <select
            id="tx-to-wallet"
            className={selectClass}
            value={toWalletId}
            onChange={(e) => setToWalletId(e.target.value)}
          >
            {wallets
              .filter((w) => w.id !== walletId)
              .map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {withFee ? (
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className={labelClass} htmlFor="tx-fee-qty">
              {t("transactions.form.feeQuantity")}
            </label>
            <TextInput
              id="tx-fee-qty"
              value={feeQuantity}
              onChange={(e) => setFeeQuantity(e.target.value)}
              placeholder="0.0002"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="tx-fee-asset">
              {t("transactions.form.feeAsset")}
            </label>
            <AssetPicker
              inputId="tx-fee-asset"
              value={feeAsset}
              onChange={setFeeAsset}
              placeholder={t("transactions.form.assetPlaceholder")}
            />
          </div>
          <Button variant="ghost" onClick={() => setWithFee(false)}>
            {t("transactions.form.removeFee")}
          </Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setWithFee(true)}>
          {t("transactions.form.addFee")}
        </Button>
      )}

      <div>
        <label className={labelClass} htmlFor="tx-note">
          {t("transactions.form.note")}
        </label>
        <TextInput
          id="tx-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </div>

      {errorMessage && (
        <p role="alert" className="font-semibold text-blush-dark">
          {errorMessage}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={() => void submit()} disabled={!valid || busy}>
          {t("transactions.form.submit")}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
      </div>
    </div>
  );
}
