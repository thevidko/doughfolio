import { isSupportedCurrency } from "@shared/currencies.ts";
import { z } from "zod";

/** Languages the UI ships catalogs for. Extend here when adding a language. */
export const SUPPORTED_LANGUAGES = ["en", "cs"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Request body of `POST /api/setup/complete` — validated on the server. */
export const setupCompleteSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  displayName: z.string().trim().min(1).max(50).optional(),
  password: z.string().min(8).max(128).optional(),
  baseCurrency: z
    .string()
    .toLowerCase()
    .refine(isSupportedCurrency, { message: "Unsupported currency" }),
  wallets: z
    .array(z.object({ name: z.string().trim().min(1).max(50) }))
    .max(20)
    .default([]),
});

export type SetupCompleteRequest = z.infer<typeof setupCompleteSchema>;

/** Request body of `POST /api/session` (login). */
export const loginSchema = z.object({
  password: z.string().min(1).max(128),
});
