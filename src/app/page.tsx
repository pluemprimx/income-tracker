import { getIncomeStats, listNotifications, type NotificationStatus } from "@/lib/repository";
import { formatBaht, formatDateTime } from "@/lib/format";
import { deleteNotificationAction } from "./actions";
import { AddNotificationForm } from "./add-notification-form";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<NotificationStatus, string> = {
  income: "เงินเข้า",
  ignored: "เงินออก",
  unparsed: "อ่านไม่ได้",
};

function StatCard({ label, count, totalSatang }: { label: string; count: number; totalSatang: number }) {
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{formatBaht(totalSatang)}</span>
      <span className="stat-count">{count.toLocaleString("th-TH")} ครั้ง</span>
    </div>
  );
}

export default async function DashboardPage() {
  const [stats, notifications] = await Promise.all([getIncomeStats(), listNotifications(100)]);

  return (
    <main>
      <header>
        <h1>Income Tracker</h1>
        <p className="muted">สรุปเงินเข้าบัญชีจากการแจ้งเตือน (เวลาไทย)</p>
      </header>

      <section className="stats">
        <StatCard label="วันนี้" {...stats.today} />
        <StatCard label="เดือนนี้" {...stats.month} />
        <StatCard label="ทั้งหมด" {...stats.allTime} />
      </section>

      <AddNotificationForm />

      <section className="card">
        <h2>รายการล่าสุด</h2>
        {notifications.length === 0 ? (
          <p className="muted">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>สถานะ</th>
                  <th className="num">จำนวนเงิน</th>
                  <th>ธนาคาร</th>
                  <th>ข้อความ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <td className="nowrap">{formatDateTime(n.receivedAt)}</td>
                    <td>
                      <span className={`badge ${n.status}`}>{STATUS_LABELS[n.status]}</span>
                    </td>
                    <td className="num nowrap">{n.amountSatang === null ? "—" : formatBaht(n.amountSatang)}</td>
                    <td>{n.bank ?? n.source ?? "—"}</td>
                    <td className="raw">{n.rawText}</td>
                    <td>
                      <form action={deleteNotificationAction}>
                        <input type="hidden" name="id" value={n.id} />
                        <button type="submit" className="link-btn" aria-label={`ลบรายการ #${n.id}`}>
                          ลบ
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
