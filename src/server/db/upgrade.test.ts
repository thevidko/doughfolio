import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { openDatabase } from "./index.ts";

const MIGRATIONS = join(import.meta.dir, "migrations");

/**
 * Fabricate a database exactly as a v0.2.x instance left it: only the first
 * migration applied, with drizzle's bookkeeping row in place.
 */
function fabricateV02Database(dir: string): string {
  const journal = JSON.parse(readFileSync(join(MIGRATIONS, "meta", "_journal.json"), "utf8")) as {
    entries: { tag: string; when: number }[];
  };
  const first = journal.entries[0];
  if (!first) throw new Error("journal is empty");

  const dbPath = join(dir, "doughfolio.sqlite");
  const sqlite = new Database(dbPath);
  const initSql = readFileSync(join(MIGRATIONS, `${first.tag}.sql`), "utf8");
  for (const statement of initSql.split("--> statement-breakpoint")) {
    sqlite.run(statement);
  }
  // Mirror the drizzle migrator's bookkeeping for the applied migration.
  sqlite.run(
    "CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)",
  );
  sqlite.run("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", [
    "fabricated-v0.2",
    first.when,
  ]);
  // A wallet from the pre-groups era (no group_id column exists yet).
  sqlite.run(
    "INSERT INTO users (id, display_name, password_hash, created_at) VALUES ('u1', 'Vidko', NULL, '2026-01-01T00:00:00Z')",
  );
  sqlite.run(
    "INSERT INTO wallets (id, user_id, name, kind, created_at) VALUES ('w1', 'u1', 'Legacy', 'manual', '2026-01-01T00:00:00Z')",
  );
  sqlite.run(
    `INSERT INTO settings (key, value) VALUES ('language', '"cs"'), ('setupCompletedAt', '"2026-01-01T00:00:00Z"')`,
  );
  sqlite.close();
  return dbPath;
}

describe("upgrade from v0.2.x", () => {
  it("backs up the database before applying pending migrations", () => {
    const dir = mkdtempSync(join(tmpdir(), "doughfolio-upgrade-"));
    fabricateV02Database(dir);

    const db = openDatabase(dir);

    // Backup exists and is the pre-upgrade copy (no wallet_groups table inside).
    const backups = readdirSync(join(dir, "backups"));
    expect(backups).toHaveLength(1);
    const backup = new Database(join(dir, "backups", backups[0] ?? ""), { readonly: true });
    const backupTables = backup
      .query("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    expect(backupTables.map((t) => t.name)).not.toContain("wallet_groups");
    backup.close();

    // The live database is fully migrated.
    const tables = db
      .all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .map((r) => r.name);
    expect(tables).toContain("wallet_groups");
    expect(tables).toContain("transactions");
  });

  it("reopening after the upgrade creates no second backup", () => {
    const dir = mkdtempSync(join(tmpdir(), "doughfolio-upgrade-"));
    fabricateV02Database(dir);

    openDatabase(dir);
    openDatabase(dir);

    expect(readdirSync(join(dir, "backups"))).toHaveLength(1);
    expect(existsSync(join(dir, "doughfolio.sqlite"))).toBe(true);
  });
});
