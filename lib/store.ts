import crypto from "crypto";
import type { Store } from "./types";
import { jsonStore } from "./jsonstore";
import { pgStore } from "./pgstore";

// Serverless hosts have a read-only, ephemeral filesystem: the JSON file store would lose data or
// fail on write. Refuse loudly instead of pretending to work.
const misconfigured = new Proxy({} as Store, {
  get() {
    return () =>
      Promise.reject(new Error("DATABASE_URL is not set. Configure Postgres (e.g. Supabase) for deployed environments."));
  },
});

// Postgres when DATABASE_URL is set; JSON file for local development otherwise.
export const store: Store = process.env.DATABASE_URL ? pgStore : process.env.VERCEL ? misconfigured : jsonStore;

export const id = () => crypto.randomUUID();
