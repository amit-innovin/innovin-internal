import { describe, expect, it } from "vitest";
import { ACCOUNT_MENU, activeAdmin, activeNav, isDuoRoute, navFor, showsSpeakFab } from "@/lib/nav";

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
    expect(activeNav("/feed/events/x", "bar")).toBe("feed");
    expect(activeNav("/account", "bar")).toBe("account");
    expect(activeNav("/grievances", "bar")).toBe("account");
    expect(activeNav("/wifi", "bar")).toBe("account");
  });

  it("sidebar: steps has its own item, and account pages light nothing", () => {
    expect(activeNav("/steps", "side")).toBe("steps");
    expect(activeNav("/notifications", "side")).toBe("home");
    expect(activeNav("/reading", "side")).toBeNull();
    expect(activeNav("/account", "side")).toBeNull();
  });

  it("matches the prototype: five tabs on the phone, five sidebar items, no reading list", () => {
    expect(navFor("bar").map((n) => n.label)).toEqual(["Home", "Feed", "Days", "Snacks", "Account"]);
    expect(navFor("side").map((n) => n.label)).toEqual(["Home", "Feed", "Days", "Tea & snacks", "10K steps"]);
    expect(navFor("bar").find((n) => n.label === "Account")?.href).toBe("/account");
  });

  it("never offers Admin in the account menu to a member", () => {
    // Admins reach Admin from its own sidebar item, so the menu is the same for everyone.
    // Speak up has its own sidebar item and button; Wi-Fi check lives in the Home header.
    expect(ACCOUNT_MENU().map((m) => m.label)).toEqual(["Settings", "Help"]);
  });

  it("shows the Speak up button only on Home, Days, Snacks and Account", () => {
    for (const r of ["/", "/days", "/snacks", "/account"]) expect(showsSpeakFab(r)).toBe(true);
    for (const r of ["/feed", "/feed/events/x", "/grievances", "/wifi", "/notifications", "/steps", "/admin", "/admin/people", "/days/x"]) expect(showsSpeakFab(r)).toBe(false);
  });

  it("admin pages: the old tools screen stays legacy, sub-pages light the right item", () => {
    expect(isDuoRoute("/admin")).toBe(true);
    expect(isDuoRoute("/admin/people")).toBe(true);
    expect(isDuoRoute("/admin/tools")).toBe(false);
    expect(activeAdmin("/admin")).toBe("overview");
    expect(activeAdmin("/admin/today")).toBe("overview");
    expect(activeAdmin("/admin/speak-up")).toBe("speak");
    expect(activeAdmin("/admin/tools")).toBeNull();
    expect(activeNav("/admin/people", "bar")).toBe("account");
  });
});
