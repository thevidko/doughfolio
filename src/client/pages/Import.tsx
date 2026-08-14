import type { AssetDto, ImportCommitResponse, ImportPreviewResponse } from "@shared/api.ts";
import { SUPPORTED_CURRENCIES } from "@shared/currencies.ts";
import type { ImportMapping } from "@shared/schemas/import.ts";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AppHeader } from "../components/AppHeader.tsx";
import { Splash } from "../components/Splash.tsx";
import { AssetPicker } from "../components/transactions/AssetPicker.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Card } from "../components/ui/Card.tsx";
import { useWalletStructure } from "../hooks/useWalletStructure.ts";
import { translateServerKey } from "../i18n/index.ts";
import { ApiRequestError, postJson } from "../lib/api.ts";

type TypeAction = "buy" | "sell" | "reward" | "transfer" | "skip";

/** Default action guess for a source type value (BUY→buy, STAKE→reward…). */
function guessAction(value: string): TypeAction {
  const v = value.toLowerCase();
  if (v.includes("buy") || v.includes("nákup") || v.includes("nakup")) return "buy";
  if (v.includes("sell") || v.includes("prodej")) return "sell";
  if (v.includes("stak") || v.includes("reward") || v.includes("odměn")) return "reward";
  if (v.includes("transfer") || v.includes("převod") || v.includes("withdraw")) return "transfer";
  return "skip";
}

