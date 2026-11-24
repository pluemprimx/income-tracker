"use client";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main>
      <section className="card">
        <h2>โหลดข้อมูลไม่สำเร็จ</h2>
        <p className="muted">เชื่อมต่อฐานข้อมูลไม่ได้ ตรวจสอบ DATABASE_URL แล้วลองใหม่</p>
        <button type="button" onClick={reset}>
          ลองใหม่
        </button>
      </section>
    </main>
  );
}
