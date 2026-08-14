import Decimal from "decimal.js";

/**
 * Shared money module (PLANNING #9): amounts and prices travel as decimal
 * strings; all arithmetic happens through decimal.js. Plain `number` is
 * allowed only at the chart-rendering edge.
 */

// Crypto quantities go to 18 decimals; give headroom for divisions.
Decimal.set({ precision: 40 });

export { Decimal };

/** Strict decimal-string check: digits with an optional fraction part. */
export function isDecimalString(value: string): boolean {
  return /^\d{1,20}(\.\d{1,20})?$/.test(value);
}

export function isPositiveDecimalString(value: string): boolean {
  return isDecimalString(value) && !new Decimal(value).isZero();
}

/** Normalize UI input: trims, accepts a decimal comma (Czech keyboards). */
export function normalizeDecimalInput(raw: string): string {
  return raw.trim().replace(",", ".");
}

export function addStr(a: string, b: string): string {
  return new Decimal(a).plus(b).toString();
}

export function subStr(a: string, b: string): string {
  return new Decimal(a).minus(b).toString();
}

export function isNegative(value: string): boolean {
  return new Decimal(value).isNegative();
}

/** Multiply quantity × unit price — used for displayed transaction totals. */
export function mulStr(a: string, b: string): string {
  return new Decimal(a).times(b).toString();
}

/**
 * Format an amount for display in the given currency and locale.
 * Fiat codes use the platform's currency formatting; crypto units (btc, sats…)
 * fall back to a plain number + upper-cased code suffix.
 */
export function formatCurrency(amount: string | number, currency: string, locale: string): string {
  const value = typeof amount === "number" ? amount : Number(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(value)} ${currency.toUpperCase()}`;
  }
}

/** Format a raw asset quantity (up to 8 visible decimals, no currency). */
export function formatQuantity(amount: string, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(Number(amount));
}
