import { describe, expect, it } from "vitest";
import { ACCOUNT_MENU, activeNav, isDuoRoute, navFor } from "@/lib/nav";

describe("new shell navigation", () => {
  it("knows which routes are already in the new design", () => {
    expect(isDuoRoute("/notifications")).toBe(true);
    expect(isDuoRoute("/notifications/anything")).toBe(true);
    expect(isDuoRoute("/notificationsx")).toBe(false);
    expect(isDuoRoute("/")).toBe(true);
    expect(isDuoRoute("/board")).toBe(false);
    expect(isDuoRoute("/attendance")).toBe(false);
    expect(isDuoRoute("/days")).toBe(true);
  });

  it("phone bar: Home stays lit for the screens it owns", () => {
    expect(activeNav("/", "bar")).toBe("home");
    expect(activeNav("/notifications", "bar")).toBe("home");
    expect(activeNav("/steps", "bar")).toBe("home");
    expect(activeNav("/attendance", "bar")).toBe("days");
    expect(activeNav("/grievances", "bar")).toBe("account");
    expect(activeNav("/wifi", "bar")).toBe("account");
  });

  it("sidebar: steps has its own item, and account pages light nothing", () => {
    expect(activeNav("/steps", "side")).toBe("steps");
    expect(activeNav("/notifications", "side")).toBe("home");
    expect(activeNav("/settings", "side")).toBeNull();
  });

  it("only links to screens that exist today", () => {
    const hrefs = [...navFor("bar"), ...navFor("side")].map((n) => n.href);
    expect(hrefs).not.toContain("/snacks");
    expect(hrefs).not.toContain("/reading");
    expect(navFor("bar").map((n) => n.label)).toEqual(["Home", "Feed", "Days", "Account"]);
    expect(navFor("side").map((n) => n.label)).toEqual(["Home", "Feed", "Days", "10K steps"]);
  });

  it("never offers Admin in the account menu to a member", () => {
    expect(ACCOUNT_MENU(false).map((m) => m.label)).toEqual(["Settings", "Speak up", "Wi-Fi check", "Help"]);
    expect(ACCOUNT_MENU(true).map((m) => m.label)).toContain("Admin");
  });
});
