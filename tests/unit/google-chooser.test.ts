import { describe, expect, it, vi } from "vitest";
import { googleAuthUrl } from "@/lib/google";

describe("Google account selection", () => {
  it("requests an explicit chooser without preselecting an account or filtering the chooser", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client");
    const url = new URL(googleAuthUrl("http://localhost:4172/api/auth/callback", "state"));
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.has("login_hint")).toBe(false);
    expect(url.searchParams.has("hd")).toBe(false);
    vi.unstubAllEnvs();
  });
});
