import { describe, expect, it } from "vitest";
import { secureAuthCookie } from "@/lib/cookies";

describe("OAuth transport cookies", () => {
  it("allows HTTP loopback previews while preserving Secure on deployed origins", () => {
    expect(secureAuthCookie("http://localhost:5001")).toBe(false);
    expect(secureAuthCookie("http://127.0.0.1:5001")).toBe(false);
    expect(secureAuthCookie("https://localhost:5001")).toBe(true);
    expect(secureAuthCookie("https://internal.innovinlabs.com")).toBe(true);
    expect(secureAuthCookie("http://internal.innovinlabs.com")).toBe(true);
    expect(secureAuthCookie("http://localhost.evil.example")).toBe(true);
  });
});
