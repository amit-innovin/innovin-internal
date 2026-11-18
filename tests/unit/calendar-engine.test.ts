import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRow } from "@/lib/types";

// lib/calendar.ts against a fake Google that behaves like the real one where it matters: deleted
// ids stay taken (insert → 409, GET → status "cancelled"), and a call can time out after it landed.
const dir = path.join(os.tmpdir(), `innovin-calendar-${process.pid}`);
Object.assign(process.env, {
  DATA_FILE: path.join(dir, "store.json"),
  DATABASE_URL: "",
  GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "secret", SESSION_SECRET: "s",
  GOOGLE_TOKEN_URL: "http://g/token", GOOGLE_REVOKE_URL: "http://g/revoke", GOOGLE_CALENDAR_URL: "http://g/cal",
  ALLOWED_EMAIL_DOMAINS: "innovinlabs.com", ADMIN_EMAILS: "",
});
const KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

type GEvent = { id: string; status?: string; summary?: string; attendees?: { email: string }[] };
type Fault = "5xx" | "timeout" | "timeout-landed";
const A = "a@innovinlabs.com", B = "b@innovinlabs.com", M = "m@innovinlabs.com";

let google: {
  token: "ok" | "5xx"; dead: Set<string>; cal: Map<string, Map<string, GEvent>>; revoked: string[];
  faults: { method: string; owner?: string; fault: Fault }[]; calls: { method: string; owner: string; id: string; sendUpdates: string | null }[];
};
const live = () => [...google.cal.entries()].flatMap(([owner, m]) => [...m.values()].filter((e) => e.status !== "cancelled").map((e) => ({ owner, ...e })));

function fakeFetch(input: string | URL, init: RequestInit = {}) {
  const url = new URL(String(input));
  const method = init.method ?? "GET";
  const json = (status: number, body: unknown) => Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status }));
  const form = new URLSearchParams(String(init.body ?? ""));
  if (url.pathname === "/token") {
    const rt = form.get("refresh_token") ?? "";
    if (google.token === "5xx") return json(503, { error: "backend" });
    if (google.dead.has(rt.split(":")[1])) return json(400, { error: "invalid_grant" });
    return json(200, { access_token: `at:${rt.split(":")[1]}` });
  }
  if (url.pathname === "/revoke") { google.revoked.push(form.get("token") ?? ""); return json(200, {}); }
  const owner = String((init.headers as Record<string, string>)?.Authorization ?? "").replace("Bearer at:", "");
  const mine = google.cal.get(owner) ?? new Map<string, GEvent>();
  google.cal.set(owner, mine);
  const id = url.pathname.split("/events/")[1];
  const body = init.body ? (JSON.parse(String(init.body)) as GEvent) : null;
  google.calls.push({ method, owner, id: id ?? body?.id ?? "", sendUpdates: url.searchParams.get("sendUpdates") });
  const fault = google.faults.findIndex((f) => f.method === method && (!f.owner || f.owner === owner));
  const which = fault >= 0 ? google.faults.splice(fault, 1)[0].fault : null;
  if (which === "5xx") return json(503, {});
  if (which === "timeout") return Promise.reject(new Error("timeout"));
  const apply = () => {
    if (method === "POST") {
      if (mine.has(body!.id)) return json(409, {});
      mine.set(body!.id, { ...body!, status: "confirmed" });
      return json(200, body);
    }
    const e = mine.get(id!);
    if (!e) return json(404, {});
    if (method === "GET") return json(200, e);
    if (method === "DELETE") { if (e.status === "cancelled") return json(410, {}); e.status = "cancelled"; return json(204, null); }
    Object.assign(e, body, e.status === "cancelled" && !body?.status ? { status: "cancelled" } : {});
    return json(200, e);
  };
  const res = apply();
  return which === "timeout-landed" ? Promise.reject(new Error("timeout")) : res;
}

let cal: typeof import("@/lib/calendar");
let store: typeof import("@/lib/store").store;
let needsYou: typeof import("@/lib/admin-queue").needsYou;
let seq = 0;
const person = (email: string, role: "admin" | "member" = "member") =>
  store.upsertEmployee({ email, name: email.split("@")[0].toUpperCase(), picture: "", role, joinedOn: null, stepsOffset: 0, createdAt: new Date().toISOString(), lastSeenAt: "" }).then(() => store.setRole(email, role));
const event = async (title = "Potluck"): Promise<EventRow> =>
  store.addEvent({ id: `ev${++seq}`, title, body: "", category: "social", startsAt: new Date(Date.now() + 86_400_000).toISOString(), location: "Big room", createdBy: A, createdAt: new Date().toISOString() });
const connectAs = async (email: string, at: number) => {
  await cal.saveConnection(email, `rt:${email}:1`, cal.CALENDAR_SCOPE);
  const row = (await store.getCalendarToken(email))!;
  await store.saveCalendarToken({ ...row, createdAt: new Date(at).toISOString() });
};

beforeAll(async () => {
  cal = await import("@/lib/calendar");
  store = (await import("@/lib/store")).store;
  needsYou = (await import("@/lib/admin-queue")).needsYou;
});

beforeEach(async () => {
  process.env.CALENDAR_TOKEN_KEY = KEY;
  await fs.rm(dir, { recursive: true, force: true });
  google = { token: "ok", dead: new Set(), cal: new Map(), revoked: [], faults: [], calls: [] };
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  await person(A, "admin"); await person(B, "admin"); await person(M);
  await connectAs(A, 1000);
});
afterEach(() => vi.unstubAllGlobals());

