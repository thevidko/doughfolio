import { isSupportedCurrency } from "@shared/currencies.ts";
import { SUPPORTED_LANGUAGES } from "@shared/schemas/setup.ts";
import { z } from "zod";

/** `PATCH /api/settings` — every field optional, only provided ones change. */
export const patchSettingsSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
  baseCurrency: z.string().toLowerCase().refine(isSupportedCurrency).optional(),
  costBasisMethod: z.enum(["average", "fifo"]).optional(),
  stakingRewardCostBasis: z.enum(["market", "zero"]).optional(),
});

export type PatchSettingsRequest = z.infer<typeof patchSettingsSchema>;
