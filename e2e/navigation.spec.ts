import { CLOSED_URL } from "../playwright.config";
import { expect, isMobile, test, uniqueEmail } from "./fixtures";

test.describe("Navigation & shell", () => {
  test("home renders every dashboard section with the Innovin Labs brand", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("img", { name: "Innovin Labs" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
    for (const section of ["Your Day", "Today's Attendance", "Quick Actions", "Today's Orders", "Announcements", "Your Grievances", "Wi-Fi Quality"]) {
      await expect(page.getByRole("heading", { name: section })).toBeVisible();
    }
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(font).toMatch(/Figtree/i);
  });

  test("quick actions and primary navigation reach every module", async ({ page }) => {
    const nav = isMobile(page) ? page.locator("nav.fixed") : page.locator("aside");
    const destinations: [string, RegExp, string][] = [
      ["Attendance", /\/attendance$/, "Attendance"],
      [isMobile(page) ? "Meals" : "Meals & Snacks", /\/snacks$/, "Meals & Snacks"],
      ["Grievances", /\/grievances$/, "Daily Grievances"],
      [isMobile(page) ? "Wi-Fi" : "Wi-Fi Quality", /\/wifi$/, "Wi-Fi Quality"],
      ["Home", /\/$/, ""],
    ];
    await page.goto("/help");
    for (const [label, url, heading] of destinations) {
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(url);
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
      if (heading) await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }

    for (const [label, url] of [
      ["Attendance", /\/attendance$/],
      ["Meals & Snacks", /\/snacks$/],
      ["Grievances", /\/grievances$/],
      ["Wi-Fi Quality", /\/wifi$/],
    ] as const) {
      await page.goto("/");
      const quick = page.locator("main section, main [data-slot=card]").filter({ hasText: "Quick Actions" });
      await quick.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(url);
    }
  });

  test("settings, events and help are reachable and render", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Events" }).first().click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByRole("heading", { level: 1, name: "Events" })).toBeVisible();
    await page.getByRole("link", { name: "Settings" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Admin dashboard/ })).toBeVisible();
    await page.getByRole("link", { name: "Help" }).first().click();
    await expect(page.getByRole("heading", { name: "Are grievances really anonymous?" })).toBeVisible();
    await expect(page.getByText("submit anytime")).toBeVisible();
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the Your Day strip reflects attendance, orders, and time away", async ({ page }) => {
    const email = uniqueEmail();
    await page.goto("/attendance");
    await page.getByPlaceholder("you@innovinlabs.com").fill(email);
    await page.getByRole("button", { name: "Check In" }).click();
    await expect(page.getByRole("heading", { name: "You're checked in" })).toBeVisible();

    await page.goto("/away");
    await page.locator("#away-start").fill("2026-10-07");
    await page.locator("#away-end").fill("2026-10-07");
    await page.getByLabel("Your Innovin email").fill(email);
    await page.getByRole("button", { name: "Request Leave" }).click();
    await expect(page.getByText("Leave request sent")).toBeVisible();

    await page.goto("/snacks");
    await page.getByRole("button", { name: /^Tea/ }).click();
    await page.getByRole("button", { name: "Submit Order" }).click();
    await expect(page.getByText("Order placed: Tea")).toBeVisible();

    await page.goto("/");
    const strip = page.locator("[data-slot=card]").filter({ hasText: "Your Day" });
    await expect(strip).toContainText("since"); // checked-in cell shows "Location not shared · since 5:xx"
    await expect(strip).toContainText("in today"); // At Innovin cell counts the check-in
    await expect(strip).toContainText("Tea");
    await expect(strip).toContainText("Leave · pending");
  });

  test("unknown pages show the branded 404 with a way home", async ({ page }) => {
    const res = await page.goto("/profile");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("no page overflows horizontally", async ({ page }) => {
    for (const path of ["/", "/attendance", "/snacks", "/grievances", "/wifi", "/away", "/events", "/people", "/settings", "/help", "/admin"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });

  test("help reflects the configured cutoff", async ({ page }) => {
    await page.goto(`${CLOSED_URL}/help`);
    await expect(page.getByText("submit before 12:00 AM")).toBeVisible();
  });
});
