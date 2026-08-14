import type { ImportCommitResponse, ImportPreviewResponse } from "@shared/api.ts";
import { parseCsv } from "@shared/csv.ts";
import { isSupportedCurrency } from "@shared/currencies.ts";
import { isPositiveDecimalString } from "@shared/money.ts";
import type { ImportMapping } from "@shared/schemas/import.ts";
import { eq } from "drizzle-orm";
import type { DbConn } from "../db/index.ts";
import { assets } from "../db/schema.ts";
import type { Fetcher } from "../lib/coingecko.ts";
import { ensureAssetCatalog } from "./assets.ts";
import { createTransaction } from "./transactions.ts";

/**
 * CSV import (csv-import-export spec): header-based mapping with per-value
 * type actions. Bad rows are skipped and reported — one broken line never
 * aborts the rest of the file.
 */

/** Header-name synonyms for the mapping guess (EN + CS trackers). */
const HEADER_HINTS: Record<keyof ImportPreviewResponse["guess"], string[]> = {
  date: ["transaction date", "date", "datum", "time", "when"],
  quantity: ["amount", "quantity", "množství", "qty", "objem"],
  unitPrice: ["price per", "unit price", "price", "cena", "kurz", "rate"],
  priceCurrency: ["currency", "měna"],
  feeQuantity: ["fee", "fees", "poplatek", "poplatky"],
  feeCurrency: ["fee currency", "fees currency", "měna poplatku"],
  note: ["note", "notes", "poznámka", "comment"],
  type: ["type", "typ", "side", "direction"],
  asset: ["asset", "coin", "symbol", "ticker", "krypto"],
};

function guessColumns(headers: string[]): ImportPreviewResponse["guess"] {
  const lower = headers.map((h) => h.toLowerCase());
  const used = new Set<number>();
  const guess: ImportPreviewResponse["guess"] = {};

  // Two-pass matching so specific fields (fee currency) win over broad ones
  // (currency); within a field the synonym list is ordered by specificity.
  const fields: (keyof typeof HEADER_HINTS)[] = [
    "feeCurrency",
    "feeQuantity",
    "date",
    "type",
    "unitPrice",
    "quantity",
    "priceCurrency",
    "note",
    "asset",
  ];
  for (const field of fields) {
    for (const hint of HEADER_HINTS[field]) {
      const index = lower.findIndex(
        (h, i) =>
          !used.has(i) && h.includes(hint) && (field !== "quantity" || !h.includes("total")),
      );
      if (index >= 0) {
        guess[field] = index;
        used.add(index);
        break;
      }
    }
  }
  return guess;
}

export function previewImport(csv: string): ImportPreviewResponse {
  const table = parseCsv(csv);
  const guess = guessColumns(table.headers);

  const typeValues =
    guess.type === undefined
      ? []
      : [
          ...new Set(
            table.rows
              .map((row) => (row[guess.type as number] ?? "").trim().toUpperCase())
              .filter(Boolean),
          ),
        ].slice(0, 20);

  return {
    headers: table.headers,
    rowCount: table.rows.length,
    sample: table.rows.slice(0, 5),
    guess,
    typeValues,
  };
}

/** "1 234,56" → "1234.56"; returns null for empty/invalid values. */
function parseNumber(raw: string | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().replaceAll(" ", "").replaceAll("'", "").replaceAll(" ", "");
  if (!value.includes(".") && value.includes(",")) value = value.replace(",", ".");
  value = value.replaceAll(",", "");
  return isPositiveDecimalString(value) ? value : null;
}

/** Accepts ISO, date-only (→ noon UTC) and DD.MM.YYYY; null when unreadable. */
function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T12:00:00.000Z`;
  const czech = value.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (czech) {
    const [, d, m, y] = czech;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00.000Z`;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function resolveAssetBySymbol(db: DbConn, symbol: string): string | null {
  const rows = db.select().from(assets).where(eq(assets.symbol, symbol.toLowerCase())).all();
  if (rows.length === 0) return null;
  rows.sort((a, b) => (a.marketCapRank ?? 1_000_000) - (b.marketCapRank ?? 1_000_000));
  return rows[0]?.id ?? null;
}

