import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/auth";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON } from "@/lib/http";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
const signIn = () => NextResponse.json({ error: "Sign in with your Innovin Google account" }, { status: 401 });
const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const validDayMonth = (v: string) => MMDD.test(v) && !Number.isNaN(Date.parse(`2024-${v}T00:00:00Z`)) && new Date(`2024-${v}T00:00:00Z`).toISOString().slice(5, 10) === v;

async function view(email: string) {
  const me = await store.getEmployee(email);
  return { email, name: me?.name ?? email, role: me?.role ?? "member", birthday: me?.birthday ?? null, showBirthday: me?.showBirthday ?? false, officeDays: me?.officeDays ?? [], sayHi: me?.sayHi ?? false };
}

export async function GET(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  return NextResponse.json(await view(session.email));
}

// { birthday: "MM-DD" | null, showBirthday: boolean } — day and month only, never a year.
export async function PATCH(req: NextRequest) {
  const session = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!session) return signIn();
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  if (!body || typeof body.showBirthday !== "boolean" || !(body.birthday === null || (typeof body.birthday === "string" && validDayMonth(body.birthday)))) return badRequest("Give your birthday as day and month");
  if (!(await store.setBirthday(session.email, body.birthday as string | null, body.birthday === null ? false : body.showBirthday))) return NextResponse.json({ error: "Sign in again to change your settings" }, { status: 404 });
  return NextResponse.json(await view(session.email));
}
