import { NextResponse } from "next/server";
import { isAuthorizedWebhook } from "@/lib/auth";
import { getIncomeStats } from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedWebhook(request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getIncomeStats());
}
