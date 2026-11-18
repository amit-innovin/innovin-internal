import { afterEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { sealToken, tokenKey, unsealToken } from "@/lib/calendar-crypto";

const KEY = randomBytes(32).toString("base64");
const set = (v?: string) => { if (v === undefined) delete process.env.CALENDAR_TOKEN_KEY; else process.env.CALENDAR_TOKEN_KEY = v; };

describe("calendar token sealing", () => {
  afterEach(() => set());

  it("needs a 32-byte key, as base64 or hex", () => {
    set(); expect(tokenKey()).toBeNull();
    set("short"); expect(tokenKey()).toBeNull();
    set(KEY); expect(tokenKey()?.length).toBe(32);
    set(randomBytes(32).toString("hex")); expect(tokenKey()?.length).toBe(32);
  });

  it("round-trips, and the stored form never contains the token", () => {
    set(KEY);
    const sealed = sealToken("a@innovinlabs.com", "1//refresh-secret")!;
    expect(JSON.stringify(sealed)).not.toContain("refresh-secret");
    expect(unsealToken("a@innovinlabs.com", sealed)).toBe("1//refresh-secret");
    // A fresh IV every time.
    expect(sealToken("a@innovinlabs.com", "1//refresh-secret")!.iv).not.toBe(sealed.iv);
  });

  it("won't open for another admin, a tampered row, or after the key changes", () => {
    set(KEY);
    const sealed = sealToken("a@innovinlabs.com", "1//refresh-secret")!;
    expect(unsealToken("b@innovinlabs.com", sealed)).toBeNull();
    const flipped = Buffer.from(sealed.ciphertext, "base64"); flipped[0] ^= 1;
    expect(unsealToken("a@innovinlabs.com", { ...sealed, ciphertext: flipped.toString("base64") })).toBeNull();
    set(randomBytes(32).toString("base64"));
    expect(unsealToken("a@innovinlabs.com", sealed)).toBeNull();
    set();
    expect(sealToken("a@innovinlabs.com", "x")).toBeNull();
  });
});
