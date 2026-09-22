import { isAdmin } from "@/lib/admin";
import { store } from "@/lib/store";
import { MENU } from "@/lib/menu";
import { todayIST } from "@/lib/time";
import AdminLogin from "@/components/admin-login";
import GrievanceList from "@/components/grievance-list";

export const dynamic = "force-dynamic";

export default async function Admin() {
  if (!(await isAdmin())) return <AdminLogin />;

  const date = todayIST();
  const [attendance, orders, grievances, wifi] = await Promise.all([
    store.listAttendance(date),
    store.listOrders(date),
    store.listGrievances(),
    store.listWifi(50),
  ]);

  const consolidated = MENU.map((m) => ({
    ...m,
    count: orders.filter((o) => o.itemId === m.id).length,
  }));

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold">Admin — {date}</h1>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Today&apos;s snack orders</h2>
        <ul className="mt-3 text-sm">
          {consolidated.map((c) => (
            <li key={c.id} className="flex justify-between py-1">
              <span>{c.name}</span>
              <span className="font-medium">× {c.count}</span>
            </li>
          ))}
        </ul>
        {orders.some((o) => o.instructions) && (
          <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
            {orders.filter((o) => o.instructions).map((o) => (
              <p key={o.id}>• {o.instructions}</p>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Attendance — {attendance.length} in today</h2>
        <ul className="mt-3 text-sm text-slate-600">
          {attendance.map((a) => (
            <li key={a.id} className="py-0.5">{a.email}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Grievances — {grievances.length}</h2>
        <GrievanceList items={grievances.map(({ submitterRef: _r, ...g }) => g)} />
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Wi-Fi reports — {wifi.length}</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {wifi.slice(0, 20).map((w) => (
            <li key={w.id} className="flex justify-between">
              <span>{new Date(w.createdAt).toLocaleString()}</span>
              <span className={w.quality === "good" ? "text-emerald-600" : "text-red-500"}>{w.quality}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
