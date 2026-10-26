import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getJSON, invalidate, send } from "@/lib/fetcher";

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => invalidate("/api/leave"));

it("reloads leave balances after a request or decision changes them", async () => {
  let pending = 0;
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") { pending = 2; return Response.json({ ok: true }); }
    return Response.json({ pending });
  }));
  expect(await getJSON("/api/leave", "leave balance")).toEqual({ pending: 0 });
  await send("/api/away", { method: "POST", json: { type: "leave" } });
  expect(await getJSON("/api/leave", "leave balance")).toEqual({ pending: 2 });
});

it("does not restore stale balances when an older GET finishes after a write", async () => {
  let finishOld!: (response: Response) => void;
  let reads = 0;
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") return Response.json({ ok: true });
    if (++reads === 1) return new Promise<Response>(resolve => { finishOld = resolve; });
    return Response.json({ pending: 2 });
  }));
  const old = getJSON("/api/leave", "leave balance");
  await send("/api/away", { method: "POST", json: { type: "leave" } });
  finishOld(Response.json({ pending: 0 }));
  expect(await old).toEqual({ pending: 2 });
  expect(await getJSON("/api/leave", "leave balance")).toEqual({ pending: 2 });
});

it("never shares a previous employee's pending GET after sign-out", async () => {
  let finishOld!: (response: Response) => void;
  let reads = 0;
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") return Response.json({ ok: true });
    if (++reads === 1) return new Promise<Response>(resolve => { finishOld = resolve; });
    return Response.json({ signedIn: false });
  }));
  const old = getJSON("/api/leave", "leave balance");
  await send("/api/auth/logout", { method: "POST" });
  const afterLogout = getJSON("/api/leave", "leave balance");
  finishOld(Response.json({ email: "previous@innovinlabs.com" }));
  expect(await afterLogout).toEqual({ signedIn: false });
  expect(await old).toEqual({ signedIn: false });
});
