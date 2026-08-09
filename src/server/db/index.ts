import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import pkg from "../../../package.json";
import * as schema from "./schema.ts";

const MIGRATIONS_FOLDER = join(import.meta.dir, "migrations");
const DB_FILENAME = "doughfolio.sqlite";

export type Db = ReturnType<typeof openDatabase>;

/** A database handle or an open transaction — services accept either. */
export type DbConn = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Open (or create) the SQLite database in `dataDir` and bring it up to date.
 *
 * Migrations apply automatically on startup (PLANNING #14). When the database
 * already exists and at least one migration is pending — i.e. an upgrade —
 * the file is first copied to `<dataDir>/backups/` so a failed upgrade can be
 * rolled back by restoring the copy and running the previous image.
 */
export function openDatabase(dataDir: string) {
  mkdirSync(dataDir, { recursive: true });
  const dbPath = join(dataDir, DB_FILENAME);

  if (countPendingMigrations(dbPath) > 0) {
    backupBeforeUpgrade(dataDir, dbPath);
  }

  const sqlite = new Database(dbPath);
  sqlite.run("PRAGMA journal_mode = WAL;");
  sqlite.run("PRAGMA foreign_keys = ON;");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

/**
 * Number of migrations shipped with this build that an *existing* database
 * has not applied yet. Returns 0 for fresh installs (nothing to back up).
 */
function countPendingMigrations(dbPath: string): number {
  if (!existsSync(dbPath)) return 0;

  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"),
  ) as { entries: unknown[] };

  const sqlite = new Database(dbPath, { readonly: true });
  try {
    const row = sqlite.query("SELECT count(*) AS applied FROM __drizzle_migrations").get() as {
      applied: number;
    } | null;
    return Math.max(0, journal.entries.length - (row?.applied ?? 0));
  } catch {
    // Migrations table missing — pre-migration database, treat all as pending.
    return journal.entries.length;
  } finally {
    sqlite.close();
  }
}

function backupBeforeUpgrade(dataDir: string, dbPath: string): void {
  const backupsDir = join(dataDir, "backups");
  mkdirSync(backupsDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  const backupPath = join(backupsDir, `doughfolio-${pkg.version}-${date}.sqlite`);

  // Plain file copy is safe here: nothing else has the database open yet.
  writeFileSync(backupPath, readFileSync(dbPath));
  console.info(`🥟 Pre-upgrade backup written to ${backupPath}`);
}
