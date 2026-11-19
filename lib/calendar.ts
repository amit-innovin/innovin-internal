import { createHash, randomBytes } from "node:crypto";
import { googleEventBody, googleEventId, guestList, mergeGuests, type Guest } from "./calendar-rules";
import { sealToken, tokenKey, unsealToken } from "./calendar-crypto";
import { allowedEmailDomains, adminEmails } from "./config";
import { store } from "./store";
import type { EventInviteRow, EventRow } from "./types";

// Admin events as Google Calendar invites, sent from the publishing admin's own calendar
// (docs/superpowers/specs/2026-11-18-m3-calendar-invites-design.md). Least privilege: only events on
// calendars the admin owns. Refresh tokens live sealed in the store; access tokens only in memory.
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned";
export const CAL_STATE_COOKIE = "innovin_cal_state";
export const CAL_PKCE_COOKIE = "innovin_cal_pkce";

const authEndpoint = () => process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = () => process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const revokeEndpoint = () => process.env.GOOGLE_REVOKE_URL || "https://oauth2.googleapis.com/revoke";
const calendarApi = () => process.env.GOOGLE_CALENDAR_URL || "https://www.googleapis.com/calendar/v3";

export const calendarConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.SESSION_SECRET && tokenKey());

// --- Connecting -------------------------------------------------------------------------------

export function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function calendarAuthUrl(redirectUri: string, state: string, challenge: string, loginHint: string) {
  const url = new URL(authEndpoint());
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  // openid email: only so the callback can check the account is the admin's own.
  url.searchParams.set("scope", `openid email ${CALENDAR_SCOPE}`);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("login_hint", loginHint);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeCalendarCode(code: string, redirectUri: string, verifier: string) {
  const res = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: verifier }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  if (typeof data.refresh_token !== "string" || typeof data.id_token !== "string") return null;
  return { refreshToken: data.refresh_token, idToken: data.id_token, scope: String(data.scope ?? "") };
}

export async function saveConnection(email: string, refreshToken: string, scope: string) {
  const sealed = sealToken(email, refreshToken);
  if (!sealed) return false;
  await store.saveCalendarToken({ email, ...sealed, scope, createdAt: new Date().toISOString() });
  return true;
}

// --- Talking to Google -------------------------------------------------------------------------

// Every Google call gives up after this long, so a hung Google never hangs a publish or a People change.
const timeoutMs = () => Number(process.env.GOOGLE_TIMEOUT_MS) || 10_000;
async function timed(url: string | URL, init: RequestInit) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs());
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function revokeGrant(token: string) {
  const res = await timed(revokeEndpoint(), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
  return !!res?.ok;
}

type Access = { ok: true; token: string } | { ok: false; reason: "not-connected" | "dead" | "error" };

// A fresh access token for this admin. Only a grant Google says is dead (or a row sealed under an
// old key) is forgotten; a missing key or a Google blip is a retryable error and forgets nothing.
async function accessFor(email: string): Promise<Access> {
  if (!calendarConfigured()) return { ok: false, reason: "error" };
  const row = await store.getCalendarToken(email);
  if (!row) return { ok: false, reason: "not-connected" };
  const refresh = unsealToken(email, row);
  if (!refresh) {
    await store.deleteCalendarToken(email);
    return { ok: false, reason: "dead" };
  }
  const res = await timed(tokenEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: refresh, grant_type: "refresh_token" }),
  });
  if (!res) return { ok: false, reason: "error" };
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    if (data.error === "invalid_grant") {
      await store.deleteCalendarToken(email);
      return { ok: false, reason: "dead" };
    }
    return { ok: false, reason: "error" };
  }
  return typeof data.access_token === "string" ? { ok: true, token: data.access_token } : { ok: false, reason: "error" };
}

