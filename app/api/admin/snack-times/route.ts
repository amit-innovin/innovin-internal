import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { enforce } from "@/lib/guard";
import { badRequest, clientIp, readJSON, str } from "@/lib/http";
import { snackTimes } from "@/lib/snack-times";
import { validTimes } from "@/lib/snacks-rules";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

// Admin › Snacks & tea: the two tea rounds, when their answers close, and when the snack order goes in.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await snackTimes());
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = enforce([["writeIp", clientIp(req)]]);
  if (limited) return limited;
  const body = await readJSON(req);
  const times = { amAt: str(body?.amAt), amClose: str(body?.amClose), pmAt: str(body?.pmAt), pmClose: str(body?.pmClose), orderAt: str(body?.orderAt) };
  if (!validTimes(times)) return badRequest("Use HH:MM times, with each round's answers closing before the round");
  await store.setSetting("snackTea", times);
  return NextResponse.json(times);
}
