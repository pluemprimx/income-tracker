import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "./db";
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
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Bangkok has no DST.
const DAY_MS = 24 * 60 * 60 * 1000;

interface NotificationRow {
  id: number;
  raw_text: string;
  source: string | null;
  bank: string | null;
  direction: Direction;
  amount_satang: number | null;
  status: NotificationStatus;
  received_at: number;
}

function toRecord(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    rawText: row.raw_text,
    source: row.source,
    bank: row.bank,
    direction: row.direction,
    amountSatang: row.amount_satang,
    status: row.status,
    receivedAt: row.received_at,
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

export function recordNotification(input: RecordInput): RecordResult {
  const db = getDb();
  const now = Date.now();
  const receivedAt = input.receivedAt ?? now;
  const textHash = hashText(input.text);

  const existing = db
    .prepare("SELECT id FROM notifications WHERE text_hash = ? AND ABS(received_at - ?) < ? LIMIT 1")
    .get(textHash, receivedAt, DUPLICATE_WINDOW_MS) as { id: number } | undefined;
  if (existing) return { duplicate: true, existingId: existing.id };

  const parsed = parseNotification(input.text, input.source);
  const status = resolveStatus(parsed.direction, parsed.amountSatang);

  const row = db
    .prepare(
      `INSERT INTO notifications
         (raw_text, text_hash, source, bank, direction, amount_satang, status, received_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, raw_text, source, bank, direction, amount_satang, status, received_at`,
    )
    .get(
      input.text,
      textHash,
      input.source ?? null,
      parsed.bank,
      parsed.direction,
      parsed.amountSatang,
      status,
      receivedAt,
      now,
    ) as unknown as NotificationRow;

  return { duplicate: false, record: toRecord(row) };
}

function sumIncomeSince(since: number): IncomeSummary {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount_satang), 0) AS total
       FROM notifications WHERE status = 'income' AND received_at >= ?`,
    )
    .get(since) as { count: number; total: number };
  return { count: row.count, totalSatang: row.total };
}

function startOfBangkokDay(now: number): number {
  return Math.floor((now + BANGKOK_OFFSET_MS) / DAY_MS) * DAY_MS - BANGKOK_OFFSET_MS;
}

function startOfBangkokMonth(now: number): number {
  const local = new Date(now + BANGKOK_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - BANGKOK_OFFSET_MS;
}

export function getIncomeStats(now: number = Date.now()): IncomeStats {
  return {
    today: sumIncomeSince(startOfBangkokDay(now)),
    month: sumIncomeSince(startOfBangkokMonth(now)),
    allTime: sumIncomeSince(0),
  };
}

export function listNotifications(limit = 50, status?: NotificationStatus): NotificationRecord[] {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const db = getDb();
  const rows = status
    ? db
        .prepare("SELECT * FROM notifications WHERE status = ? ORDER BY received_at DESC LIMIT ?")
        .all(status, safeLimit)
    : db.prepare("SELECT * FROM notifications ORDER BY received_at DESC LIMIT ?").all(safeLimit);
  return (rows as unknown as NotificationRow[]).map(toRecord);
}

export function deleteNotification(id: number): boolean {
  const result = getDb().prepare("DELETE FROM notifications WHERE id = ?").run(id);
  return Number(result.changes) > 0;
}
