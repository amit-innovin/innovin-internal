import { describe, expect, it } from "vitest";
import { ACCOUNT_MENU, activeNav, isDuoRoute, navFor } from "@/lib/nav";

describe("new shell navigation", () => {
  it("knows which routes are already in the new design", () => {
    expect(isDuoRoute("/notifications")).toBe(true);
    expect(isDuoRoute("/notifications/anything")).toBe(true);
    expect(isDuoRoute("/notificationsx")).toBe(false);
    expect(isDuoRoute("/")).toBe(true);
    expect(isDuoRoute("/attendance")).toBe(false);
    expect(isDuoRoute("/help")).toBe(false);
    for (const r of ["/days", "/feed", "/feed/events/x", "/snacks", "/steps", "/reading", "/account", "/grievances", "/wifi"]) expect(isDuoRoute(r)).toBe(true);
  });

  it("phone bar: Home stays lit for the screens it owns", () => {
    expect(activeNav("/", "bar")).toBe("home");
    expect(activeNav("/notifications", "bar")).toBe("home");
    expect(activeNav("/steps", "bar")).toBe("home");
    expect(activeNav("/reading", "bar")).toBe("home");
    expect(activeNav("/feed/events/x", "bar")).toBe("feed");
    expect(activeNav("/account", "bar")).toBe("account");
    expect(activeNav("/grievances", "bar")).toBe("account");
    expect(activeNav("/wifi", "bar")).toBe("account");
  });

  it("sidebar: steps has its own item, and account pages light nothing", () => {
    expect(activeNav("/steps", "side")).toBe("steps");
    expect(activeNav("/notifications", "side")).toBe("home");
    expect(activeNav("/reading", "side")).toBe("reading");
    expect(activeNav("/account", "side")).toBeNull();
  });

  it("matches the canvas: five tabs on the phone, six sidebar items", () => {
    expect(navFor("bar").map((n) => n.label)).toEqual(["Home", "Feed", "Days", "Snacks", "Account"]);
    expect(navFor("side").map((n) => n.label)).toEqual(["Home", "Feed", "Days", "Tea & snacks", "10K steps", "Reading list"]);
    expect(navFor("bar").find((n) => n.label === "Account")?.href).toBe("/account");
  });

  it("never offers Admin in the account menu to a member", () => {
    expect(ACCOUNT_MENU(false).map((m) => m.label)).toEqual(["Settings", "Speak up", "Wi-Fi check", "Help"]);
    expect(ACCOUNT_MENU(true).map((m) => m.label)).toContain("Admin");
  });
});
