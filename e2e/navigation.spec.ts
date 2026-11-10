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
    for (const [label, heading] of [["Attendance", "Attendance"], ["People", "People"], ["Events", "Events"], ["Speak Up", "Speak Up"], ["Wi-Fi", "Wi-Fi Quality"]]) {
      if (isMobile && new URL(page.url()).pathname === "/") {
        await page.getByRole("link", { name: "Attendance & leave", exact: true }).click();
      } else {
        if (!(await more.isVisible())) await page.locator(".reference-more summary").click();
        await more.getByRole("link", { name: label, exact: true }).click();
      }
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
    for (const path of ["/events", "/people", "/settings", "/help", "/attendance", "/wifi"]) {
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

  test("signed-in pages never overflow horizontally", async ({ page }) => {
    await signInOffice(page);
    for (const path of ["/", "/steps", "/planner", "/attendance", "/grievances", "/wifi", "/events", "/people", "/settings", "/help", "/admin"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBeLessThanOrEqual(0);
    }
  });

});
