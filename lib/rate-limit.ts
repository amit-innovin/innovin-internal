// Fixed-window in-memory rate limiter. On serverless each warm instance keeps its own
// counters, which still blunts brute force and spam; swap for a shared store (e.g. Redis)
// if the app ever needs strict global limits.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type LimitResult = { ok: boolean; retryAfter: number };

function bucket(key: string, windowMs: number, now: number) {
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  return b;
}

const result = (b: Bucket, max: number, now: number): LimitResult => ({
  ok: b.count <= max,
  retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
});

// Counts this call and reports whether the caller is still within `max` per window.
export function hit(key: string, max: number, windowMs: number, now = Date.now()): LimitResult {
  const b = bucket(key, windowMs, now);
  b.count++;
  return result(b, max, now);
}

// Checks without counting (e.g. only failed logins should count).
export function peek(key: string, max: number, windowMs: number, now = Date.now()): LimitResult {
  const b = bucket(key, windowMs, now);
  return { ok: b.count < max, retryAfter: result(b, max, now).retryAfter };
}

export function reset(key: string) {
  buckets.delete(key);
}

export function resetAll() {
  buckets.clear();
}
