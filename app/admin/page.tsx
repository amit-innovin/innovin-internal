import { list, today } from "@/lib/store";
import { MENU } from "@/lib/menu";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const date = today();
  const [attendance, orders, grievances, wifi] = await Promise.all([
    list("attendance", date),
    list("orders", date),
    list("grievances"),
    list("wifi"),
  ]);

  const consolidated = MENU.map((m) => ({
    ...m,
    count: orders.filter((o) => o.itemId === m.id).length,
  }));

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold">Admin — {date}</h1>
      <p className="mt-1 text-sm text-slate-500">Consolidated view. TODO: protect this route.</p>

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
        <ul className="mt-3 space-y-3 text-sm">
          {grievances.map((g) => (
            <li key={g.id} className="rounded-lg bg-slate-50 p-3">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{g.displayName ?? "Anonymous"}</span>
                <span>{g.status}</span>
              </div>
              <p className="mt-1 text-slate-700">{g.body}</p>
            </li>
          ))}
        </ul>
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
