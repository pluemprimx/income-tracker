import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS notifications (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_text      TEXT    NOT NULL,
    text_hash     TEXT    NOT NULL,
    source        TEXT,
    bank          TEXT,
    direction     TEXT    NOT NULL CHECK (direction IN ('in', 'out', 'unknown')),
    amount_satang INTEGER,
    status        TEXT    NOT NULL CHECK (status IN ('income', 'ignored', 'unparsed')),
    received_at   INTEGER NOT NULL,
    created_at    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_status_received
    ON notifications (status, received_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_hash_received
    ON notifications (text_hash, received_at);
`;

const globalForDb = globalThis as unknown as { incomeDb?: DatabaseSync };

function openDatabase(): DatabaseSync {
  const dbPath = path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? "./data/income.db");
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  return db;
}

/** Single shared connection (survives Next.js dev hot reloads). */
export function getDb(): DatabaseSync {
  globalForDb.incomeDb ??= openDatabase();
  return globalForDb.incomeDb;
}
