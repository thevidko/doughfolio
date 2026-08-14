import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/index.ts";
import { assets } from "../db/schema.ts";
import { getBalances } from "./balances.ts";
import { commitImport, previewImport } from "./import.ts";
import { completeSetup } from "./setup.ts";
import { listWalletTransactions } from "./transactions.ts";
import { listWallets } from "./wallets.ts";

/** Structure-faithful copy of the owner's real tracker export. */
const REAL_STYLE_CSV = [
  "ID,Type,BTC Amount,Price per BTC,Currency,Total Amount,Fees,Fees Currency,Transaction Date,Notes,Transfer Type,Destination Address,Created At,Updated At",
  "18,TRANSFER,0.01349833,0,USD,0,0.00001,BTC,2026-08-14,,TO_COLD_WALLET,,2026-08-14T10:59:33.864Z,2026-08-14T10:59:33.864Z",
  "17,BUY,0.0007316,1366867.141,CZK,1000.0000003556,0,CZK,2026-08-13,,,,2026-08-13T07:58:15.522Z,2026-08-13T07:58:15.522Z",
  "16,BUY,0.00144985,1379453.047,CZK,2000.00000019295,0,CZK,2026-07-11,poznámka,,,2026-07-11T10:35:22.310Z,2026-07-11T10:35:22.310Z",
  "bad,BUY,not-a-number,1,CZK,0,0,CZK,2026-07-01,,,,x,x",
].join("\n");

async function instance() {
  const db = openDatabase(mkdtempSync(join(tmpdir(), "doughfolio-test-")));
  await completeSetup(db, {
    language: "cs",
    baseCurrency: "czk",
    wallets: [{ name: "Burza" }, { name: "Ledger" }],
  });
  // Offline-friendly: seed the asset catalog instead of fetching it.
  const fresh = new Date().toISOString();
  db.insert(assets)
    .values([
      { id: "bitcoin", symbol: "btc", name: "Bitcoin", marketCapRank: 1, refreshedAt: fresh },
      { id: "batcat", symbol: "btc", name: "batcat", marketCapRank: null, refreshedAt: fresh },
    ])
    .run();
  const [burza, ledger] = listWallets(db);
  if (!burza || !ledger) throw new Error("wallets missing");
  return { db, burza, ledger };
}

describe("previewImport", () => {
  it("guesses the mapping for the owner's export without manual fixes", () => {
    const preview = previewImport(REAL_STYLE_CSV);
    expect(preview.rowCount).toBe(4);
    expect(preview.headers[preview.guess.date ?? -1]).toBe("Transaction Date");
    expect(preview.headers[preview.guess.quantity ?? -1]).toBe("BTC Amount");
    expect(preview.headers[preview.guess.unitPrice ?? -1]).toBe("Price per BTC");
    expect(preview.headers[preview.guess.priceCurrency ?? -1]).toBe("Currency");
    expect(preview.headers[preview.guess.feeQuantity ?? -1]).toBe("Fees");
    expect(preview.headers[preview.guess.feeCurrency ?? -1]).toBe("Fees Currency");
    expect(preview.headers[preview.guess.type ?? -1]).toBe("Type");
    expect(preview.typeValues.sort()).toEqual(["BUY", "TRANSFER"]);
  });
});

