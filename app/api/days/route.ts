import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { daysView, markDay } from "@/lib/days";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON } from "@/lib/http";
import { validOfficeDays } from "@/lib/office-days";
import { store } from "@/lib/store";
import { todayIST, validDate } from "@/lib/time";

export const dynamic = "force-dynamic";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const signIn = () => NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// The caller's own office days: today's mark, the month, the 8-day count and who's around.
export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  const month = req.nextUrl.searchParams.get("month") ?? todayIST().slice(0, 7);
  if (!MONTH.test(month)) return badRequest("Invalid month");
  return NextResponse.json(await daysView(session.email, month));
}

// Marks one of the caller's own days: { mode: "office" | "none", date?, lat?, lng?, accuracyM? }.
// Remote isn't a mark: not coming in means remote.
export async function POST(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  if (!body) return badRequest();
  if (body.mode !== "office" && body.mode !== "none") return badRequest("Choose office or none");
  const date = body.date === undefined ? todayIST() : body.date;
  if (typeof date !== "string" || !validDate(date)) return badRequest("Invalid date");
  const lat = num(body.lat), lng = num(body.lng), accuracyM = num(body.accuracyM);
  if ((lat === null) !== (lng === null) || (lat !== null && (Math.abs(lat) > 90 || Math.abs(lng!) > 180)) || (accuracyM !== null && accuracyM < 0)) return badRequest("Invalid coordinates");

  const result = await markDay({ email: session.email, date, mode: body.mode === "none" ? null : body.mode, lat, lng, accuracyM });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code, distanceM: result.distanceM }, { status: result.status });
  return NextResponse.json(await daysView(session.email, date.slice(0, 7)));
}

// Sets the caller's regular office weekdays: { officeDays: number[] }, Monday = 0.
export async function PATCH(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  if (!body || !validOfficeDays(body.officeDays)) return badRequest("Pick your office days from Monday to Sunday");
  if (!(await store.setOfficeDays(session.email, body.officeDays))) return NextResponse.json({ error: "Sign in again to set your office days" }, { status: 404 });
  return NextResponse.json(await daysView(session.email, todayIST().slice(0, 7)));
}
