import { describe, expect, it } from "vitest";
import { ACCOUNT_MENU, activeNav, navFor } from "@/lib/nav";

describe("shell navigation (no sidebar)", () => {
  it("has the same five destinations on every screen size", () => {
    expect(navFor("bar").map((n) => n.label)).toEqual(["Today", "Feed", "Days", "Snacks", "Browse"]);
    expect(navFor("top").map((n) => n.label)).toEqual(["Today", "Feed", "Days", "Tea & snacks", "Browse"]);
    expect(navFor("bar").map((n) => n.href)).toEqual(navFor("top").map((n) => n.href));
  });

  it("lights Today for Home and Notifications", () => {
    expect(activeNav("/")).toBe("today");
    expect(activeNav("/notifications")).toBe("today");
  });

  it("lights the section a detail page belongs to", () => {
    expect(activeNav("/feed/events/x")).toBe("feed");
    expect(activeNav("/days")).toBe("days");
    expect(activeNav("/snacks")).toBe("snacks");
  });

  it("puts everything without a tab under Browse, admin pages included", () => {
    for (const path of ["/browse", "/steps", "/wifi", "/grievances", "/help", "/account", "/admin", "/admin/people"]) expect(activeNav(path)).toBe("browse");
    expect(activeNav("/reading")).toBeNull();
  });

  it("keeps the account menu the same for everyone", () => {
    expect(ACCOUNT_MENU().map((m) => m.label)).toEqual(["Settings", "Help"]);
  });
});
