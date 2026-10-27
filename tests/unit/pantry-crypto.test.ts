import { afterEach, expect, it, vi } from "vitest";
import { seal, unseal } from "@/lib/pantry/crypto";
afterEach(() => vi.unstubAllEnvs());
it("encrypts provider credentials and rejects tampering, wrong purposes and rotated keys", () => {
  vi.stubEnv("PANTRY_INTEGRATION_KEY", "a".repeat(64));
  const encoded = seal({ accessToken: "private-purchasing-token" }, "record");
  expect(encoded).not.toContain("private-purchasing-token");
  expect(unseal(encoded, "record")).toEqual({ accessToken: "private-purchasing-token" });
  expect(() => unseal(encoded, "oauth")).toThrow();
  expect(() => unseal(encoded.slice(0,-5)+"AAAAA", "record")).toThrow();
  vi.stubEnv("PANTRY_INTEGRATION_KEY", "b".repeat(64));
  expect(() => unseal(encoded, "record")).toThrow();
});
it("refuses to store purchasing credentials under a missing or weak key", () => {
  for (const value of ["", "1704", "not-a-key"]) {
    vi.stubEnv("PANTRY_INTEGRATION_KEY", value);
    expect(() => seal({ refreshToken: "secret" }, "record")).toThrow();
  }
});
it("never creates encrypted records that its reader cannot decode", () => {
  vi.stubEnv("PANTRY_INTEGRATION_KEY", "d".repeat(64));
  const value = { data: "x".repeat(1_000_000) };
  expect(unseal(seal(value,"record"),"record")).toEqual(value);
  expect(() => seal({data:"x".repeat(1_500_000)},"record")).toThrow(/large/);
});
