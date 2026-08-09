import type { SupportedLanguage } from "@shared/schemas/setup.ts";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import cs from "./cs.json";
import en from "./en.json";

/** Best-effort guess from browser preferences; the stored setting wins later. */
export function detectLanguage(): SupportedLanguage {
  const preferences = navigator.languages ?? [navigator.language];
  return preferences.some((lang) => lang?.toLowerCase().startsWith("cs")) ? "cs" : "en";
}

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    cs: { translation: cs },
  },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: {
    // React already escapes rendered strings.
    escapeValue: false,
  },
});

export { i18next };

/**
 * Translate a message key received from the server (error envelopes). Server
 * keys are strings by nature, so this is the one sanctioned escape hatch from
 * the typed-key API; unknown keys fall back to the generic network error.
 */
export function translateServerKey(key: string): string {
  // Safe: i18next handles unknown keys at runtime; `exists` guards the fallback.
  const t = i18next.t as (k: string, opts?: Record<string, unknown>) => string;
  return i18next.exists(key) ? t(key) : t("errors.network");
}
