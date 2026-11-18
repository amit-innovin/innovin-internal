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

async function revoke(token: string) {
  const res = await fetch(revokeEndpoint(), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) }).catch(() => null);
  return !!res?.ok;
}

// --- Talking to Google -------------------------------------------------------------------------

type Access = { ok: true; token: string } | { ok: false; reason: "not-connected" | "dead" | "error" };

// A fresh access token for this admin. A dead grant (revoked, password changed, key rotated) is
// forgotten on the spot, so the admin is asked to reconnect instead of failing on every publish.
async function accessFor(email: string): Promise<Access> {
  const row = await store.getCalendarToken(email);
  if (!row) return { ok: false, reason: "not-connected" };
  const refresh = unsealToken(email, row);
  if (!refresh) {
    await store.deleteCalendarToken(email);
    return { ok: false, reason: "dead" };
  }
  const res = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: refresh, grant_type: "refresh_token" }),
  }).catch(() => null);
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
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  if (!res) return { status: 0, data: null as Record<string, unknown> | null };
  const data = res.status === 204 ? null : ((await res.json().catch(() => null)) as Record<string, unknown> | null);
  return { status: res.status, data };
}

const guestsFor = async (organizer: string) => guestList(await store.listEmployees(), organizer, allowedEmailDomains());
const upcoming = (e: EventRow | null): e is EventRow => !!e && !e.cancelledAt && Date.parse(e.startsAt) > Date.now();

async function record(row: Omit<EventInviteRow, "updatedAt">) {
  const full = { ...row, updatedAt: new Date().toISOString() };
  await store.setEventInvite(full);
  return full;
}

// --- Invites -------------------------------------------------------------------------------------

// Sends (or re-sends) the invite for one event from `owner`'s calendar. Idempotent: the Google id is
// fixed by (event, generation), so a second call updates the same event instead of inviting twice.
export async function sendInvite(event: EventRow, owner: string): Promise<EventInviteRow> {
  const previous = await store.getEventInvite(event.id);
  // An orphaned invite still sits in people's calendars; a fresh one would be a duplicate.
  if (previous?.state === "orphaned") return previous;
  const generation = previous?.generation ?? 0;
  const id = previous?.googleId ?? googleEventId(event.id, generation);
  // Back to the same calendar after a Google error (that try may have landed; the id makes it a 409),
  // or to this admin's when there was no connection to use.
  const sender = previous && (previous.state === "sent" || previous.error === "google") ? previous.owner : owner;
  const access = await accessFor(sender);
  if (!access.ok) return record({ eventId: event.id, owner: sender, googleId: id, generation, state: "failed", error: access.reason });
  const guests = await guestsFor(sender);
  const inserted = await google(access.token, "POST", "", "all", googleEventBody(event, id, mergeGuests([], guests)));
  if (inserted.status === 409) {
    // Already there (an earlier try landed): bring it up to date, keeping guests' answers.
    const ok = await patchEvent(access.token, id, event, guests, "all");
    return record({ eventId: event.id, owner: sender, googleId: id, generation, state: ok ? "sent" : "failed", error: ok ? null : "google" });
  }
  const ok = inserted.status >= 200 && inserted.status < 300;
  return record({ eventId: event.id, owner: sender, googleId: id, generation, state: ok ? "sent" : "failed", error: ok ? null : "google" });
}

async function patchEvent(token: string, id: string, event: EventRow | null, guests: string[], sendUpdates: "all" | "none") {
  const current = await google(token, "GET", `/${id}`, null);
  if (current.status !== 200 || !current.data) return false;
  const attendees = mergeGuests((current.data.attendees as Guest[] | undefined) ?? [], guests);
  const body = event ? { ...googleEventBody(event, id, attendees), id: undefined } : { attendees };
  const res = await google(token, "PATCH", `/${id}`, sendUpdates, body);
  return res.status >= 200 && res.status < 300;
}

