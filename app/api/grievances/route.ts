import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { DEVICE_COOKIE, GRIEVANCE_IDS_COOKIE, longLivedCookie } from "@/lib/cookies";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { sendPush } from "@/lib/push";
import { id, store } from "@/lib/store";
import { grievanceIdsFromCookie, grievancesFromIds, setSubmitterCookie, submitterIdentity } from "@/lib/submitter";
import type { GrievanceStatus } from "@/lib/types";

const STATUSES: GrievanceStatus[] = ["open", "in_progress", "resolved"];

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
    createdAt: new Date().toISOString(),
  });

  // Urgent goes straight to admins' devices — that's the whole point of the flag. The push
  // carries no id or link to the submitter, so this doesn't touch anonymity.
  if (urgent) {
    const admins = (await store.listEmployees()).filter((e) => e.role === "admin" || e.role === "owner");
    await Promise.all(
      admins.map((a) =>
        sendPush({ title: "Urgent report just came in", body: "Someone marked a report urgent — worth a look.", href: "/admin?tab=approvals", tag: "urgent-report" }, a.email).catch(() => {}),
      ),
    );
  }
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
  const status = body?.status as GrievanceStatus;
  if (!gid || !STATUSES.includes(status)) return badRequest("Invalid status update");
  const updated = await store.setGrievanceStatus(gid, status);
  return updated
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Grievance not found" }, { status: 404 });
}
