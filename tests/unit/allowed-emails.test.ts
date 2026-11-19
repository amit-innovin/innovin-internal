import { afterEach, describe, expect, it } from "vitest";
import { isAllowedEmail } from "@/lib/config";

describe("sign-in allowlist", () => {
  const saved = { domains: process.env.ALLOWED_EMAIL_DOMAINS, emails: process.env.ALLOWED_EMAILS };
  afterEach(() => { process.env.ALLOWED_EMAIL_DOMAINS = saved.domains; process.env.ALLOWED_EMAILS = saved.emails; });

  it("lets company addresses in and keeps other domains out", () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "innovinlabs.com";
    delete process.env.ALLOWED_EMAILS;
    expect(isAllowedEmail("asha@innovinlabs.com")).toBe(true);
    expect(isAllowedEmail("someone@gmail.com")).toBe(false);
  });

  it("lets a listed outside address in, whatever its case, and nobody else on that domain", () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "innovinlabs.com";
    process.env.ALLOWED_EMAILS = " guest.person@gmail.com , other@example.org";
    expect(isAllowedEmail("Guest.Person@Gmail.com")).toBe(true);
    expect(isAllowedEmail("other@example.org")).toBe(true);
    expect(isAllowedEmail("someone@gmail.com")).toBe(false);
    expect(isAllowedEmail("")).toBe(false);
  });
});
