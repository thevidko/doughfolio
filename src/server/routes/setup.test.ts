import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/index.ts";
import { wallets } from "../db/schema.ts";
import { createSetupRoutes } from "./setup.ts";

function freshRoutes() {
  const db = openDatabase(mkdtempSync(join(tmpdir(), "doughfolio-test-")));
  return { db, routes: createSetupRoutes(db) };
}

function completeRequest(body: unknown): Request {
  return new Request("http://localhost/api/setup/complete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const statusRequest = (cookie?: string) =>
  new Request("http://localhost/api/setup/status", {
    headers: cookie ? { cookie } : {},
  });

describe("GET /api/setup/status", () => {
  it("reports an unconfigured instance", async () => {
    const { routes } = freshRoutes();
    const body = await routes.status(statusRequest()).json();

    expect(body).toEqual({
      completed: false,
      passwordRequired: false,
      authenticated: true,
      language: null,
      displayName: null,
      baseCurrency: null,
    });
  });
});

describe("POST /api/setup/complete", () => {
  it("completes with pure defaults (everything skipped)", async () => {
    const { routes } = freshRoutes();
    const res = await routes.complete(completeRequest({ language: "en", baseCurrency: "usd" }));

    expect(res.status).toBe(200);
    const status = await routes.status(statusRequest()).json();
    expect(status.completed).toBe(true);
    expect(status.passwordRequired).toBe(false);
    expect(status.authenticated).toBe(true);
    expect(status.language).toBe("en");
  });

  it("stores language, name, currency and wallets", async () => {
    const { db, routes } = freshRoutes();
    await routes.complete(
      completeRequest({
        language: "cs",
        displayName: "Vidko",
        baseCurrency: "czk",
        wallets: [{ name: "Hodl" }, { name: "Trading" }],
      }),
    );

    const status = await routes.status(statusRequest()).json();
    expect(status.language).toBe("cs");
    expect(status.displayName).toBe("Vidko");

    const rows = db.select().from(wallets).all();
    expect(rows.map((w) => w.name).sort()).toEqual(["Hodl", "Trading"]);
    for (const row of rows) {
      expect(row.kind).toBe("manual");
      expect(row.userId).toBeTruthy();
    }
  });

  it("sets an argon2id password and opens a session for the completing browser", async () => {
    const { routes } = freshRoutes();
    const res = await routes.complete(
      completeRequest({ language: "en", baseCurrency: "usd", password: "steamed-buns" }),
    );

    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("df_session=");
    expect(cookie).toContain("HttpOnly");

    // The completing browser is authenticated…
    const authed = await routes.status(statusRequest(cookie ?? "")).json();
    expect(authed.passwordRequired).toBe(true);
    expect(authed.authenticated).toBe(true);

    // …a second browser without the cookie is not.
    const anonymous = await routes.status(statusRequest()).json();
    expect(anonymous.authenticated).toBe(false);
    expect(anonymous.displayName).toBeNull();
  });

  it("rejects a second run", async () => {
    const { routes } = freshRoutes();
    await routes.complete(completeRequest({ language: "en", baseCurrency: "usd" }));
    const res = await routes.complete(completeRequest({ language: "en", baseCurrency: "usd" }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("setup_already_completed");
  });

  it("rejects invalid input with the error envelope", async () => {
    const { routes } = freshRoutes();
    const res = await routes.complete(
      completeRequest({ language: "de", baseCurrency: "doubloons", password: "short" }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.messageKey).toBe("errors.validation");
    const paths = body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toContain("language");
    expect(paths).toContain("baseCurrency");
    expect(paths).toContain("password");
  });
});
