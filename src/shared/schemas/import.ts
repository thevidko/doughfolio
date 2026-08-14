import { z } from "zod";

/**
 * Column mapping for the CSV import wizard (csv-import-export spec).
 * Every field reads either a column (by index) or a fixed value; the type
 * field additionally maps each distinct source value to an action.
 */

const column = z.number().int().min(0);

/** A value source: one CSV column, or one fixed value for every row. */
const source = z
  .object({ column: column.optional(), fixed: z.string().trim().min(1).optional() })
  .refine((s) => s.column !== undefined || s.fixed !== undefined, {
    message: "column or fixed required",
  });

export const typeActionSchema = z.object({
  action: z.enum(["buy", "sell", "reward", "transfer", "skip"]),
  /** Destination wallet — required when action is "transfer". */
  toWalletId: z.string().optional(),
});

export const importMappingSchema = z.object({
  /** Wallet receiving the imported rows (transfer sources). */
  targetWalletId: z.string(),
  /** Coin: fixed CoinGecko id, or a column holding ticker symbols. */
  asset: source,
  date: z.object({ column }),
  quantity: z.object({ column }),
  unitPrice: z.object({ column }).optional(),
  priceCurrency: source.optional(),
  feeQuantity: z.object({ column }).optional(),
  feeCurrency: source.optional(),
  note: z.object({ column }).optional(),
  type: z
    .object({
      fixed: z.enum(["buy", "sell", "reward"]).optional(),
      column: column.optional(),
      /** Distinct source value (uppercased) → action. */
      values: z.record(z.string(), typeActionSchema).optional(),
    })
    .refine((t) => t.fixed !== undefined || t.column !== undefined, {
      message: "fixed or column required",
    }),
});

export type ImportMapping = z.infer<typeof importMappingSchema>;

export const importCommitSchema = z.object({
  csv: z.string().min(1).max(5_000_000),
  mapping: importMappingSchema,
});

export const importPreviewSchema = z.object({
  csv: z.string().min(1).max(5_000_000),
});
