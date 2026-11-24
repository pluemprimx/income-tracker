import { neon } from "@neondatabase/serverless";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS notifications (
     id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     raw_text      TEXT        NOT NULL,
     text_hash     TEXT        NOT NULL,
     source        TEXT,
     bank          TEXT,
     direction     TEXT        NOT NULL CHECK (direction IN ('in', 'out', 'unknown')),
     amount_satang BIGINT      CHECK (amount_satang > 0),
     status        TEXT        NOT NULL CHECK (status IN ('income', 'ignored', 'unparsed')),
     received_at   TIMESTAMPTZ NOT NULL,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_status_received
     ON notifications (status, received_at)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_hash_received
     ON notifications (text_hash, received_at)`,
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);
  for (const statement of STATEMENTS) await sql.query(statement);
  console.log(`[migrate] applied ${STATEMENTS.length} statements`);
}

main().catch((error: unknown) => {
  console.error("[migrate] failed:", error);
  process.exit(1);
});
