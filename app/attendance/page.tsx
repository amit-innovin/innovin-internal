"use client";

import { useEffect, useState } from "react";

type Row = { id: string; email: string; checkInAt: string; checkOutAt: string | null };

export default function Attendance() {
  const [email, setEmail] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");

  const refresh = () => fetch("/api/attendance").then((r) => r.json()).then(setRows);
  useEffect(() => { refresh(); }, []);

  async function mark(action: "in" | "out") {
    setMsg("");
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action }),
    });
    const data = await res.json();
    setMsg(res.ok ? (action === "in" ? "Checked in ✓" : "Checked out ✓") : data.error);
    refresh();
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold">Attendance</h1>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <label className="text-sm font-medium">Your Innovin email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@innovinlabs.com"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="mt-4 flex gap-3">
          <button onClick={() => mark("in")} className="flex-1 rounded-lg bg-indigo-900 py-2 text-sm font-medium text-white">
            Check In
          </button>
          <button onClick={() => mark("out")} className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium">
            Check Out
          </button>
        </div>
        {msg && <p className="mt-3 text-sm text-slate-600">{msg}</p>}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-slate-500">Today — {rows.length} checked in</h2>
      <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between px-4 py-2.5">
            <span>{r.email}</span>
            <span className="text-slate-500">
              {new Date(r.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {r.checkOutAt && ` → ${new Date(r.checkOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