export async function commitImport(
  db: DbConn,
  csv: string,
  mapping: ImportMapping,
  fetchImpl?: Fetcher,
): Promise<ImportCommitResponse> {
  // Symbol → asset resolution (asset column, fee currencies) needs the
  // catalog; a fresh instance may not have fetched it yet.
  if (mapping.asset.fixed === undefined || mapping.feeCurrency !== undefined) {
    try {
      await ensureAssetCatalog(db, fetchImpl);
    } catch {
      console.warn("Asset catalog unavailable during import — symbol lookups may fail");
    }
  }
  const table = parseCsv(csv);
  const skipped: ImportCommitResponse["skipped"] = [];
  const warnings: ImportCommitResponse["warnings"] = [];
  let imported = 0;

  const cell = (row: string[], index: number | undefined): string =>
    index === undefined ? "" : (row[index] ?? "").trim();
  const fromSource = (
    row: string[],
    source: { column?: number; fixed?: string } | undefined,
  ): string => (source?.fixed !== undefined ? source.fixed : cell(row, source?.column));

  db.transaction((tx) => {
    for (const [rowIndex, row] of table.rows.entries()) {
      const line = rowIndex + 2; // 1-based + header line
      const skip = (reason: string) => {
        skipped.push({ line, reason });
      };

      // Type action.
      let action: { action: string; toWalletId?: string };
      if (mapping.type.fixed) {
        action = { action: mapping.type.fixed };
      } else {
        const value = cell(row, mapping.type.column).toUpperCase();
        const mapped = mapping.type.values?.[value];
        if (!mapped) {
          skip(`unknown_type:${value || "?"}`);
          continue;
        }
        action = mapped;
      }
      if (action.action === "skip") continue;

      // Asset.
      const assetRaw = fromSource(row, mapping.asset);
      const assetId =
        mapping.asset.fixed !== undefined ? assetRaw : resolveAssetBySymbol(db, assetRaw);
      if (!assetId) {
        skip(`unknown_asset:${assetRaw || "?"}`);
        continue;
      }

      const quantity = parseNumber(cell(row, mapping.quantity.column));
      if (!quantity) {
        skip("invalid_quantity");
        continue;
      }
      const occurredAt = parseDate(cell(row, mapping.date.column));
      if (!occurredAt) {
        skip("invalid_date");
        continue;
      }
      const note = mapping.note ? cell(row, mapping.note.column) || undefined : undefined;

      // Fee — asset-typed only; a non-zero fiat fee is dropped with a warning.
      let fee: { quantity: string; assetId: string } | undefined;
      const feeRaw = mapping.feeQuantity ? cell(row, mapping.feeQuantity.column) : "";
      const feeQuantity = parseNumber(feeRaw);
      if (feeQuantity) {
        const feeCurrencyRaw = fromSource(row, mapping.feeCurrency);
        const feeAssetId = feeCurrencyRaw ? resolveAssetBySymbol(db, feeCurrencyRaw) : null;
        if (feeAssetId) {
          fee = { quantity: feeQuantity, assetId: feeAssetId };
        } else {
          warnings.push({ line, reason: `fee_dropped:${feeCurrencyRaw || "?"}` });
        }
      }

      try {
        if (action.action === "transfer") {
          if (!action.toWalletId) {
            skip("transfer_without_destination");
            continue;
          }
          createTransaction(tx, {
            type: "transfer",
            fromWalletId: mapping.targetWalletId,
            toWalletId: action.toWalletId,
            assetId,
            quantity,
            fee,
            occurredAt,
            note,
          });
        } else if (action.action === "reward") {
          createTransaction(tx, {
            type: "reward",
            walletId: mapping.targetWalletId,
            assetId,
            quantity,
            fee,
            occurredAt,
            note,
          });
        } else {
          const unitPrice = mapping.unitPrice
            ? parseNumber(cell(row, mapping.unitPrice.column))
            : null;
          if (!unitPrice) {
            skip("missing_price");
            continue;
          }
          const currency = fromSource(row, mapping.priceCurrency).toLowerCase();
          if (!isSupportedCurrency(currency)) {
            skip(`unknown_currency:${currency || "?"}`);
            continue;
          }
          createTransaction(tx, {
            type: action.action as "buy" | "sell",
            walletId: mapping.targetWalletId,
            assetId,
            quantity,
            unitPrice,
            priceCurrency: currency,
            fee,
            occurredAt,
            note,
          });
        }
        imported++;
      } catch {
        skip("write_failed");
      }
    }
  });

  return { imported, skipped, warnings };
}
