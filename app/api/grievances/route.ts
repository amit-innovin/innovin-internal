import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { id, store, submitterRef } from "@/lib/store";
import type { GrievanceStatus } from "@/lib/types";

const STATUSES: GrievanceStatus[] = ["open", "in_progress", "resolved"];

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await store.listGrievances();
  // Never leak submitterRef to clients — anonymous means anonymous.
  return NextResponse.json(rows.map(({ submitterRef: _r, ...rest }) => rest));
}

export async function POST(req: Request) {
  const { body, displayName } = await req.json();
  if (!body?.trim()) {
    return NextResponse.json({ error: "Tell us what's on your mind" }, { status: 400 });
  }

  const { submitterRef: _r, ...row } = await store.addGrievance({
    id: id(),
    body: body.trim().slice(0, 2000),
    displayName: displayName?.trim() || null,
    submitterRef: submitterRef(req),
    status: "open",
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json(row);
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: gid, status } = await req.json();
  if (!gid || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status update" }, { status: 400 });
  }
  await store.setGrievanceStatus(gid, status);
  return NextResponse.json({ ok: true });
}
