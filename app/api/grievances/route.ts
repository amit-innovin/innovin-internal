import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { DEVICE_COOKIE } from "@/lib/cookies";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { grievancesForDevice, setSubmitterCookie, submitterIdentity } from "@/lib/submitter";
import type { GrievanceStatus } from "@/lib/types";

const STATUSES: GrievanceStatus[] = ["open", "in_progress", "resolved"];

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("scope") === "mine") {
    return NextResponse.json(await grievancesForDevice(req.cookies.get(DEVICE_COOKIE)?.value, 20));
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

  const { submitterRef: _r, ...row } = await store.addGrievance({
    id: id(),
    body: text.slice(0, 2000),
    displayName: str(body.displayName).trim().slice(0, 100) || null,
    image: image || null,
    submitterRef: identity.ref,
    status: "open",
    createdAt: new Date().toISOString(),
  });
  const res = NextResponse.json(row);
  setSubmitterCookie(res, identity.deviceId);
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
