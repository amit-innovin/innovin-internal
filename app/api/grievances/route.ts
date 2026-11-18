import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { DEVICE_COOKIE, GRIEVANCE_IDS_COOKIE, longLivedCookie } from "@/lib/cookies";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { grievanceIdsFromCookie, grievancesFromIds, setSubmitterCookie, submitterIdentity } from "@/lib/submitter";
import { todayIST } from "@/lib/time";
import type { GrievanceStatus } from "@/lib/types";

const STATUSES: GrievanceStatus[] = ["open", "in_progress", "resolved"];
const TOPICS = ["Workplace", "People", "Facilities", "Process", "Something else"];

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("scope") === "mine") {
    return NextResponse.json(await grievancesFromIds(grievanceIdsFromCookie(req.cookies.get(GRIEVANCE_IDS_COOKIE)?.value), 20));
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await store.listGrievances();
  // Never leak submitterRef to clients — anonymous means anonymous.
  return NextResponse.json(rows.map(({ submitterRef: _r, ...rest }) => rest));
}

export async function POST(req: NextRequest) {
  const identity = submitterIdentity(req);
  const limited = enforce([
    ["grievanceDevice", identity.ref],
    ["grievanceIp", clientIp(req)],
  ]);
  if (limited) return limited;

  const body = await readJSON(req);
  if (!body) return badRequest();
  const text = str(body.body).trim();
  if (!text) return badRequest("Tell us what's on your mind");
  const topic = body.topic === undefined || body.topic === null || body.topic === "" ? null : str(body.topic);
  if (topic !== null && !TOPICS.includes(topic)) return badRequest("Pick one of the topics");

  // Optional photo, stored as a data URL (browser already compressed it).
  const image = str(body.image);
  if (image && (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 700_000)) {
    return badRequest("Attach a photo under ~500 KB");
  }

  const urgent = body.urgent === true;
  const { submitterRef: _r, ...row } = await store.addGrievance({
    id: id(),
    body: text.slice(0, 2000),
    displayName: str(body.displayName).trim().slice(0, 100) || null,
    image: image || null,
    urgent,
    // "anon" — even if the caller passed a ref, the store forces this constant.
    submitterRef: "anon",
    status: "open",
    // The day only (midnight, office time): a time of day could be matched against check-ins.
    createdAt: new Date(`${todayIST()}T00:00:00+05:30`).toISOString(),
    topic,
    reply: null,
  });

  // No push on submit (not even for old clients' "urgent"): an alert at the exact moment would let an
  // admin match the message to who was around then, undoing the day-only date.
  const res = NextResponse.json(row);
  setSubmitterCookie(res, identity.deviceId);
  // Remember this submission's id on the device itself — that's the only record of "mine".
  const ids = [row.id, ...grievanceIdsFromCookie(req.cookies.get(GRIEVANCE_IDS_COOKIE)?.value)].slice(0, 50);
  res.cookies.set(GRIEVANCE_IDS_COOKIE, JSON.stringify(ids), longLivedCookie);
  return res;
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await readJSON(req);
  const gid = str(body?.id);
  // { id, status } and/or { id, reply }. A reply shows only on the device that sent the message.
  const status = body?.status as GrievanceStatus | undefined;
  const reply = body?.reply === undefined ? undefined : body.reply === null ? null : str(body.reply).trim().slice(0, 1000) || null;
  if (!gid || (status === undefined && reply === undefined) || (status !== undefined && !STATUSES.includes(status))) return badRequest("Invalid status update");
  let updated = true;
  if (status !== undefined) updated = await store.setGrievanceStatus(gid, status);
  if (updated && reply !== undefined) updated = await store.setGrievanceReply(gid, reply);
  return updated
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Grievance not found" }, { status: 404 });
}
