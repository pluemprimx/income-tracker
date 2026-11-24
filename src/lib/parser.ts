export type Direction = "in" | "out" | "unknown";

export interface ParsedNotification {
  direction: Direction;
  /** Amount in satang (1 THB = 100 satang) to avoid floating point errors. */
  amountSatang: number | null;
  bank: string | null;
}

const INCOME_KEYWORDS = [
  "เงินเข้า",
  "รับโอน",
  "โอนเข้า",
  "รับเงิน",
  "ได้รับเงิน",
  "เข้าบัญชี",
  "เข้าบ/ช",
  "ฝากเงิน",
  "ฝาก/โอน",
  "received",
  "deposit",
  "incoming",
  "credited",
  "transfer in",
];

const OUTGOING_KEYWORDS = [
  "เงินออก",
  "โอนออก",
  "ถอน",
  "จ่าย",
  "ชำระ",
  "หักบัญชี",
  "ตัดบัญชี",
  "withdraw",
  "debited",
  "paid",
  "payment",
  "transfer out",
];

/** Keywords that precede a balance figure, which must never be read as the amount. */
const BALANCE_KEYWORDS = [
  "คงเหลือ",
  "ยอดคงเหลือ",
  "ยอดเงินคงเหลือ",
  "ยอดใช้ได้",
  "ยอดเงินใช้ได้",
  "ใช้ได้",
  "เงินในบัญชี",
  "available balance",
  "avail bal",
  "avail",
  "balance",
  "bal",
];

const BANK_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ["KBANK", /kbank|k\s?plus|kasikorn|กสิกร/i],
  ["SCB", /\bscb\b|scb\s?easy|ไทยพาณิชย์/i],
  ["KTB", /\bktb\b|krungthai|กรุงไทย|เป๋าตัง|paotang/i],
  ["BBL", /\bbbl\b|bualuang|bangkok\s?bank|กรุงเทพ/i],
  ["KRUNGSRI", /krungsri|\bbay\b|kma|กรุงศรี/i],
  ["TTB", /\bttb\b|ทีทีบี|ทหารไทยธนชาต/i],
  ["GSB", /\bgsb\b|mymo|ออมสิน/i],
  ["BAAC", /\bbaac\b|ธ\.?ก\.?ส/i],
  ["TRUEMONEY", /truemoney|ทรูมันนี่/i],
];

// A number that looks like money: "1,234.56", "1234.56", "1,234", or "500" followed by a currency unit.
const NUMBER = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2}|\d+`;
const CURRENCY = String.raw`(?:บาท|บ\.|บ(?![ก-๙/])|thb|฿)`;
const MONEY_WITH_UNIT = new RegExp(
  String.raw`(?:฿\s*(${NUMBER}))|(?:(?<![\d/.:,x-])(${NUMBER})\s*${CURRENCY})`,
  "giu",
);
const MONEY_DECIMAL = new RegExp(String.raw`(?<![\d/.:,])(\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})(?![\d/:])`, "g");

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

const BALANCE_SEGMENT = new RegExp(
  String.raw`(?:${[...BALANCE_KEYWORDS].sort((a, b) => b.length - a.length).map(escapeRegex).join("|")})\s*[:.]?\s*(?:${CURRENCY}\s*)?(?:${NUMBER})(?:\s*${CURRENCY})?`,
  "giu",
);

function includesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function toSatang(raw: string): number | null {
  const normalized = raw.replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [baht, fraction = ""] = normalized.split(".");
  const satang = Number(baht) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(satang) && satang > 0 ? satang : null;
}

export function detectDirection(text: string): Direction {
  const lower = text.toLowerCase();
  const isIncome = includesAny(lower, INCOME_KEYWORDS);
  const isOutgoing = includesAny(lower, OUTGOING_KEYWORDS);
  if (isIncome && !isOutgoing) return "in";
  if (isOutgoing && !isIncome) return "out";
  if (isIncome && isOutgoing) {
    // e.g. "โอนออก ... เข้าบัญชี xxx": the earliest keyword usually describes the event.
    const firstIndex = (keywords: readonly string[]): number =>
      Math.min(...keywords.map((k) => lower.indexOf(k)).filter((i) => i >= 0));
    return firstIndex(INCOME_KEYWORDS) < firstIndex(OUTGOING_KEYWORDS) ? "in" : "out";
  }
  return "unknown";
}

export function extractAmount(text: string): number | null {
  const withoutBalance = text.replace(BALANCE_SEGMENT, " ");

  for (const match of withoutBalance.matchAll(MONEY_WITH_UNIT)) {
    const satang = toSatang(match[1] ?? match[2] ?? "");
    if (satang !== null) return satang;
  }
  for (const match of withoutBalance.matchAll(MONEY_DECIMAL)) {
    const satang = toSatang(match[1] ?? "");
    if (satang !== null) return satang;
  }
  return null;
}

function matchBank(haystack: string): string | null {
  for (const [bank, pattern] of BANK_PATTERNS) {
    if (pattern.test(haystack)) return bank;
  }
  return null;
}

/** Strips "จาก KBANK" / "from KBANK": the sender's bank, not the account that received the money. */
const SENDER_BANK = /(?:จาก|from)\s*[^\s/]+/giu;

/**
 * Resolves the receiving bank. The notifying app (source) wins, since texts often name the
 * sender's bank, e.g. SCB Easy: "คุณได้รับเงิน ... พร้อมเพย์จาก KBANK".
 */
export function detectBank(text: string, source?: string | null): string | null {
  return (source ? matchBank(source) : null) ?? matchBank(text.replace(SENDER_BANK, " ")) ?? matchBank(text);
}

export function parseNotification(text: string, source?: string | null): ParsedNotification {
  const clean = text.replace(/\s+/g, " ").trim();
  return {
    direction: detectDirection(clean),
    amountSatang: extractAmount(clean),
    bank: detectBank(clean, source),
  };
}
