import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { openDatabase } from "./index.ts";

function tempDataDir(): string {
  return mkdtempSync(join(tmpdir(), "doughfolio-test-"));
}

describe("openDatabase", () => {
  it("creates the database and applies all migrations on a fresh install", () => {
    const dir = tempDataDir();
    const db = openDatabase(dir);

    const tables = db
      .all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .map((row) => row.name);

    expect(tables).toContain("users");
    expect(tables).toContain("settings");
    expect(tables).toContain("wallets");
    expect(tables).toContain("sessions");
    expect(existsSync(join(dir, "doughfolio.sqlite"))).toBe(true);
  });

  it("is idempotent — reopening an up-to-date database creates no backup", () => {
    const dir = tempDataDir();
    openDatabase(dir);
    openDatabase(dir);

    expect(existsSync(join(dir, "backups"))).toBe(false);
    expect(readdirSync(dir).filter((f) => f.endsWith(".sqlite"))).toHaveLength(1);
  });
});