describe("commitImport", () => {
  it("imports the owner's export: buys, transfer pair with BTC fee, dates", async () => {
    const { db, burza, ledger } = await instance();
    const result = await commitImport(db, REAL_STYLE_CSV, {
      targetWalletId: burza.id,
      asset: { fixed: "bitcoin" },
      date: { column: 8 },
      quantity: { column: 2 },
      unitPrice: { column: 3 },
      priceCurrency: { column: 4 },
      feeQuantity: { column: 6 },
      feeCurrency: { column: 7 },
      note: { column: 9 },
      type: {
        column: 1,
        values: {
          BUY: { action: "buy" },
          TRANSFER: { action: "transfer", toWalletId: ledger.id },
        },
      },
    });

    expect(result.imported).toBe(3);
    expect(result.skipped).toEqual([{ line: 5, reason: "invalid_quantity" }]);
    expect(result.warnings).toEqual([]);

    const burzaTxs = listWalletTransactions(db, burza.id);
    expect(burzaTxs).toHaveLength(3); // 2 buys + transfer_out
    expect(burzaTxs[0]?.occurredAt).toBe("2026-07-11T12:00:00.000Z");
    expect(burzaTxs[0]?.note).toBe("poznámka");
    expect(burzaTxs[0]?.priceCurrency).toBe("czk");

    const ledgerTxs = listWalletTransactions(db, ledger.id);
    expect(ledgerTxs).toHaveLength(1);
    expect(ledgerTxs[0]?.type).toBe("transfer_in");
    expect(ledgerTxs[0]?.quantity).toBe("0.01349833");

    // Transfer fee 0.00001 BTC left the source wallet.
    const balances = getBalances(db);
    expect(balances.wallets[ledger.id]?.bitcoin).toBe("0.01349833");
  });

  it("drops non-zero fiat fees with a warning but imports the row", async () => {
    const { db, burza } = await instance();
    const csv = "Type,Amount,Price,Curr,Fee,FeeCurr,Date\nBUY,1,100,CZK,5,CZK,2026-01-01\n";
    const result = await commitImport(db, csv, {
      targetWalletId: burza.id,
      asset: { fixed: "bitcoin" },
      date: { column: 6 },
      quantity: { column: 1 },
      unitPrice: { column: 2 },
      priceCurrency: { column: 3 },
      feeQuantity: { column: 4 },
      feeCurrency: { column: 5 },
      type: { column: 0, values: { BUY: { action: "buy" } } },
    });
    expect(result.imported).toBe(1);
    expect(result.warnings).toEqual([{ line: 2, reason: "fee_dropped:CZK" }]);
  });

  it("export → import round-trip reproduces balances", async () => {
    const { db, burza, ledger } = await instance();
    await commitImport(db, REAL_STYLE_CSV, {
      targetWalletId: burza.id,
      asset: { fixed: "bitcoin" },
      date: { column: 8 },
      quantity: { column: 2 },
      unitPrice: { column: 3 },
      priceCurrency: { column: 4 },
      feeQuantity: { column: 6 },
      feeCurrency: { column: 7 },
      type: {
        column: 1,
        values: {
          BUY: { action: "buy" },
          TRANSFER: { action: "transfer", toWalletId: ledger.id },
        },
      },
    });
    const before = getBalances(db).totals;

    // Re-import our own export into a fresh instance (transfers as skip —
    // they'd need wallet mapping; buys only round-trip here).
    const { serializeCsv } = await import("@shared/csv.ts");
    const { listAllTransactions } = await import("./transactions.ts");
    const rows = listAllTransactions(db)
      .filter((t) => t.type === "buy")
      .map((t) => [
        t.type,
        t.assetId,
        t.quantity,
        t.unitPrice ?? "",
        t.priceCurrency ?? "",
        t.occurredAt,
      ]);
    const exported = serializeCsv(
      ["type", "asset", "quantity", "unit_price", "price_currency", "occurred_at"],
      rows,
    );

    const fresh = await instance();
    const result = await commitImport(fresh.db, exported, {
      targetWalletId: fresh.burza.id,
      asset: { fixed: "bitcoin" },
      date: { column: 5 },
      quantity: { column: 2 },
      unitPrice: { column: 3 },
      priceCurrency: { column: 4 },
      type: { column: 0, values: { BUY: { action: "buy" } } },
    });
    expect(result.imported).toBe(2);
    const after = getBalances(fresh.db).totals;
    // Buys only (the transfer stays within the portfolio, fee excluded).
    expect(after.bitcoin).toBe("0.00218145");
    expect(before.bitcoin).toBe("0.00217145");
  });
});
