import { NextRequest, NextResponse } from "next/server";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { inOfficeToday } from "@/lib/snack-times";
import { setSubmitterCookie, submitterIdentity } from "@/lib/submitter";
import { todayIST } from "@/lib/time";

const AREAS = ["Desk area", "Meeting room", "Pantry", "Balcony"];

const speed = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 100_000 ? v : undefined);

export async function GET() {
  return NextResponse.json(await store.listWifi(50));
}

// A report about the office Wi-Fi: only from someone checked in at the office today. The row
// itself still records no identity, only the result and where in the office.
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  const identity = submitterIdentity(req);
  const limited = enforce([
    ["wifiDevice", identity.ref],
    ["wifiIp", clientIp(req)],
  ]);
  if (limited) return limited;

  const body = await readJSON(req);
  if (!body) return badRequest();
  const { quality, downMbps, upMbps } = body;
  if (quality !== "good" && quality !== "poor") return badRequest("quality must be good or poor");
  if ((downMbps != null && speed(downMbps) === undefined) || (upMbps != null && speed(upMbps) === undefined)) {
    return badRequest("Speeds must be positive numbers");
  }
  const area = body.area === undefined || body.area === null ? null : str(body.area);
  if (area !== null && !AREAS.includes(area)) return badRequest("Pick where you're sitting");
  if (!(await inOfficeToday(session.email, todayIST()))) return NextResponse.json({ error: "Check in to report office Wi-Fi problems.", code: "not-in-office" }, { status: 403 });

  const res = NextResponse.json(
    await store.addWifi({
      id: id(),
      quality,
      note: str(body.note).trim().slice(0, 500),
      downMbps: speed(downMbps) ?? null,
      upMbps: speed(upMbps) ?? null,
      createdAt: new Date().toISOString(),
      area,
    }),
  );
  setSubmitterCookie(res, identity.deviceId);
  return res;
}
