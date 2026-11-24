"use client";

import { useActionState } from "react";
import { addNotificationAction, type ActionState } from "./actions";

const initialState: ActionState = { message: null, error: false };

export function AddNotificationForm() {
  const [state, formAction, pending] = useActionState(addNotificationAction, initialState);

  return (
    <form action={formAction} className="card form">
      <h2>ทดสอบ / เพิ่มข้อความแจ้งเตือน</h2>
      <textarea
        name="text"
        rows={3}
        required
        maxLength={2000}
        placeholder="วางข้อความแจ้งเตือนจากธนาคาร เช่น: รับโอนจาก X-5678 1,500.00 คงเหลือ 12,345.67 บ."
      />
      <div className="form-row">
        <input name="source" placeholder="แหล่งที่มา (ไม่บังคับ) เช่น KBank" maxLength={200} />
        <button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
      {state.message && <p className={state.error ? "msg error" : "msg"}>{state.message}</p>}
    </form>
  );
}
