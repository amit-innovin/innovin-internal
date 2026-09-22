"use client";

import { useEffect, useState } from "react";

type Row = { id: string; quality: "good" | "poor"; note: string; createdAt: string };

export default function Wifi() {
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");

  const refresh = () => fetch("/api/wifi").then((r) => r.json()).then(setRows);
  useEffect(() => { refresh(); }, []);

  async function report(quality: "good" | "poor") {
    setMsg("");
    const res = await fetch("/api/wifi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quality, note }),
    });
    setMsg(res.ok ? "Report submitted ✓" : (await res.json()).error);
    setNote("");
    refresh();
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold">Wi-Fi Quality</h1>
      <p className="mt-1 text-sm text-slate-500">
        Is the Wi-Fi working well? Report issues — if nobody flags it, everyone assumes it&apos;s fine.
      </p>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything to add? (optional — e.g. slow near meeting room)"
        className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        rows={2}
      />
      <div className="mt-3 flex gap-3">
        <button onClick={() => report("good")} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white">
          👍 Good
        </button>
        <button onClick={() => report("poor")} className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-medium text-white">
          👎 Poor
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-slate-600">{msg}</p>}

      <h2 className="mt-8 text-sm font-semibold text-slate-500">Recent reports</h2>
      <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-2.5">
            <div className="flex justify-between">
              <span className="text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
              <span className={r.quality === "good" ? "font-medium text-emerald-600" : "font-medium text-red-500"}>
                {r.quality === "good" ? "Good" : "Poor"}
              </span>
            </div>
            {r.note && <p className="mt-1 text-slate-600">{r.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
