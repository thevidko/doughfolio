import { ServiceError } from "./errors.ts";

/**
 * Minimal polite CoinGecko client (portfolio-analytics spec): sequential
 * requests with a spacing floor, one backoff retry on 429, optional demo API
 * key from the environment. Injectable `fetchImpl` keeps tests offline.
 */

const BASE_URL = "https://api.coingecko.com/api/v3";
const MIN_SPACING_MS = 2_100;
const RETRY_BACKOFF_MS = 5_000;

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

let lastRequestAt = 0;

export async function coingeckoFetch<T>(path: string, fetchImpl: Fetcher = fetch): Promise<T> {
  const wait = lastRequestAt + MIN_SPACING_MS - Date.now();
  if (wait > 0) await Bun.sleep(wait);
  lastRequestAt = Date.now();

  const key = process.env.COINGECKO_API_KEY?.trim();
  const headers = key ? { "x-cg-demo-api-key": key } : undefined;

  let res = await fetchImpl(`${BASE_URL}${path}`, { headers });
  if (res.status === 429) {
    await Bun.sleep(RETRY_BACKOFF_MS);
    lastRequestAt = Date.now();
    res = await fetchImpl(`${BASE_URL}${path}`, { headers });
  }
  if (!res.ok) {
    throw new ServiceError(502, "price_api_error", "errors.priceApi");
  }
  return (await res.json()) as T;
}
