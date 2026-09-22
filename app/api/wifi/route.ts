import { NextResponse } from "next/server";
import { add, id, list } from "@/lib/store";

export async function GET() {
  return NextResponse.json((await list("wifi")).slice(0, 50));
}

export async function POST(req: Request) {
  const { quality, note, downMbps, upMbps } = await req.json();
  if (quality !== "good" && quality !== "poor") {
    return NextResponse.json({ error: "quality must be good or poor" }, { status: 400 });
  }

  return NextResponse.json(
    await add("wifi", {
      id: id(),
      quality,
      note: (note || "").slice(0, 500),
      downMbps: downMbps ?? null,
      upMbps: upMbps ?? null,
      createdAt: new Date().toISOString(),
    }),
  );
}
