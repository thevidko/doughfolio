import { describe, expect, it } from "bun:test";
import { healthRoute } from "./health.ts";

describe("GET /api/health", () => {
  it("responds with HTTP 200", () => {
    expect(healthRoute().status).toBe(200);
  });

  it("returns a valid health payload", async () => {
    const body = await healthRoute().json();

    expect(body.status).toBe("ok");
    expect(body.name).toBe("doughfolio");
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    // Timestamp must round-trip through Date parsing (i.e. be valid ISO 8601).
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});
