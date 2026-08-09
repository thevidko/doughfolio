/**
 * Human-readable currency name via the browser's Intl data, in the active UI
 * language. Returns null for codes Intl cannot name (crypto units like
 * `sats`) — callers then show just the uppercased code.
 */
export function currencyLabel(code: string, locale: string): string | null {
  try {
    const name = new Intl.DisplayNames([locale], { type: "currency" }).of(code.toUpperCase());
    // Intl echoes the code back when it has no name for it — treat as unknown.
    return name && name.toUpperCase() !== code.toUpperCase() ? name : null;
  } catch {
    return null;
  }
}