async function google(token: string, method: string, path: string, sendUpdates: "all" | "none" | null, body?: unknown) {
  const url = new URL(`${calendarApi()}/calendars/primary/events${path}`);
  if (sendUpdates) url.searchParams.set("sendUpdates", sendUpdates);
  const res = await timed(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res) return { status: 0, data: null as Record<string, unknown> | null };
  const data = res.status === 204 ? null : ((await res.json().catch(() => null)) as Record<string, unknown> | null);
  return { status: res.status, data };
}

const ok2xx = (status: number) => status >= 200 && status < 300;
// Google keeps deleted events (as "cancelled") and answers 404/410 for gone ones.
const gone = (r: { status: number; data: Record<string, unknown> | null }) => r.status === 404 || r.status === 410 || (r.status === 200 && r.data?.status === "cancelled");

const guestsFor = async (organizer: string) => guestList(await store.listEmployees(), organizer, allowedEmailDomains());
const upcoming = (e: EventRow | null): e is EventRow => !!e && !e.cancelledAt && Date.parse(e.startsAt) > Date.now();

async function record(row: Omit<EventInviteRow, "updatedAt">) {
  const full = { ...row, updatedAt: new Date().toISOString() };
  await store.setEventInvite(full);
  return full;
}

// A failed invite's `error` says whether it may already be in calendars: "unsent:<why>" never
// reached Google; "retry:<why>" may have (a POST that failed oddly, or an edit/cancel that didn't go
// through). Those stay pinned to their owner's calendar, so a retry can never send a second copy.
export const mayExist = (i: EventInviteRow) => i.state === "sent" || i.state === "orphaned" || (i.state === "failed" && !!i.error?.startsWith("retry:"));
const failedAs = (row: EventInviteRow | Omit<EventInviteRow, "updatedAt">, why: string) =>
  record({ ...row, state: "failed", error: `${mayExist(row as EventInviteRow) || why === "google" ? "retry" : "unsent"}:${why}` });

// --- Invites -------------------------------------------------------------------------------------

// Sends (or re-sends) the invite for one event. Idempotent: the Google id is fixed by (event,
// generation) and an invite that may exist stays with its calendar, so a retry is a 409 and an update.
export async function sendInvite(event: EventRow, owner: string): Promise<EventInviteRow> {
  const previous = await store.getEventInvite(event.id);
  if (previous?.state === "orphaned") return previous;
  const generation = previous?.generation ?? 0;
  const id = previous?.googleId ?? googleEventId(event.id, generation);
  const sender = previous && mayExist(previous) ? previous.owner : owner;
  const base = { eventId: event.id, owner: sender, googleId: id, generation, state: previous?.state ?? "failed", error: previous?.error ?? null } as const;
  const access = await accessFor(sender);
  if (!access.ok) return failedAs(base, access.reason);
  const guests = await guestsFor(sender);
  const inserted = await google(access.token, "POST", "", "all", googleEventBody(event, id, mergeGuests([], guests)));
  if (inserted.status === 409) {
    // Already there (an earlier try landed): bring it up to date, keeping guests' answers.
    const done = await patchEvent(access.token, id, event, guests, "all");
    return done ? record({ ...base, state: "sent", error: null }) : failedAs({ ...base, state: "failed", error: "retry:google" }, "google");
  }
  if (ok2xx(inserted.status)) return record({ ...base, state: "sent", error: null });
  // A timeout or 5xx may still have landed: pinned from now on.
  return record({ ...base, state: "failed", error: "retry:google" });
}

async function patchEvent(token: string, id: string, event: EventRow | null, guests: string[], sendUpdates: "all" | "none") {
  const current = await google(token, "GET", `/${id}`, null);
  if (current.status !== 200 || !current.data) return false;
  const attendees = mergeGuests((current.data.attendees as Guest[] | undefined) ?? [], guests);
  // A full update also revives an id Google kept as "cancelled".
  const body = event ? { ...googleEventBody(event, id, attendees), id: undefined, status: "confirmed" } : { attendees };
  return ok2xx((await google(token, "PATCH", `/${id}`, sendUpdates, body)).status);
}

