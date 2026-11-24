import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNotification } from "./parser.ts";

interface Case {
  name: string;
  text: string;
  source?: string;
  direction: "in" | "out" | "unknown";
  amountSatang: number | null;
  bank?: string | null;
}

const cases: Case[] = [
  {
    name: "KBank incoming SMS ignores balance",
    text: "24/11/69 10:15 บช X-1234 รับโอนจาก X-5678 1,500.00 คงเหลือ 12,345.67 บ.",
    source: "KBank",
    direction: "in",
    amountSatang: 150_000,
    bank: "KBANK",
  },
  {
    name: "SCB incoming with บาท unit",
    text: "เงิน 2,000.00 บาท เข้าบัญชี x123456 วันที่ 24/11@10:15 ใช้ได้ 5,000.00 บาท SCB",
    direction: "in",
    amountSatang: 200_000,
    bank: "SCB",
  },
  {
    name: "Krungthai push with integer amount and unit",
    text: "กรุงไทย: เงินเข้า 500 บาท บ/ช XXX-X-X1234-X ยอดเงินคงเหลือ 9,999.00 บาท",
    direction: "in",
    amountSatang: 50_000,
    bank: "KTB",
  },
  {
    name: "Satang precision",
    text: "รับโอน 0.75 บ. เข้าบ/ช x9999",
    direction: "in",
    amountSatang: 75,
  },
  {
    name: "Outgoing transfer",
    text: "24/11/69 10:20 บช X-1234 โอนออก 300.00 คงเหลือ 12,045.67 บ.",
    direction: "out",
    amountSatang: 30_000,
  },
  {
    name: "English deposit with THB",
    text: "Deposit THB 1,250.50 to a/c x1234. Avail Bal THB 8,000.00",
    direction: "in",
    amountSatang: 125_050,
  },
  {
    name: "English deposit with unit after amount",
    text: "Received 1,250.50 THB to a/c x1234. Balance 8,000.00 THB",
    direction: "in",
    amountSatang: 125_050,
  },
  {
    name: "SCB Easy PromptPay push (truncated) uses receiving bank, not sender",
    text: "คุณได้รับเงิน 10.00 บาท ผ่านรายการพร้อมเพย์จาก KBANK / xxxxxx5461 เข้า...",
    source: "SCB Easy",
    direction: "in",
    amountSatang: 1_000,
    bank: "SCB",
  },
  {
    name: "SCB Easy PromptPay push (full, real format with date)",
    text: "คุณได้รับเงิน 1.00 บาท ผ่านรายการพร้อมเพย์จาก KBANK / xxxxxx0000 เข้าบัญชี xxxxxx9999 เมื่อ 24 พ.ย. 2569 - 14:14",
    source: "SCB Easy",
    direction: "in",
    amountSatang: 100,
    bank: "SCB",
  },
  {
    name: "Sender bank in text is skipped when source is unknown",
    text: "คุณได้รับเงิน 10.00 บาท ผ่านรายการพร้อมเพย์จาก KBANK / xxxxxx5461 เข้าบัญชี SCB xxx-xxx123-4",
    direction: "in",
    amountSatang: 1_000,
    bank: "SCB",
  },
  {
    name: "OTP / non-financial message",
    text: "รหัส OTP ของคุณคือ 123456 (Ref: ABCD) ห้ามบอกผู้อื่น",
    direction: "unknown",
    amountSatang: null,
  },
];

for (const c of cases) {
  test(c.name, () => {
    const result = parseNotification(c.text, c.source);
    assert.equal(result.direction, c.direction);
    assert.equal(result.amountSatang, c.amountSatang);
    if (c.bank !== undefined) assert.equal(result.bank, c.bank);
  });
}
