import { toast } from "sonner";

// Client-side GET that surfaces failures instead of leaving a page on its skeleton forever.
export async function getJSON<T>(url: string, what: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  } catch {
    toast.error(`Couldn't load ${what}. Check your connection and try again.`, { id: `load-${url}` });
    return null;
  }
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
export async function send(url: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, ...rest } = init;
  try {
    return await fetch(url, {
      ...rest,
      ...(json !== undefined && {
        headers: { "Content-Type": "application/json", ...rest.headers },
        body: JSON.stringify(json),
      }),
    });
  } catch {
    return new Response(JSON.stringify({ error: "You appear to be offline. Check your connection." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
