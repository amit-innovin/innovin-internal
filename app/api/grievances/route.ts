import { NextResponse } from "next/server";
import { add, id, list, submitterRef } from "@/lib/store";

export async function GET() {
  const rows = await list("grievances");
  // Never leak submitterRef to clients — anonymous means anonymous.
  return NextResponse.json(rows.map(({ submitterRef: _r, ...rest }) => rest));
}

export async function POST(req: Request) {
  const { body, displayName } = await req.json();
  if (!body?.trim()) {
    return NextResponse.json({ error: "Tell us what's on your mind" }, { status: 400 });
  }

  const { submitterRef: _r, ...row } = await add("grievances", {
    id: id(),
    body: body.trim().slice(0, 2000),
    displayName: displayName?.trim() || null,
    submitterRef: submitterRef(req),
    status: "open",
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json(row);
}
