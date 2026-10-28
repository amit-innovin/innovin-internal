import { toast } from "sonner";

// A tiny client-side cache so revisiting a tab paints instantly instead of re-skeletoning.
// Entries serve for TTL_MS; anything older refetches. In-flight requests are shared so the
// two mounted notification bells (desktop + mobile) and back-to-back mounts fetch once.
const TTL_MS = 15_000;
const cache = new Map<string, { data: unknown; at: number }>();
const pending = new Map<string, Promise<unknown>>();
let generation = 0;

const pathOf = (url: string) => url.split("?")[0];

// Drop cached GETs whose path matches (query variants included — /api/snacks clears
// scope=mine and scope=history). send() calls this after every successful mutation.
export function invalidate(urlPrefix: string) {
  generation++;
  for (const key of cache.keys()) if (pathOf(key).startsWith(urlPrefix) || key.startsWith(urlPrefix)) cache.delete(key);
  for (const key of pending.keys()) if (pathOf(key).startsWith(urlPrefix) || key.startsWith(urlPrefix)) pending.delete(key);
}

async function request<T>(url: string, what: string): Promise<T | null> {
  let p = pending.get(url) as Promise<T | null> | undefined;
  if (!p) {
    p = fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) })
      .then(async (res) => {
        if (!res.ok) {
          if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("innovin:load-failure", { detail: { url, status: res.status } }));
          throw new Error(String(res.status));
        }
        return (await res.json()) as T;
      })
      .catch(() => {
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("innovin:load-failure", { detail: { url } }));
        toast.error(`Couldn't load ${what}. Check your connection and try again.`, { id: `load-${url}` });
        return null;
      })
      .finally(() => { if (pending.get(url) === p) pending.delete(url); });
    pending.set(url, p);
  }
  return p;
}

// Client-side GET that surfaces failures instead of leaving a page on its skeleton forever.
// Serves the cached copy when it's fresh; pass { fresh: true } to force a refetch.
export async function getJSON<T>(url: string, what: string, opts: { fresh?: boolean } = {}): Promise<T | null> {
  const hit = cache.get(url);
  if (!opts.fresh && hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
  const started = generation;
  const data = await request<T>(url, what);
  // A mutation (including sign-out) may have completed while this GET was in flight.
  // Refetch instead of rendering or caching a response from the old state/identity.
  if (started !== generation) return getJSON<T>(url, what, { fresh: true });
  if (data !== null) cache.set(url, { data, at: Date.now() });
  return data;
}

// Human-readable error for a failed response, even when the body isn't JSON (e.g. a 502 page).
export async function readError(res: Response) {
  try {
    const body = await res.json();
    if (typeof body?.error === "string" && body.error) return body.error as string;
  } catch {}
  if (res.status === 429) return "Too many requests — please try again shortly.";
  if (res.status >= 500) return "Something went wrong on our side. Please try again.";
  return "That didn't work. Please try again.";
}

// fetch that never throws: network failures come back as a synthetic 503 response.
// Successful mutations invalidate their own GET cache — and the notification feed, since
// pings, leave, grievances and announcements all surface there.
export async function send(url: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, ...rest } = init;
  try {
    const res = await fetch(url, {
      ...rest,
      ...(json !== undefined && {
        headers: { "Content-Type": "application/json", ...rest.headers },
        body: JSON.stringify(json),
      }),
    });
    if (res.ok && (rest.method ?? "GET").toUpperCase() !== "GET") {
      invalidate(pathOf(url));
      invalidate("/api/notifications");
      invalidate("/api/workspace");
      // Leave balances are derived from away requests; their URL differs from the write.
      if (["/api/snacks","/api/pantry-shop"].includes(pathOf(url))) { invalidate("/api/snacks"); invalidate("/api/pantry-shop"); }
      if(pathOf(url)==="/api/pantry-provider")invalidate("/api/pantry-shop");
      if (pathOf(url) === "/api/away") { invalidate("/api/leave"); invalidate("/api/attendance"); }
      if (["/api/workspace", "/api/attendance"].includes(pathOf(url))) { invalidate("/api/attendance"); invalidate("/api/people"); invalidate("/api/snacks"); }
      if (pathOf(url).startsWith("/api/auth/") || (pathOf(url) === "/api/attendance" && rest.method === "DELETE")) invalidate("");
    }
    return res;
  } catch {
    return new Response(JSON.stringify({ error: "You appear to be offline. Check your connection." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
