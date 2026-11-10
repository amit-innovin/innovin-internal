import { attendanceHref } from "@/lib/journey";
import { validDate } from "@/lib/time";
import { NextRequest, NextResponse } from "next/server";
import { currentActor, isAdmin } from "@/lib/admin";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { allowedEmailDomains } from "@/lib/config";
import { enforce } from "@/lib/guard";
import { fmtShortDate } from "@/lib/format";
import { isLeaveType, leaveCost, nonWorkingReason } from "@/lib/leave";
import { todayIST } from "@/lib/time";
import { sendPush } from "@/lib/push";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { setSubmitterCookie, submitterIdentity } from "@/lib/submitter";
import type { AwayStatus, AwayType } from "@/lib/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SPAN_DAYS = 92;

const strip = ({ submitterRef: _r, ...rest }: import("@/lib/types").AwayRow) => rest;

const dayDiff = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope");
  if (scope === "mine") {
    const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
    if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
    const rows = await store.listAwayByEmail(session.email, 30);
    return NextResponse.json(rows.map(strip));
  }
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [history, pending] = await Promise.all([store.listAway(100), store.listPendingAway()]);
  const rows = [...pending, ...history.filter(r => r.status !== "pending")];
  return NextResponse.json(rows.map(strip));
}

export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  const identity = submitterIdentity(req);
  const limited = enforce([
    ["awayDevice", identity.ref],
    ["writeIp", clientIp(req)],
  ]);
  if (limited) return limited;

  const body = await readJSON(req);
  if (!body) return badRequest();
  // Only the verified session may identify the requester, including direct API calls.
  const email = session.email;
  const type = body.type as AwayType;
  const startDate = str(body.startDate).trim();
  const endDate = str(body.endDate).trim();
  const reason = str(body.reason).trim().slice(0, 500);
  const halfDay = body.halfDay === true;
  // Leave draws from a specific bucket; WFH doesn't touch a balance at all.
  const leaveType = isLeaveType(body.leaveType) ? body.leaveType : null;

  if (!EMAIL.test(email)) return badRequest("Enter a valid email");
  if (!allowedEmailDomains().includes(email.split("@")[1])) {
    return NextResponse.json({ error: "Use your Innovin email" }, { status: 403 });
  }
  if (type !== "leave" && type !== "wfh") return badRequest("Choose Leave or WFH");
  if (type === "leave" && !leaveType) return badRequest("Choose a leave type");
  if (!validDate(startDate) || !validDate(endDate)) return badRequest("Pick valid dates");
  if (startDate > endDate) return badRequest("Start date can't be after the end date");
  if (dayDiff(startDate, endDate) > MAX_SPAN_DAYS) return badRequest("Requests can span at most 3 months");
  if (halfDay && (startDate !== endDate || leaveType !== "cl")) {
    return badRequest("Half days apply to a single day of Casual Leave");
  }

  // Working days only: Sundays, 2nd/4th Saturdays and declared holidays cost nothing.
  const days = type === "leave" ? leaveCost(startDate, endDate, halfDay) : 0;
  if (type === "leave" && days === 0) {
    const reasonWhy = nonWorkingReason(startDate);
    return badRequest(reasonWhy ? `${fmtShortDate(`${startDate}T00:00:00`)} is a non-working day (${reasonWhy})` : "That range has no working days");
  }

  const { submitterRef: _r, ...row } = await store.addAway({
    id: id(),
    email,
    type,
    leaveType,
    halfDay,
    days,
    startDate,
    endDate,
    reason,
    status: "pending",
    submitterRef: identity.ref,
    decidedBy: null,
    decidedAt: null,
    createdAt: new Date().toISOString(),
  });
  const res = NextResponse.json(row);
  setSubmitterCookie(res, identity.deviceId);
  return res;
}

const notify = (row: { id: string; type: AwayType; startDate: string; email: string }, title: string, email?: string) =>
  sendPush(
    { title, body: fmtShortDate(`${row.startDate}T00:00:00`), href: attendanceHref("leave",undefined,row.id), tag: `away-${row.id}` },
    email ?? row.email,
  ).catch(() => {});

// Two kinds of update:
//   approve/reject — admin only.
//   cancel — the verified requester or an admin, never a remembered browser identity.
//   Cancelling is allowed while pending *or* approved, but only before the dates have passed —
//   past leave is history, and rewriting it would corrupt the balances.
export async function PATCH(req: NextRequest) {
  const body = await readJSON(req);
  const rid = str(body?.id);
  const status = body?.status as AwayStatus;
  if (!rid || !["approved", "rejected", "cancelled"].includes(status)) return badRequest("Invalid status update");

  // Decisions are admin-only and checked before the row exists — anonymous callers get the same
  // 401 regardless of whether the id is real.
  if (status !== "cancelled" && !(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await store.getAway(rid);
  if (!row) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  const actor = await currentActor();

  if (status === "cancelled") {
    const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
    const owns = session?.email === row.email;
    if (!owns && !(await isAdmin())) {
      return NextResponse.json({ error: "Not your request" }, { status: 403 });
    }
    if (row.status === "cancelled") return badRequest("Already cancelled");
    if (row.status !== "pending" && row.status !== "approved") return badRequest("This request was already decided");
    if (row.endDate < todayIST()) return badRequest("That time away has already passed");

    // Attribution: self-cancels show plain "Cancelled"; an admin cancelling for someone is named.
    const decidedBy = owns ? null : actor ? actor.name || actor.email : null;
    if (!await store.setAwayStatus(rid, "cancelled", decidedBy, new Date().toISOString(), row.status)) return NextResponse.json({ error: "This request changed. Refresh and try again." }, { status: 409 });

    const what = row.type === "wfh" ? "Work from home" : "Leave";
    if (owns) {
      // An admin approved this and now it's undone — tell the admins so nobody plans around it.
      if (row.status === "approved") {
        const who = session?.name ?? row.email;
        const admins = (await store.listEmployees()).filter((e) => e.role === "admin");
        await Promise.all(admins.map((a) => notify(row, `${who} cancelled their approved ${what.toLowerCase()}`, a.email)));
      }
    } else {
      await notify(row, `Your ${what.toLowerCase()} was cancelled${decidedBy ? ` by ${decidedBy}` : ""}`);
    }
    return NextResponse.json({ ok: true });
  }

  // Decisions only come out of pending — a rejected or cancelled request is history, and an
  // approved one that needs undoing goes through cancel, not a re-decision.
  if (row.status !== "pending") return badRequest("This request was already decided");
  // Attribute the decision when the admin is a verified identity; break-glass PIN sessions
  // have nobody to attribute it to.
  const decidedBy = actor?.role === "admin" ? actor.name || actor.email : null;
  const updated = await store.setAwayStatus(rid, status, decidedBy, new Date().toISOString(), "pending");
  if (!updated) return NextResponse.json({ error: "This request changed. Refresh and try again." }, { status: 409 });

  // Tell just that person's devices. Best-effort — the decision is already saved.
  const what = row.type === "wfh" ? "Work from home" : "Leave";
  await notify(row, `${what} ${status}${decidedBy ? ` by ${decidedBy}` : ""}`);
  return NextResponse.json({ ok: true });
}
