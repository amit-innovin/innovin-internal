import { NextResponse } from "next/server";
import { currentActor } from "../admin";
import { PantryError } from "./swiggy";
export async function purchasingActor() {
  const actor = await currentActor();
  return actor && (actor.role === "admin" || actor.role === "owner") ? actor : null;
}
export function purchasingError(error: unknown) {
  return NextResponse.json({ error: error instanceof PantryError ? error.message : "Purchasing is unavailable. Reload its saved status before retrying." }, { status: error instanceof PantryError ? error.status === 401 ? 424 : error.status : 503, headers: { "Cache-Control": "no-store" } });
}
