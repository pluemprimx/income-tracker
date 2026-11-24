import "server-only";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Accepts `Authorization: Bearer <secret>` or `X-Webhook-Secret: <secret>`. */
export function isAuthorizedWebhook(headers: Headers): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;
  const bearer = headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const provided = bearer ?? headers.get("x-webhook-secret") ?? "";
  return provided.length > 0 && safeEqual(provided.trim(), secret);
}