// After an edit in the app: the invite follows, and guests are told. A failure is retryable.
export async function updateInvite(event: EventRow) {
  const invite = await store.getEventInvite(event.id);
  if (!invite || invite.state !== "sent") return invite;
  const access = await accessFor(invite.owner);
  if (!access.ok) return failedAs(invite, access.reason);
  const done = await patchEvent(access.token, invite.googleId, event, await guestsFor(invite.owner), "all");
  return done ? invite : failedAs(invite, "google");
}

// Cancel tells guests (Google emails them); Delete removes the invite quietly, like the app's Delete.
// Returns false when an invite that may be in calendars couldn't be removed (it stays, as retryable).
export async function removeInvite(eventId: string, tell: boolean) {
  const invite = await store.getEventInvite(eventId);
  if (!invite) return true;
  if (invite.state === "orphaned") return false;
  if (!mayExist(invite)) {
    await store.deleteEventInvite(eventId);
    return true;
  }
  const access = await accessFor(invite.owner);
  if (access.ok) {
    const res = await google(access.token, "DELETE", `/${invite.googleId}`, tell ? "all" : "none");
    if (ok2xx(res.status) || gone(res)) {
      await store.deleteEventInvite(eventId);
      return true;
    }
  }
  await failedAs(invite, access.ok ? "google" : access.reason);
  return false;
}

// "Send again": finishes whatever didn't reach Google (the invite, an edit, or a cancel).
export async function retryInvite(event: EventRow, actor: string): Promise<"done" | "not-needed" | "failed" | "orphaned"> {
  const invite = await store.getEventInvite(event.id);
  if (invite?.state === "orphaned") return "orphaned";
  if (event.cancelledAt) {
    if (!invite) return "not-needed";
    return (await removeInvite(event.id, true)) ? "done" : "failed";
  }
  if (invite?.state === "sent") return "not-needed";
  return (await sendInvite(event, actor)).state === "sent" ? "done" : "failed";
}

// Someone joined or left: every upcoming invite gets the current guest list, without emails.
// Guests already on it keep their answers.
export async function refreshGuests() {
  if (!calendarConfigured()) return;
  const invites = (await store.listEventInvites()).filter((i) => i.state === "sent");
  const byOwner = new Map<string, Access>();
  for (const invite of invites) {
    const event = await store.getEvent(invite.eventId);
    if (!upcoming(event)) continue;
    if (!byOwner.has(invite.owner)) byOwner.set(invite.owner, await accessFor(invite.owner));
    const access = byOwner.get(invite.owner)!;
    if (!access.ok) continue;
    await patchEvent(access.token, invite.googleId, null, await guestsFor(invite.owner), "none");
  }
}

// --- An admin goes (disconnects, loses admin, or is marked as left) ------------------------------

// The admin who takes over: the earliest connection that's still an admin and still here.
async function successorFor(leaving: string) {
  const [tokens, people] = await Promise.all([store.listCalendarTokens(), store.listEmployees()]);
  const byEmail = new Map(people.map((p) => [p.email, p]));
  return tokens.map((t) => t.email).find((email) => {
    if (email === leaving) return false;
    const p = byEmail.get(email);
    return !!p && !p.leftOn && (p.role === "admin" || adminEmails().includes(email));
  }) ?? null;
}

async function owned(owner: string, which: (i: EventInviteRow) => boolean) {
  const invites = (await store.listEventInvites()).filter((i) => i.owner === owner && which(i));
  const out: { invite: EventInviteRow; event: EventRow }[] = [];
  for (const invite of invites) {
    const event = await store.getEvent(invite.eventId);
    if (upcoming(event)) out.push({ invite, event });
  }
  return out;
}
export const ownedUpcoming = (owner: string) => owned(owner, (i) => i.state === "sent");

