/**
 * Supported base/display currencies.
 *
 * Snapshot of CoinGecko's `/simple/supported_vs_currencies` list — the full
 * set the price API can quote against, so no region is locked out (setup
 * wizard decision). Kept static so a fresh instance can complete setup fully
 * offline; a server-side refresh from the live endpoint arrives with the
 * multi-currency-display feature.
 */
export const SUPPORTED_CURRENCIES = [
  // Crypto units
  "btc",
  "eth",
  "ltc",
  "bch",
  "bnb",
  "eos",
  "xrp",
  "xlm",
  "link",
  "dot",
  "yfi",
  "sats",
  "bits",
  // Fiat
  "usd",
  "aed",
  "ars",
  "aud",
  "bdt",
  "bhd",
  "bmd",
  "brl",
  "cad",
  "chf",
  "clp",
  "cny",
  "czk",
  "dkk",
  "eur",
  "gbp",
  "gel",
  "hkd",
  "huf",
  "idr",
  "ils",
  "inr",
  "jpy",
  "krw",
  "kwd",
  "lkr",
  "mmk",
  "mxn",
  "myr",
  "ngn",
  "nok",
  "nzd",
  "php",
  "pkr",
  "pln",
  "rub",
  "sar",
  "sek",
  "sgd",
  "thb",
  "try",
  "twd",
  "uah",
  "vnd",
  "zar",
  // Commodities & special drawing rights
  "xdr",
  "xag",
  "xau",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}