/** CSV import wizard: file → guessed mapping → adjust → commit (spec). */
export function Import() {
  const { t } = useTranslation();
  const { state: structure } = useWalletStructure();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [csv, setCsv] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [targetWalletId, setTargetWalletId] = useState("");
  const [columns, setColumns] = useState<ImportPreviewResponse["guess"]>({});
  const [fixedAsset, setFixedAsset] = useState<AssetDto | null>(null);
  const [assetMode, setAssetMode] = useState<"fixed" | "column">("fixed");
  const [fixedCurrency, setFixedCurrency] = useState("");
  const [typeActions, setTypeActions] = useState<
    Record<string, { action: TypeAction; toWalletId?: string }>
  >({});
  const [result, setResult] = useState<ImportCommitResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (structure.phase === "loading") return <Splash />;
  if (structure.phase === "failed") return <Splash failed />;
  const wallets = structure.wallets;

  async function loadPreview() {
    const file = fileRef.current?.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const text = await file.text();
      const loaded = await postJson<ImportPreviewResponse>("/api/import/preview", { csv: text });
      setCsv(text);
      setPreview(loaded);
      setColumns(loaded.guess);
      setAssetMode(loaded.guess.asset !== undefined ? "column" : "fixed");
      const firstOther = wallets.find((w) => w.id !== targetWalletId)?.id;
      setTypeActions(
        Object.fromEntries(
          loaded.typeValues.map((value) => {
            const action = guessAction(value);
            return [value, { action, toWalletId: action === "transfer" ? firstOther : undefined }];
          }),
        ),
      );
    } catch (error) {
      setErrorMessage(
        translateServerKey(error instanceof ApiRequestError ? error.messageKey : "errors.network"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!csv || !preview || busy) return;
    setBusy(true);
    setErrorMessage(null);
    const col = (index: number | undefined) =>
      index === undefined ? undefined : { column: index };
    const mapping: ImportMapping = {
      targetWalletId,
      asset:
        assetMode === "fixed" && fixedAsset
          ? { fixed: fixedAsset.id }
          : { column: columns.asset ?? 0 },
      date: { column: columns.date ?? 0 },
      quantity: { column: columns.quantity ?? 0 },
      unitPrice: col(columns.unitPrice),
      priceCurrency:
        columns.priceCurrency !== undefined
          ? { column: columns.priceCurrency }
          : fixedCurrency
            ? { fixed: fixedCurrency }
            : undefined,
      feeQuantity: col(columns.feeQuantity),
      feeCurrency: columns.feeCurrency !== undefined ? { column: columns.feeCurrency } : undefined,
      note: col(columns.note),
      type:
        columns.type !== undefined
          ? { column: columns.type, values: typeActions }
          : { fixed: "buy" },
    };
    try {
      setResult(await postJson<ImportCommitResponse>("/api/import/commit", { csv, mapping }));
    } catch (error) {
      setErrorMessage(
        translateServerKey(error instanceof ApiRequestError ? error.messageKey : "errors.network"),
      );
    } finally {
      setBusy(false);
    }
  }

  const selectClass =
    "wobbly-2 border-2 border-ink-soft/60 bg-cream px-3 py-2 text-ink outline-none focus:border-ink";
  const labelClass = "block text-sm font-semibold text-ink-soft mb-1";
  const describeReason = (entry: { line: number; reason: string }) => {
    const [code, value] = entry.reason.split(":");
    // Reason codes are a closed server-side set; unknown ones fall back below.
    const key = `import.reasons.${code}`;
    return `${t("import.line", { line: entry.line })}: ${translateServerKey(key) === translateServerKey("errors.network") ? entry.reason : t(key as never, { value })}`;
  };

  /** Column dropdown bound to one mapping field. */
  const ColumnSelect = ({ field }: { field: keyof ImportPreviewResponse["guess"] }) => (
    <select
      className={selectClass}
      value={columns[field] ?? ""}
      aria-label={t(`import.fields.${field}`)}
      onChange={(e) =>
        setColumns((prev) => ({
          ...prev,
          [field]: e.target.value === "" ? undefined : Number(e.target.value),
        }))
      }
    >
      <option value="">{t("import.notMapped")}</option>
      {preview?.headers.map((header, index) => (
        <option key={header} value={index}>
          {header}
        </option>
      ))}
    </select>
  );

  if (result) {
    return (
      <div className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto max-w-3xl space-y-6 p-6">
          <Card className="animate-pop space-y-4 text-center">
            <h1 className="text-3xl font-bold">{t("import.doneTitle")}</h1>
            <p className="font-display text-xl text-matcha-dark">
              {t("import.imported", { count: result.imported })}
            </p>
            {result.warnings.length > 0 && (
              <div className="text-left">
                <h2 className="font-bold">{t("import.warningsTitle")}</h2>
                <ul className="text-sm text-ink-soft">
                  {result.warnings.map((w) => (
                    <li key={`${w.line}-${w.reason}`}>{describeReason(w)}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.skipped.length > 0 && (
              <div className="text-left">
                <h2 className="font-bold text-blush-dark">{t("import.skippedTitle")}</h2>
                <ul className="text-sm text-ink-soft">
                  {result.skipped.map((s) => (
                    <li key={`${s.line}-${s.reason}`}>{describeReason(s)}</li>
                  ))}
                </ul>
              </div>
            )}
            <Link to="/" className="inline-block">
              <Button>{t("import.openDashboard")}</Button>
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">{t("import.title")}</h1>
          <p className="text-ink-soft">{t("import.subtitle")}</p>
        </div>

        {errorMessage && (
          <p role="alert" className="wobbly bg-blush/20 px-4 py-2 font-semibold text-blush-dark">
            {errorMessage}
          </p>
        )}

        <Card className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="import-file">
                {t("import.pickFile")}
              </label>
              <input
                id="import-file"
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="wobbly-2 w-full border-2 border-ink-soft/60 bg-cream px-3 py-2"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="import-wallet">
                {t("import.targetWallet")}
              </label>
              <select
                id="import-wallet"
                className={`${selectClass} w-full`}
                value={targetWalletId}
                onChange={(e) => setTargetWalletId(e.target.value)}
              >
                <option value="">—</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={() => void loadPreview()} disabled={busy || !targetWalletId}>
            {t("import.loadPreview")}
          </Button>
        </Card>

        {preview && (
          <>
            <Card className="space-y-1 overflow-x-auto">
              <h2 className="text-lg font-bold">
                {t("import.sampleTitle")} · {t("import.rows", { count: preview.rowCount })}
              </h2>
              <table className="w-full min-w-160 text-left text-xs">
                <thead>
                  <tr>
                    {preview.headers.map((header) => (
                      <th key={header} className="border-ink/15 border-b px-2 py-1">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row, rowIndex) => (
                    <tr key={row.join("|") || String(rowIndex)}>
                      {row.map((cellValue, cellIndex) => (
                        <td
                          key={`${preview.headers[cellIndex]}-${cellValue}`}
                          className="max-w-40 truncate px-2 py-1 text-ink-soft"
                        >
                          {cellValue}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card className="space-y-4">
              <h2 className="text-lg font-bold">{t("import.mappingTitle")}</h2>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  ["date", "quantity", "unitPrice", "feeQuantity", "feeCurrency", "note"] as const
                ).map((field) => (
                  <div key={field}>
                    <span className={labelClass}>{t(`import.fields.${field}`)}</span>
                    <ColumnSelect field={field} />
                  </div>
                ))}
                <div>
                  <span className={labelClass}>{t("import.fields.priceCurrency")}</span>
                  <ColumnSelect field="priceCurrency" />
                  {columns.priceCurrency === undefined && (
                    <select
                      className={`${selectClass} mt-2 w-full`}
                      value={fixedCurrency}
                      aria-label={t("import.fixedValue")}
                      onChange={(e) => setFixedCurrency(e.target.value)}
                    >
                      <option value="">{t("import.fixedValue")}</option>
                      {SUPPORTED_CURRENCIES.map((code) => (
                        <option key={code} value={code}>
                          {code.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <span className={labelClass}>{t("import.fields.asset")}</span>
                  <select
                    className={`${selectClass} mb-2 w-full`}
                    value={assetMode}
                    aria-label={t("import.fields.asset")}
                    onChange={(e) => setAssetMode(e.target.value as "fixed" | "column")}
                  >
                    <option value="fixed">{t("import.fixedAsset")}</option>
                    <option value="column">{t("import.assetColumn")}</option>
                  </select>
                  {assetMode === "fixed" ? (
                    <AssetPicker
                      value={fixedAsset}
                      onChange={setFixedAsset}
                      placeholder={t("transactions.form.assetPlaceholder")}
                    />
                  ) : (
                    <ColumnSelect field="asset" />
                  )}
                </div>
                <div>
                  <span className={labelClass}>{t("import.fields.type")}</span>
                  <ColumnSelect field="type" />
                </div>
              </div>

              {columns.type !== undefined && preview.typeValues.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-bold">{t("import.typeMappingTitle")}</h3>
                  <p className="text-sm text-ink-soft">{t("import.typeMappingHint")}</p>
                  {preview.typeValues.map((value) => {
                    const current = typeActions[value] ?? { action: "skip" as TypeAction };
                    return (
                      <div key={value} className="flex flex-wrap items-center gap-2">
                        <span className="wobbly bg-cream-dark px-3 py-1 font-semibold">
                          {value}
                        </span>
                        <select
                          className={selectClass}
                          value={current.action}
                          aria-label={value}
                          onChange={(e) =>
                            setTypeActions((prev) => ({
                              ...prev,
                              [value]: {
                                action: e.target.value as TypeAction,
                                toWalletId:
                                  e.target.value === "transfer"
                                    ? wallets.find((w) => w.id !== targetWalletId)?.id
                                    : undefined,
                              },
                            }))
                          }
                        >
                          {(["buy", "sell", "reward", "transfer", "skip"] as const).map(
                            (action) => (
                              <option key={action} value={action}>
                                {t(`import.actions.${action}`)}
                              </option>
                            ),
                          )}
                        </select>
                        {current.action === "transfer" && (
                          <select
                            className={selectClass}
                            value={current.toWalletId ?? ""}
                            aria-label={t("transactions.form.toWallet")}
                            onChange={(e) =>
                              setTypeActions((prev) => ({
                                ...prev,
                                [value]: { action: "transfer", toWalletId: e.target.value },
                              }))
                            }
                          >
                            {wallets
                              .filter((w) => w.id !== targetWalletId)
                              .map((wallet) => (
                                <option key={wallet.id} value={wallet.id}>
                                  {wallet.name}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <Button
                onClick={() => void runImport()}
                disabled={
                  busy ||
                  columns.date === undefined ||
                  columns.quantity === undefined ||
                  (assetMode === "fixed" ? !fixedAsset : columns.asset === undefined)
                }
              >
                {t("import.runImport", { count: preview.rowCount })}
              </Button>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