describe("Calendar invites when Google misbehaves", () => {
  it("a token blip on cancel leaves the invite retryable and in Needs you; the retry tells guests", async () => {
    const e = await event("Quiz");
    expect((await cal.sendInvite(e, A)).state).toBe("sent");
    const cancelled = (await store.updateEvent(e.id, e.createdAt, { title: e.title, body: e.body, category: e.category, startsAt: e.startsAt, location: e.location, cancelledAt: new Date().toISOString() }, new Date().toISOString()))!;
    google.token = "5xx";
    await cal.removeInvite(e.id, true);
    expect((await store.getEventInvite(e.id))?.state).toBe("failed");
    expect((await needsYou()).map((n) => n.title)).toContain("Cancel didn't reach Google · Quiz");
    google.token = "ok";
    expect(await cal.retryInvite(cancelled, B)).toBe("done");
    expect(live()).toHaveLength(0);
    expect(google.calls.at(-1)).toMatchObject({ method: "DELETE", owner: A, sendUpdates: "all" });
  });

  it("an edit during a token blip is retried later, never orphaned", async () => {
    const e = await event("Yoga");
    await cal.sendInvite(e, A);
    google.token = "5xx";
    const moved = { ...e, title: "Yoga (moved)" };
    await cal.updateInvite(moved);
    expect((await store.getEventInvite(e.id))?.state).toBe("failed");
    google.token = "ok";
    expect(await cal.retryInvite(moved, B)).toBe("done");
    expect(live()).toEqual([expect.objectContaining({ owner: A, summary: "Yoga (moved)" })]);
  });

  it("without the key nothing is forgotten; it works again once the key is back", async () => {
    const e = await event();
    await cal.sendInvite(e, A);
    delete process.env.CALENDAR_TOKEN_KEY;
    await cal.refreshGuests();
    await cal.updateInvite({ ...e, title: "Renamed" });
    expect(await store.getCalendarToken(A)).not.toBeNull();
    expect((await store.getEventInvite(e.id))?.state).not.toBe("orphaned");
    process.env.CALENDAR_TOKEN_KEY = KEY;
    expect(await cal.retryInvite({ ...e, title: "Renamed" }, A)).not.toBe("failed");
    expect(live()).toEqual([expect.objectContaining({ summary: "Renamed" })]);
  });

  it("a hand-over copy that timed out but landed is taken back: one copy, marked orphaned", async () => {
    await connectAs(B, 2000);
    const e = await event();
    await cal.sendInvite(e, A);
    google.faults.push({ method: "POST", owner: B, fault: "timeout-landed" });
    expect(await cal.retireCalendar(A)).toMatchObject({ moved: 0, orphaned: 1 });
    expect(live()).toEqual([expect.objectContaining({ owner: A })]);
    expect((await store.getEventInvite(e.id))?.state).toBe("orphaned");
  });

  it("a hand-over whose old delete timed out but landed keeps the copy", async () => {
    await connectAs(B, 2000);
    const e = await event();
    await cal.sendInvite(e, A);
    google.faults.push({ method: "DELETE", owner: A, fault: "timeout-landed" });
    expect(await cal.retireCalendar(A)).toMatchObject({ moved: 1, orphaned: 0 });
    expect(live()).toEqual([expect.objectContaining({ owner: B })]);
    expect(await store.getEventInvite(e.id)).toMatchObject({ state: "sent", owner: B });
  });

  it("an invite that timed out but landed is never sent twice, even after its admin goes", async () => {
    await connectAs(B, 2000);
    const e = await event();
    google.faults.push({ method: "POST", owner: A, fault: "timeout-landed" });
    expect((await cal.sendInvite(e, A)).state).toBe("failed");
    await cal.retireCalendar(A);
    await cal.retryInvite(e, B);
    await cal.retryInvite(e, B);
    expect(live()).toHaveLength(1);
  });

  it("Send again does nothing to an invite that already went out", async () => {
    const e = await event();
    await cal.sendInvite(e, A);
    const before = google.calls.length;
    expect(await cal.retryInvite(e, A)).toBe("not-needed");
    expect(google.calls.length).toBe(before);
  });

  it("Google calls give up instead of hanging", async () => {
    vi.stubGlobal("fetch", vi.fn((_u: unknown, init: RequestInit = {}) => new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(new Error("aborted"))))));
    process.env.GOOGLE_TIMEOUT_MS = "50";
    try {
      expect((await cal.sendInvite(await event(), A)).state).toBe("failed");
    } finally {
      delete process.env.GOOGLE_TIMEOUT_MS;
    }
  });

  it("Needs you: a dead connection's invites, and leavers out of the seen counts", async () => {
    const e = await event("Board games");
    await cal.sendInvite(e, A);
    google.dead.add(A);
    await cal.refreshGuests();
    expect((await needsYou()).map((n) => n.title)).toContain("Reconnect Google Calendar · A's invites can't be updated");

    await store.addAnnouncement({ id: "an1", title: "Water off", body: "", tag: "general", createdAt: new Date().toISOString(), important: true, authorName: null, pinnedUntil: null });
    const gone = "gone@innovinlabs.com";
    await person(gone);
    await store.setLeftOn(gone, "2026-11-18");
    for (const who of [A, B, gone]) await store.ackAnnouncement("an1", who);
    // M is the only active person who hasn't seen it.
    expect((await needsYou()).map((n) => n.title)).toContain("Water off · seen by 2 of 3");
  });

  it("the admin overview counts only people still here", async () => {
    const { adminOverview } = await import("@/lib/admin-view");
    await person("gone@innovinlabs.com");
    await store.setLeftOn("gone@innovinlabs.com", "2026-11-18");
    const o = await adminOverview();
    expect(o.total).toBe(3);
    expect(o.people.find((p) => p.email === "gone@innovinlabs.com")?.left).toBe(true);
  });
});
