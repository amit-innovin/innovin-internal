"use client";

import { useState } from "react";
import { MENU, ORDER_CUTOFF_HOUR } from "@/lib/menu";

const PREFS = ["anything", "healthy", "unhealthy"];

export default function Snacks() {
  const [pref, setPref] = useState("anything");
  const [instructions, setInstructions] = useState("");
  const [msg, setMsg] = useState("");
  const [ordered, setOrdered] = useState<string | null>(null);

  async function order(itemId: string) {
    setMsg("");
    const res = await fetch("/api/snacks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, preference: pref, instructions }),
    });
    const data = await res.json();
    if (res.ok) {
      setOrdered(itemId);
      setMsg("Order placed ✓");
    } else {
      setMsg(data.error);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold">Snacks & Tea</h1>
      <p className="mt-1 text-sm text-slate-500">What would you like today? Orders close at {ORDER_CUTOFF_HOUR}:00 AM.</p>

      <div className="mt-6 space-y-3">
        {MENU.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
            <div>
              <div className="font-medium">{m.name}</div>
              <div className="text-sm text-slate-500">₹{m.price}</div>
            </div>
            <button
              onClick={() => order(m.id)}
              className={`rounded-lg px-4 py-1.5 text-lg font-bold ${ordered === m.id ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-indigo-900"}`}
            >
              {ordered === m.id ? "✓" : "+"}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <label className="text-sm font-medium">Preference</label>
        <div className="mt-2 flex gap-2">
          {PREFS.map((p) => (
            <button
              key={p}
              onClick={() => setPref(p)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize ${pref === p ? "bg-indigo-900 text-white" : "border border-slate-300"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder="Special instructions (optional) — e.g. no sugar, extra spicy"
        className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        rows={2}
      />

      {msg && <p className="mt-3 text-sm text-slate-600">{msg}</p>}
    </div>
  );
}
