import "server-only";
import { createHash } from "node:crypto";
import { getSql } from "./db";
import { parseNotification, type Direction } from "./parser";

export type NotificationStatus = "income" | "ignored" | "unparsed";

export interface NotificationRecord {
  id: number;
  rawText: string;
  source: string | null;
  bank: string | null;
  direction: Direction;
  amountSatang: number | null;
  status: NotificationStatus;
  receivedAt: number;
}

export interface RecordInput {
  text: string;
  source?: string | null;
  receivedAt?: number;
}

export type RecordResult =
  | { duplicate: true; existingId: number }
  | { duplicate: false; record: NotificationRecord };

export interface IncomeSummary {
  count: number;
  totalSatang: number;
}

export interface IncomeStats {
  today: IncomeSummary;
  month: IncomeSummary;
  allTime: IncomeSummary;
}

/** Same text arriving again within this window is treated as a duplicate forward. */
const DUPLICATE_WINDOW_SECONDS = 10 * 60;
const TIME_ZONE = "Asia/Bangkok";

/** Postgres BIGINT / NUMERIC arrive as strings; timestamps are selected as epoch ms. */
interface NotificationRow {
  id: string | number;
  raw_text: string;
  source: string | null;
  bank: string | null;
  direction: Direction;
  amount_satang: string | number | null;
  status: NotificationStatus;
  received_at_ms: string | number;
}

const RECORD_COLUMNS = `id, raw_text, source, bank, direction, amount_satang, status,
  (extract(epoch FROM received_at) * 1000)::float8 AS received_at_ms`;

function toRecord(row: NotificationRow): NotificationRecord {
  return {
    id: Number(row.id),
    rawText: row.raw_text,
    source: row.source,
    bank: row.bank,
    direction: row.direction,
    amountSatang: row.amount_satang === null ? null : Number(row.amount_satang),
    status: row.status,
    receivedAt: Math.round(Number(row.received_at_ms)),
  };
}

function hashText(text: string): string {
  return createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex");
}

function resolveStatus(direction: Direction, amountSatang: number | null): NotificationStatus {
  if (direction === "in" && amountSatang !== null) return "income";
  if (direction === "out") return "ignored";
  return "unparsed";
}

export async function recordNotification(input: RecordInput): Promise<RecordResult> {
  const sql = getSql();
  const receivedAt = new Date(input.receivedAt ?? Date.now()).toISOString();
  const textHash = hashText(input.text);

  const existing = (await sql.query(
    `SELECT id FROM notifications
     WHERE text_hash = $1 AND abs(extract(epoch FROM (received_at - $2::timestamptz))) < $3
     LIMIT 1`,
    [textHash, receivedAt, DUPLICATE_WINDOW_SECONDS],
  )) as Array<{ id: string | number }>;
  if (existing[0]) return { duplicate: true, existingId: Number(existing[0].id) };

  const parsed = parseNotification(input.text, input.source);
  const status = resolveStatus(parsed.direction, parsed.amountSatang);

  const rows = (await sql.query(
    `INSERT INTO notifications
       (raw_text, text_hash, source, bank, direction, amount_satang, status, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
     RETURNING ${RECORD_COLUMNS}`,
    [input.text, textHash, input.source ?? null, parsed.bank, parsed.direction, parsed.amountSatang, status, receivedAt],
  )) as NotificationRow[];
  const row = rows[0];
  if (!row) throw new Error("Insert returned no row");

  return { duplicate: false, record: toRecord(row) };
}

interface StatsRow {
  today_count: string | number;
  today_total: string | number;
  month_count: string | number;
  month_total: string | number;
  all_count: string | number;
  all_total: string | number;
}

export async function getIncomeStats(): Promise<IncomeStats> {
  const rows = (await getSql().query(
    `WITH bounds AS (
       SELECT date_trunc('day',   now() AT TIME ZONE $1) AT TIME ZONE $1 AS day_start,
              date_trunc('month', now() AT TIME ZONE $1) AT TIME ZONE $1 AS month_start
     )
     SELECT
       count(*) FILTER (WHERE received_at >= day_start)                           AS today_count,
       coalesce(sum(amount_satang) FILTER (WHERE received_at >= day_start), 0)    AS today_total,
       count(*) FILTER (WHERE received_at >= month_start)                         AS month_count,
       coalesce(sum(amount_satang) FILTER (WHERE received_at >= month_start), 0)  AS month_total,
       count(*)                                                                    AS all_count,
       coalesce(sum(amount_satang), 0)                                             AS all_total
     FROM notifications, bounds
     WHERE status = 'income'`,
    [TIME_ZONE],
  )) as StatsRow[];
  const row = rows[0];
  const summary = (count: string | number | undefined, total: string | number | undefined): IncomeSummary => ({
    count: Number(count ?? 0),
    totalSatang: Number(total ?? 0),
  });
  return {
    today: summary(row?.today_count, row?.today_total),
    month: summary(row?.month_count, row?.month_total),
    allTime: summary(row?.all_count, row?.all_total),
  };
}

export async function listNotifications(limit = 50, status?: NotificationStatus): Promise<NotificationRecord[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const sql = getSql();
  const rows = (status
    ? await sql.query(
        `SELECT ${RECORD_COLUMNS} FROM notifications WHERE status = $1 ORDER BY received_at DESC LIMIT $2`,
        [status, safeLimit],
      )
    : await sql.query(`SELECT ${RECORD_COLUMNS} FROM notifications ORDER BY received_at DESC LIMIT $1`, [
        safeLimit,
      ])) as NotificationRow[];
  return rows.map(toRecord);
}

export async function deleteNotification(id: number): Promise<boolean> {
  const rows = (await getSql().query("DELETE FROM notifications WHERE id = $1 RETURNING id", [id])) as unknown[];
  return rows.length > 0;
}
