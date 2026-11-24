import type { RecordInput } from "./repository";

const MAX_TEXT_LENGTH = 2000;
const MAX_SOURCE_LENGTH = 200;
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

export type ValidationResult = { ok: true; value: RecordInput } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseReceivedAt(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  const ms = typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(ms) || ms <= 0 || ms > Date.now() + MAX_FUTURE_SKEW_MS) return null;
  return Math.trunc(ms);
}

export function validateWebhookPayload(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return { ok: false, error: "Body must be a JSON object" };

  const { text, source, receivedAt } = payload;
  if (typeof text !== "string" || text.trim().length === 0) {
    return { ok: false, error: "`text` is required" };
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: `\`text\` must be at most ${MAX_TEXT_LENGTH} characters` };
  }
  if (source !== undefined && source !== null && typeof source !== "string") {
    return { ok: false, error: "`source` must be a string" };
  }

  const parsedReceivedAt = parseReceivedAt(receivedAt);
  if (parsedReceivedAt === null) {
    return { ok: false, error: "`receivedAt` must be epoch ms or an ISO date, not in the future" };
  }

  return {
    ok: true,
    value: {
      text: text.trim(),
      source: typeof source === "string" ? source.trim().slice(0, MAX_SOURCE_LENGTH) || null : null,
      receivedAt: parsedReceivedAt,
    },
  };
}
