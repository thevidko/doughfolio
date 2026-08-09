import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/index.ts";
import { completeSetup } from "../services/setup.ts";
import { createSessionRoutes } from "./session.ts";

async function protectedInstance() {
  const db = openDatabase(mkdtempSync(join(tmpdir(), "doughfolio-test-")));
  await completeSetup(db, {
    language: "en",
    displayName: "Vidko",
    password: "steamed-buns",
    baseCurrency: "usd",
    wallets: [],
  });
  return createSessionRoutes(db);
}

function loginRequest(password: string): Request {
  return new Request("http://localhost/api/session", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

describe("/api/session", () => {
  it("logs in with the correct password and returns a session cookie", async () => {
    const routes = await protectedInstance();
    const res = await routes.login(loginRequest("steamed-buns"));

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("df_session=");
    const body = await res.json();
    expect(body).toEqual({ authenticated: true, displayName: "Vidko" });
  });

  it("rejects a wrong password", async () => {
    const routes = await protectedInstance();
    const res = await routes.login(loginRequest("wrong"));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.messageKey).toBe("errors.invalidPassword");
  });

  it("logout destroys the session", async () => {
    const routes = await protectedInstance();
    const cookie = (await routes.login(loginRequest("steamed-buns"))).headers.get("set-cookie");
    const withCookie = (method: string) =>
      new Request("http://localhost/api/session", {
        method,
        headers: { cookie: cookie ?? "" },
      });

    expect((await routes.get(withCookie("GET")).json()).authenticated).toBe(true);
    await routes.logout(withCookie("DELETE"));
    expect((await routes.get(withCookie("GET")).json()).authenticated).toBe(false);
  });
});
