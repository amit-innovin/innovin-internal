import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { allowedEmailDomains } from "@/lib/config";
import { DEVICE_COOKIE } from "@/lib/cookies";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { setSubmitterCookie, submitterIdentity } from "@/lib/submitter";
import type { AwayStatus, AwayType } from "@/lib/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: AwayStatus[] = ["pending", "approved", "rejected"];
const MAX_SPAN_DAYS = 92;

const strip = ({ submitterRef: _r, ...rest }: import("@/lib/types").AwayRow) => rest;

const dayDiff = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("scope") === "mine") {
    const deviceId = req.cookies.get(DEVICE_COOKIE)?.value;
    if (!deviceId) return NextResponse.json([]);
    const ref = submitterIdentity(req).ref;
    const rows = await store.listAwayByRef(ref, 30);
    return NextResponse.json(rows.map(strip));
  }
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await store.listAway(100);
  return NextResponse.json(rows.map(strip));
}

export async function POST(req: NextRequest) {
  const identity = submitterIdentity(req);
  const limited = enforce([
    ["awayDevice", identity.ref],
    ["writeIp", clientIp(req)],
  ]);
  if (limited) return limited;

  const body = await readJSON(req);
  if (!body) return badRequest();
  // A signed-in Google session wins over a typed email, same as attendance.
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  const email = session?.email ?? str(body.email).trim().toLowerCase().slice(0, 254);
  const type = body.type as AwayType;
  const startDate = str(body.startDate).trim();
  const endDate = str(body.endDate).trim();
  const reason = str(body.reason).trim().slice(0, 500);

  if (!EMAIL.test(email)) return badRequest("Enter a valid email");
  if (!allowedEmailDomains().includes(email.split("@")[1])) {
    return NextResponse.json({ error: "Use your Innovin email" }, { status: 403 });
  }
  if (type !== "leave" && type !== "wfh") return badRequest("Choose Leave or WFH");
  if (!DATE.test(startDate) || !DATE.test(endDate)) return badRequest("Pick valid dates");
  if (startDate > endDate) return badRequest("Start date can't be after the end date");
  if (dayDiff(startDate, endDate) > MAX_SPAN_DAYS) return badRequest("Requests can span at most 3 months");

  const { submitterRef: _r, ...row } = await store.addAway({
    id: id(),
    email,
    type,
    startDate,
    endDate,
    reason,
    status: "pending",
    submitterRef: identity.ref,
    createdAt: new Date().toISOString(),
  });
  const res = NextResponse.json(row);
  setSubmitterCookie(res, identity.deviceId);
  return res;
}

// Admin approves/rejects a request.
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJSON(req);
  const rid = str(body?.id);
  const status = body?.status as AwayStatus;
  if (!rid || !STATUSES.includes(status) || status === "pending") return badRequest("Invalid status update");
  const updated = await store.setAwayStatus(rid, status);
  return updated
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Request not found" }, { status: 404 });
}
