import { ADMIN_EMAIL, expect, test, signInEmployee, signInOffice } from "./fixtures";

test.describe("Navigation & studio shell", () => {
  test("onboarding carries the studio brand and reference Plus Jakarta Sans font", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".brand-name-light")).toContainText("innovin.internal");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Manage your workspace");
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/Jakarta/i);
  });

  test("primary navigation and everyday tools reach each module", async ({ page, isMobile }) => {
    await signInOffice(page);
    const nav = page.getByRole("navigation", { name: isMobile ? "Phone workspace navigation" : "Workspace navigation", exact: true });
    await nav.getByRole("link",{name:"Daily Steps",exact:true}).click();
    await expect(page).toHaveURL(/\/steps$/);
    await expect(nav.getByRole("link",{name:"Daily Steps",exact:true})).toHaveAttribute("aria-current","page");
    await page.getByRole("link",{name:"Attendance & Leave",exact:true}).click();
    await expect(page).toHaveURL(/\/attendance\?tab=leave$/);
    await expect(page.getByRole("heading",{name:"Request time away"})).toBeVisible();
    await page.getByRole("link",{name:"Innovin Internal home"}).click();
    await expect(page).toHaveURL("http://localhost:3210/");
    const more = page.getByRole("navigation", { name: "More workspace tools", exact: true });
    // The phone home screen has no top bar; its wallet links lead into the shell that has one.
    if (isMobile) {
      await page.getByRole("link", { name: "Attendance & leave", exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Attendance" })).toBeVisible();
    }
    for (const [label, heading] of [["Events", "Events"], ["Speak Up", "Speak Up"], ["Wi-Fi", "Wi-Fi Quality"], ["Help", "Help"]]) {
      if (!(await more.isVisible())) await page.locator(".reference-more summary").click();
      await more.getByRole("link", { name: label, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
  });

  test("overview links lead to reporting and settings", async ({ page, isMobile }) => {
    await signInOffice(page);
    await page.goto("/");
    for (const [label, url] of [["Wi-Fi pulse", /wifi/], [isMobile ? "Speak Up" : "Send private feedback", /grievances/], ["Settings", /settings/]] as const) {
      await page.goto("/");
      await page.getByRole("link", { name: new RegExp(label) }).click();
      await expect(page).toHaveURL(url);
    }
  });

  test("support pages remain reachable through the studio shell", async ({ page }) => {
    // An admin, so Settings also links to the dashboard.
    await signInEmployee(page, ADMIN_EMAIL, "/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Admin dashboard/ })).toBeVisible();
    await page.locator(".reference-more summary").click();
    await page.getByRole("navigation", { name: "More workspace tools" }).getByRole("link", { name: "Help", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Is Speak Up really anonymous?" })).toBeVisible();
  });

  test("feature pages use the persistent shell without redundant back links", async ({ page }) => {
    await signInEmployee(page, undefined, "/");
    for (const path of ["/events", "/settings", "/help", "/attendance", "/wifi"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: "Back to home" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Innovin Internal home" })).toBeVisible();
    }
  });

  test("overview reflects saved attendance", async ({ page }) => {
    await signInOffice(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "In office", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("unknown pages show the branded 404 with a way home", async ({ page }) => {
    await signInEmployee(page, undefined, "/");
    const res = await page.goto("/profile");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  // Removed features: their old links (bookmarks, notifications, chat messages) go Home with a
  // temporary redirect — never a 404. The old query string rides along (Next passes it
  // through) and Home ignores it, so the assertion is on the path.
  for (const old of ["/pantry", "/snacks?tab=today", "/planner", "/people?ping=a%40innovinlabs.com", "/admin/pantry"]) {
    test(`old link ${old} lands on Home when signed in`, async ({ page }) => {
      await signInEmployee(page, undefined, "/");
      const res = await page.goto(old);
      expect(res?.status()).toBe(200);
      await expect(page).toHaveURL((url) => url.pathname === "/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
    test(`old link ${old} asks a signed-out visitor to sign in`, async ({ page }) => {
      await page.goto(old);
      await expect(page).toHaveURL(/\/sign-in/);
    });
  }

  test("navigation offers no removed feature and no Admin link to a member", async ({ page }) => {
    await signInEmployee(page, undefined, "/");
    // includeHidden: the More list sits in a closed <details>, and the phone hides the top bar.
    const nav = (name?: string) => page.getByRole("navigation", { includeHidden: true, ...(name ? { name, exact: true } : {}) });
    await expect(nav().getByRole("link", { includeHidden: true }).first()).toBeAttached();
    await expect(nav("Workspace navigation").getByRole("link", { includeHidden: true })).toHaveText(["Overview", "Daily Steps", "Attendance & Leave"]);
    await expect(nav("More workspace tools").getByRole("link", { includeHidden: true })).toHaveText(["Events", "Speak Up", "Wi-Fi", "Help"]);
    await expect(nav().getByRole("link", { name: /pantry|snack|plans|people/i, includeHidden: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Admin", exact: true, includeHidden: true })).toHaveCount(0);
  });

  test("an admin finds Admin under More", async ({ page }) => {
    await signInEmployee(page, ADMIN_EMAIL, "/events");
    await page.locator(".reference-more summary").click();
    await page.getByRole("navigation", { name: "More workspace tools" }).getByRole("link", { name: "Admin", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
  });

  test("signed-in pages never overflow horizontally", async ({ page }) => {
    await signInOffice(page);
    for (const path of ["/", "/steps", "/attendance", "/grievances", "/wifi", "/events", "/settings", "/help", "/admin"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBeLessThanOrEqual(0);
    }
  });

});
