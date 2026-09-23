import { LIMITS } from "./config";
import { tooMany } from "./http";
import { hit } from "./rate-limit";

type LimitName = keyof typeof LIMITS;

// Applies each [limit, key] pair; returns a 429 response for the first one exceeded.
export function enforce(checks: [LimitName, string][]) {
  for (const [name, key] of checks) {
    const { max, windowMs } = LIMITS[name];
    const r = hit(`${name}:${key}`, max, windowMs);
    if (!r.ok) return tooMany(r.retryAfter);
  }
  return null;
}
