import { serializeCsv } from "@shared/csv.ts";
import { importCommitSchema, importPreviewSchema } from "@shared/schemas/import.ts";
import type { Db } from "../db/index.ts";
import { protectedRoute } from "../lib/guard.ts";
import { readValidated } from "../lib/http.ts";
import { commitImport, previewImport } from "../services/import.ts";
import { listAllTransactions } from "../services/transactions.ts";
import { listWallets } from "../services/wallets.ts";

/** CSV import wizard endpoints + full transaction export. */
export function createImportExportRoutes(db: Db) {
  return {
    exportCsv: protectedRoute(db, () => {
      const walletNames = new Map(listWallets(db).map((w) => [w.id, w.name]));
      const rows = listAllTransactions(db).map((tx) => [
        walletNames.get(tx.walletId) ?? tx.walletId,
        tx.type,
        tx.assetId,
        tx.quantity,
        tx.unitPrice ?? "",
        tx.priceCurrency ?? "",
        tx.feeQuantity ?? "",
        tx.feeAssetId ?? "",
        tx.occurredAt,
        tx.note ?? "",
      ]);
      const csv = serializeCsv(
        [
          "wallet",
          "type",
          "asset",
          "quantity",
          "unit_price",
          "price_currency",
          "fee_quantity",
          "fee_asset",
          "occurred_at",
          "note",
        ],
        rows,
      );
      const date = new Date().toISOString().slice(0, 10);
      return new Response(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="doughfolio-transactions-${date}.csv"`,
        },
      });
    }),
    preview: protectedRoute(db, async (req) => {
      const { csv } = await readValidated(req, importPreviewSchema);
      return Response.json(previewImport(csv));
    }),
    commit: protectedRoute(db, async (req) => {
      const { csv, mapping } = await readValidated(req, importCommitSchema);
      return Response.json(await commitImport(db, csv, mapping));
    }),
  };
}
