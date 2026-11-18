import { afterEach, describe, expect, it, vi } from "vitest";
import { accountRef, keyedRef } from "@/lib/submitter";

afterEach(() => vi.unstubAllEnvs());

// Anonymous flags (reports, snack picks) are stored against a ref that can't be rebuilt from an
// email without the server's secret: with 45 people, a plain hash is matched to names in seconds.
describe("keyedRef", () => {
  it("depends on the server secret, not just the email", () => {
    vi.stubEnv("SESSION_SECRET", "one");
    const a = keyedRef("report", "Asha@innovinlabs.com");
    expect(a).toBe(keyedRef("report", "asha@innovinlabs.com"));
    expect(a).not.toBe(accountRef("report:asha@innovinlabs.com"));
    vi.stubEnv("SESSION_SECRET", "two");
    expect(keyedRef("report", "asha@innovinlabs.com")).not.toBe(a);
  });
  it("keeps scopes apart", () => {
    vi.stubEnv("SESSION_SECRET", "one");
    expect(keyedRef("report", "a@innovinlabs.com")).not.toBe(keyedRef("snackpick", "a@innovinlabs.com"));
  });
});
