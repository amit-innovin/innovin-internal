import { NextResponse } from "next/server";

export type Body = Record<string, unknown>;

// Parses a JSON object body; malformed or non-object bodies yield null instead of throwing.
export async function readJSON(req: Request): Promise<Body | null> {
  try {
    const body: unknown = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Body) : null;
  } catch {
    return null;
  }
}

export const badRequest = (error = "Invalid request body") => NextResponse.json({ error }, { status: 400 });

export const tooMany = (retryAfterSec: number, error = "Too many requests — please try again shortly") =>
  NextResponse.json({ error }, { status: 429, headers: { "Retry-After": String(retryAfterSec) } });

export const str = (value: unknown) => (typeof value === "string" ? value : "");

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
