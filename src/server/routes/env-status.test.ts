import { describe, expect, it } from "bun:test";
import { missingEnvVars } from "../services/env-requirements.ts";
import { createEnvStatusRoute } from "./env-status.ts";

const FAKE_REGISTRY = { "watch-only-eth": ["ETHERSCAN_API_KEY", "OTHER_KEY"] } as const;

describe("missingEnvVars", () => {
  it("lists missing and empty variables by name", () => {
    expect(missingEnvVars("watch-only-eth", FAKE_REGISTRY, { OTHER_KEY: "  " })).toEqual([
      "ETHERSCAN_API_KEY",
      "OTHER_KEY",
    ]);
  });

  it("returns an empty list when everything is provided", () => {
    expect(
      missingEnvVars("watch-only-eth", FAKE_REGISTRY, {
        ETHERSCAN_API_KEY: "abc",
        OTHER_KEY: "def",
      }),
    ).toEqual([]);
  });

  it("returns null for unregistered features", () => {
    expect(missingEnvVars("nonsense", FAKE_REGISTRY, {})).toBeNull();
  });
});

describe("GET /api/env-status", () => {
  const route = createEnvStatusRoute(FAKE_REGISTRY);

  it("reports missing variables for a known feature", async () => {
    const res = route(new Request("http://localhost/api/env-status?feature=watch-only-eth"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.feature).toBe("watch-only-eth");
    expect(body.missing).toContain("ETHERSCAN_API_KEY");
  });

  it("404s on unknown features and 400s without the feature param", async () => {
    expect(route(new Request("http://localhost/api/env-status?feature=nope")).status).toBe(404);
    expect(route(new Request("http://localhost/api/env-status")).status).toBe(400);
  });
});
