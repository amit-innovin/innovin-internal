import { test as base, expect, type Page } from "@playwright/test";

// Every browser test fails if the page logs an unexpected console error or throws.
// Expected 4xx responses (validation, closed orders) are part of the flows being tested.
const EXPECTED = /Failed to load resource: the server responded with a status of 4\d\d/;

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error" && !EXPECTED.test(m.text())) errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      await use(errors);
      expect(errors, "browser console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

let seq = 0;
export const uniqueEmail = (prefix = "e2e") =>
  `${prefix}.${Date.now().toString(36)}${(++seq).toString(36)}@innovinlabs.com`;
export const uniqueText = (label: string) => `${label} ${Date.now().toString(36)}-${++seq}`;

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

export async function checkIn(page: Page, email: string) {
  await page.goto("/attendance");
  await page.getByPlaceholder("you@innovinlabs.com").fill(email);
  await page.getByRole("button", { name: "Check In" }).click();
  await expect(page.getByRole("heading", { name: "You're checked in" })).toBeVisible();
}

// The PIN input is disabled until hydrated (so early keystrokes can't be lost); wait for it.
export async function typePin(page: Page, pin: string) {
  const input = page.getByLabel("Admin passcode");
  await expect(input).toBeEnabled();
  await input.pressSequentially(pin);
}

export async function adminLogin(page: Page) {
  await page.goto("/admin");
  await typePin(page, "1704");
  await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
}
