"use server";

import { revalidatePath } from "next/cache";
import { deleteNotification, recordNotification } from "@/lib/repository";
import { validateWebhookPayload } from "@/lib/validation";

export interface ActionState {
  message: string | null;
  error: boolean;
}

export async function addNotificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const validation = validateWebhookPayload({
    text: formData.get("text"),
    source: formData.get("source") || undefined,
  });
  if (!validation.ok) return { message: validation.error, error: true };

  const result = await recordNotification(validation.value);
  revalidatePath("/");
  if (result.duplicate) return { message: `ข้อความซ้ำกับรายการ #${result.existingId}`, error: true };

  const statusLabel = {
    income: "บันทึกเป็นเงินเข้า",
    ignored: "เป็นรายการเงินออก (ไม่นับ)",
    unparsed: "อ่านยอดเงินไม่ได้ (เก็บไว้ตรวจสอบ)",
  }[result.record.status];
  return { message: `#${result.record.id}: ${statusLabel}`, error: false };
}

export async function deleteNotificationAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return;
  await deleteNotification(id);
  revalidatePath("/");
}