// After an edit in the app: the invite follows, and guests are told.
export async function updateInvite(event: EventRow) {
  const invite = await store.getEventInvite(event.id);
  if (!invite || invite.state !== "sent") return invite;
  const access = await accessFor(invite.owner);
  if (!access.ok) return record({ ...invite, state: "orphaned", error: access.reason });
  const ok = await patchEvent(access.token, invite.googleId, event, await guestsFor(invite.owner), "all");
  return ok ? invite : record({ ...invite, state: "failed", error: "google" });
}

// Cancel tells guests (Google emails them); Delete removes the invite quietly, like the app's Delete.
export async function removeInvite(eventId: string, tell: boolean) {
  const invite = await store.getEventInvite(eventId);
  if (!invite) return;
  if (invite.state === "sent") {
    const access = await accessFor(invite.owner);
    if (access.ok) {
      const res = await google(access.token, "DELETE", `/${invite.googleId}`, tell ? "all" : "none");
      if (res.status === 204 || res.status === 200 || res.status === 404 || res.status === 410) {
        await store.deleteEventInvite(eventId);
        return;
      }
    }
    await record({ ...invite, state: "orphaned", error: access.ok ? "google" : access.reason });
    return;
  }
  await store.deleteEventInvite(eventId);
}

// Someone joined or left: every upcoming invite gets the current guest list, without emails.
// Guests already on it keep their answers.
export async function refreshGuests() {
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

export async function ownedUpcoming(owner: string) {
  const invites = (await store.listEventInvites()).filter((i) => i.owner === owner && i.state === "sent");
  const out: { invite: EventInviteRow; event: EventRow }[] = [];
  for (const invite of invites) {
    const event = await store.getEvent(invite.eventId);
    if (upcoming(event)) out.push({ invite, event });
  }
  return out;
}

export async function handOverPlan(owner: string) {
  const [owned, successor] = await Promise.all([ownedUpcoming(owner), successorFor(owner)]);
  const name = successor ? (await store.getEmployee(successor))?.name || successor : null;
  return { upcoming: owned.length, successor, successorName: name };
}

// Moves one invite to `successor`: copy (same guests and answers, no emails), then remove the old one
// quietly. If the old one can't be removed, the copy is taken back, so nobody ends up with two.
async function moveInvite(invite: EventInviteRow, event: EventRow, from: Access, successor: string) {
  if (!from.ok) return false;
  const to = await accessFor(successor);
  if (!to.ok) return false;
  const current = await google(from.token, "GET", `/${invite.googleId}`, null);
  if (current.status !== 200 || !current.data) return false;
  const generation = invite.generation + 1;
  const id = googleEventId(event.id, generation);
  const guests = mergeGuests((current.data.attendees as Guest[] | undefined) ?? [], await guestsFor(successor));
  const copy = await google(to.token, "POST", "", "none", googleEventBody(event, id, guests));
  if (!(copy.status >= 200 && copy.status < 300) && copy.status !== 409) return false;
  const removed = await google(from.token, "DELETE", `/${invite.googleId}`, "none");
  if (!(removed.status === 204 || removed.status === 200 || removed.status === 404 || removed.status === 410)) {
    await google(to.token, "DELETE", `/${id}`, "none");
    return false;
  }
  await record({ eventId: event.id, owner: successor, googleId: id, generation, state: "sent", error: null });
  return true;
}

// Hands over or orphans this admin's upcoming invites, revokes the grant at Google, and forgets it.
export async function retireCalendar(owner: string) {
  const row = await store.getCalendarToken(owner);
  const owned = await ownedUpcoming(owner);
  let moved = 0, orphaned = 0;
  if (owned.length) {
    const from = await accessFor(owner);
    const successor = await successorFor(owner);
    for (const { invite, event } of owned) {
      if (successor && (await moveInvite(invite, event, from, successor))) moved++;
      else { orphaned++; await record({ ...invite, state: "orphaned", error: "organizer-gone" }); }
    }
  }
  // Re-read: a dead grant may already have been forgotten above.
  const still = (await store.getCalendarToken(owner)) ?? row;
  let revoked = !still;
  if (still) {
    const refresh = unsealToken(owner, still);
    revoked = refresh ? await revoke(refresh) : false;
    await store.deleteCalendarToken(owner);
  }
  return { moved, orphaned, revoked };
}