export async function handOverPlan(owner: string) {
  const [list, successor] = await Promise.all([ownedUpcoming(owner), successorFor(owner)]);
  const name = successor ? (await store.getEmployee(successor))?.name || successor : null;
  return { upcoming: list.length, successor, successorName: name };
}

// Moves one invite to `successor`: copy (same guests and answers, no emails), then remove the old one
// quietly. Any doubt about either step is settled by asking Google, so nobody ends up with two copies.
async function moveInvite(invite: EventInviteRow, from: Access, successor: string) {
  if (!from.ok) return false;
  const event = await store.getEvent(invite.eventId); // re-read: an edit may have landed meanwhile
  if (!upcoming(event)) return false;
  const to = await accessFor(successor);
  if (!to.ok) return false;
  const current = await google(from.token, "GET", `/${invite.googleId}`, null);
  if (current.status !== 200 || !current.data) return false;
  const generation = invite.generation + 1;
  const id = googleEventId(event.id, generation);
  const guests = mergeGuests((current.data.attendees as Guest[] | undefined) ?? [], await guestsFor(successor));
  let copy = await google(to.token, "POST", "", "none", googleEventBody(event, id, guests));
  if (copy.status === 409) copy = await google(to.token, "PATCH", `/${id}`, "none", { ...googleEventBody(event, id, guests), id: undefined, status: "confirmed" });
  if (!ok2xx(copy.status)) {
    await google(to.token, "DELETE", `/${id}`, "none"); // it may have landed anyway
    return false;
  }
  const removed = await google(from.token, "DELETE", `/${invite.googleId}`, "none");
  if (!(ok2xx(removed.status) || gone(removed)) && !gone(await google(from.token, "GET", `/${invite.googleId}`, null))) {
    await google(to.token, "DELETE", `/${id}`, "none");
    return false;
  }
  await record({ eventId: event.id, owner: successor, googleId: id, generation, state: "sent", error: null });
  return true;
}

// Hands over (or orphans) this admin's upcoming invites, clears up any that may have half-landed,
// revokes the grant at Google, and forgets it. Without the key nothing can be revoked, so the row stays.
export async function retireCalendar(owner: string) {
  if (!tokenKey()) return { moved: 0, orphaned: 0, revoked: false };
  const row = await store.getCalendarToken(owner);
  const sent = await ownedUpcoming(owner);
  const pending = await owned(owner, (i) => i.state === "failed" && mayExist(i));
  let moved = 0, orphaned = 0;
  const from = sent.length || pending.length ? await accessFor(owner) : null;
  if (sent.length) {
    const successor = await successorFor(owner);
    for (const { invite } of sent) {
      if (successor && (await moveInvite(invite, from!, successor))) moved++;
      else { orphaned++; await record({ ...invite, state: "orphaned", error: "organizer-gone" }); }
    }
  }
  // Invites that may have landed in this calendar: take them out quietly so another admin can send
  // them fresh; if that can't be done, they're orphaned (never sent a second time). The fresh send
  // gets the next generation's id: the old id may still sit in guests' calendars as a cancelled
  // copy, and reusing it would 409 and patch that copy instead of creating the new admin's event.
  for (const { invite } of pending) {
    const res = from?.ok ? await google(from.token, "DELETE", `/${invite.googleId}`, "none") : null;
    if (res && (ok2xx(res.status) || gone(res))) {
      const generation = invite.generation + 1;
      await record({ ...invite, googleId: googleEventId(invite.eventId, generation), generation, state: "failed", error: "unsent:organizer-gone" });
    }
    else { orphaned++; await record({ ...invite, state: "orphaned", error: "organizer-gone" }); }
  }
  // Re-read: a dead grant may already have been forgotten above.
  const still = (await store.getCalendarToken(owner)) ?? row;
  let revoked = !still;
  if (still) {
    const refresh = unsealToken(owner, still);
    revoked = refresh ? await revokeGrant(refresh) : false;
    await store.deleteCalendarToken(owner);
  }
  return { moved, orphaned, revoked };
}
