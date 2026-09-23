import crypto from "crypto";
import type { Store } from "./types";
import { pgStore } from "./pgstore";

// Serverless hosts have a read-only, ephemeral filesystem: the JSON file store would lose data or
// fail on write. Refuse loudly instead of pretending to work.
const misconfigured = new Proxy({} as Store, {
  get() {
    return () =>
      Promise.reject(new Error("DATABASE_URL is not set. Configure Postgres (e.g. Supabase) for deployed environments."));
  },
});

// The JSON file store is only ever used in local dev. Lazy-importing it keeps it (and its
// dynamic fs access) out of the production serverless bundle entirely.
let jsonStorePromise: Promise<Store> | null = null;
const lazyJsonStore = new Proxy({} as Store, {
  get: (_target, method: keyof Store) => async (...args: unknown[]) => {
    jsonStorePromise ??= import("./jsonstore").then((m) => m.jsonStore);
    const fn = (await jsonStorePromise)[method] as (...a: unknown[]) => unknown;
    return fn(...args);
  },
});

// Postgres when DATABASE_URL is set; JSON file for local development otherwise.
// DATA_FILE wins: e2e servers run the production build, which loads .env (with DATABASE_URL)
// at runtime — an explicit DATA_FILE must force the JSON store so tests never touch prod.
export const store: Store = process.env.DATA_FILE
  ? lazyJsonStore
  : process.env.DATABASE_URL
    ? pgStore
    : process.env.VERCEL
      ? misconfigured
      : lazyJsonStore;

export const id = () => crypto.randomUUID();
