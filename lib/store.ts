import crypto from "crypto";
import type { Store } from "./types";
import { jsonStore } from "./jsonstore";
import { pgStore } from "./pgstore";

// Postgres when DATABASE_URL is set (deployed), JSON file otherwise (local dev).
export const store: Store = process.env.DATABASE_URL ? pgStore : jsonStore;

export function submitterRef(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "local";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export const id = () => crypto.randomUUID();
