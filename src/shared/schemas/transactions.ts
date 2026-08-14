import { isSupportedCurrency } from "@shared/currencies.ts";
import { isPositiveDecimalString } from "@shared/money.ts";
import { z } from "zod";

/** Request bodies of the transactions API (manual-transactions spec). */

const decimalString = z
  .string()
  .trim()
  .refine(isPositiveDecimalString, { message: "Invalid decimal amount" });

const isoDate = z.iso.datetime({ offset: true }).or(z.iso.datetime());
const assetId = z.string().trim().min(1).max(100);
const note = z.string().trim().max(500).optional();

const fee = z.object({ quantity: decimalString, assetId }).optional();

const priced = {
  walletId: z.string(),
  assetId,
  quantity: decimalString,
  unitPrice: decimalString,
  priceCurrency: z.string().toLowerCase().refine(isSupportedCurrency),
  fee,
  occurredAt: isoDate,
  note,
};

/** Discriminated create payload — a transfer creates two linked rows. */
export const createTransactionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("buy"), ...priced }),
  z.object({ type: z.literal("sell"), ...priced }),
  z.object({
    type: z.literal("transfer"),
    fromWalletId: z.string(),
    toWalletId: z.string(),
    assetId,
    quantity: decimalString,
    fee,
    occurredAt: isoDate,
    note,
  }),
  z.object({
    type: z.literal("reward"),
    walletId: z.string(),
    assetId,
    quantity: decimalString,
    fee,
    occurredAt: isoDate,
    note,
  }),
]);

export type CreateTransactionRequest = z.infer<typeof createTransactionSchema>;

/**
 * Patch payload — the type itself is immutable (delete + recreate instead).
 * For transfers, wallet fields map to the out/in rows respectively.
 */
export const patchTransactionSchema = z.object({
  walletId: z.string().optional(),
  fromWalletId: z.string().optional(),
  toWalletId: z.string().optional(),
  assetId: assetId.optional(),
  quantity: decimalString.optional(),
  unitPrice: decimalString.optional(),
  priceCurrency: z.string().toLowerCase().refine(isSupportedCurrency).optional(),
  fee: z.object({ quantity: decimalString, assetId }).nullable().optional(),
  occurredAt: isoDate.optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export type PatchTransactionRequest = z.infer<typeof patchTransactionSchema>;
