"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogin() {
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      setErr("Wrong passcode");
    }
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-xl font-bold">Admin</h1>
      <form onSubmit={submit} className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <label className="text-sm font-medium">Admin passcode</label>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="mt-4 w-full rounded-lg bg-indigo-900 py-2 text-sm font-medium text-white">
          Sign in
        </button>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <p className="mt-4 text-xs text-slate-400">Set ADMIN_PASSCODE in .env to enable admin access.</p>
      </form>
    </div>
  );
}
