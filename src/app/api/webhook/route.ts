import { NextResponse } from "next/server";
import { isAuthorizedWebhook } from "@/lib/auth";
import { recordNotification } from "@/lib/repository";
import { validateWebhookPayload } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readPayload(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return request.json();
  // Fallback for automation apps that can only send a plain-text body.
  return { text: await request.text(), source: request.headers.get("x-source") };
}

export async function POST(request: Request) {
  if (!process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "WEBHOOK_SECRET is not configured" }, { status: 500 });
  }
  if (!isAuthorizedWebhook(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await readPayload(request);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validation = validateWebhookPayload(payload);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const result = await recordNotification(validation.value);
    if (result.duplicate) {
      return NextResponse.json({ duplicate: true, id: result.existingId }, { status: 200 });
    }
    return NextResponse.json({ duplicate: false, ...result.record }, { status: 201 });
  } catch (error) {
    console.error("[webhook] failed to record notification", error);
    return NextResponse.json({ error: "Failed to record notification" }, { status: 500 });
  }
}
