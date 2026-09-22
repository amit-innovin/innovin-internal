"use client";

import { useState } from "react";

export default function Grievances() {
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    const res = await fetch("/api/grievances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, displayName: anonymous ? null : name }),
    });
    const data = await res.json();
    if (res.ok) {
      setDone(true);
      setBody("");
      setName("");
    } else {
      setErr(data.error);
    }
  }

  if (done) {
    return (
      <div className="max-w-lg">
        <h1 className="text-xl font-bold">Daily Grievances</h1>
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <div className="text-3xl">💙</div>
          <p className="mt-2 font-medium">Submitted — thank you.</p>
          <p className="mt-1 text-sm text-slate-500">Your feedback matters. We&apos;ll look into it and take action where needed.</p>
          <button onClick={() => setDone(false)} className="mt-4 text-sm text-indigo-700 underline">
            Share another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold">Daily Grievances</h1>
      <p className="mt-1 text-sm text-slate-500">Share any issues or suggestions anonymously or with your name.</p>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setAnonymous(true)}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${anonymous ? "bg-indigo-900 text-white" : "border border-slate-300"}`}
        >
          Anonymous
        </button>
        <button
          onClick={() => setAnonymous(false)}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${!anonymous ? "bg-indigo-900 text-white" : "border border-slate-300"}`}
        >
          With Name
        </button>
      </div>

      {!anonymous && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What would you like to share?"
        maxLength={2000}
        className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        rows={5}
      />
      <div className="text-right text-xs text-slate-400">{body.length}/2000</div>

      <button onClick={submit} className="mt-3 w-full rounded-lg bg-indigo-900 py-2.5 text-sm font-medium text-white">
        Submit
      </button>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
    </div>
  );
}
