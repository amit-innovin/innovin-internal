import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { DEVICE_COOKIE } from "@/lib/cookies";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { id, store } from "@/lib/store";
import { todayIST } from "@/lib/time";
import { workspaceData } from "@/lib/workspace";
import type { WorkspaceProfile } from "@/lib/types";

export async function GET(req: NextRequest) {
  const user = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
  return NextResponse.json(await workspaceData(user, req.cookies.get(DEVICE_COOKIE)?.value));
}

export async function PATCH(req: NextRequest) {
  const user = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  if (!body) return badRequest();
  const patch: Partial<Omit<WorkspaceProfile, "email">> = {};
  for (const field of ["designation", "department", "project", "floor", "desk", "focus"] as const) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== "string" || str(body[field]).length > 120) return badRequest("Keep profile fields under 120 characters");
      patch[field] = str(body[field]).trim();
    }
  }
  return NextResponse.json(await store.saveWorkspaceProfile(user.email, patch));
}

export async function POST(req: NextRequest) {
  const user = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const mode = body?.mode;
  if (mode !== "office" && mode !== "remote" && mode !== "out") return badRequest("Choose office or remote");
  const today = todayIST();
  if (mode === "out") {
    await store.checkOut(user.email, today, new Date().toISOString());
    await store.saveWorkspaceProfile(user.email, { mode: null, presenceDate: today });
  } else {
    await store.checkIn({ id: id(), email: user.email, date: today, checkInAt: new Date().toISOString(), checkOutAt: null, lat: null, lng: null, accuracyM: null });
    await store.saveWorkspaceProfile(user.email, { mode, presenceDate: today });
  }
  return NextResponse.json({ ok: true });
}
