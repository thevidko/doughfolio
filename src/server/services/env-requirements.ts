/**
 * Reusable env-requirements mechanism (setup-wizard spec).
 *
 * Features that depend on self-hoster-provided configuration register their
 * required environment variables here. Any client form can then ask
 * `GET /api/env-status?feature=…` and block with a friendly message naming
 * the exact missing variable until the self-hoster provides it (env changes
 * require an instance restart).
 */

export type EnvRegistry = Readonly<Record<string, readonly string[]>>;

/**
 * Feature → required env variables. Currently empty: the MVP needs no keys
 * (CoinGecko's free tier is keyless). Future examples:
 *   "watch-only-eth": ["ETHERSCAN_API_KEY"]
 */
export const ENV_REGISTRY: EnvRegistry = {};

/**
 * Names of required variables that are missing/empty for `feature`.
 * Returns null when the feature is not registered.
 */
export function missingEnvVars(
  feature: string,
  registry: EnvRegistry = ENV_REGISTRY,
  env: Record<string, string | undefined> = process.env,
): string[] | null {
  const required = registry[feature];
  if (!required) return null;
  return required.filter((name) => !env[name]?.trim());
}
