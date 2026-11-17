import { test as base, expect, type Page } from "@playwright/test";
import { MOCK_URL } from "./mock-url";

// Every browser test fails if the page logs an unexpected console error or throws.
// Expected 4xx responses (validation) are part of the flows being tested.
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
  await signInEmployee(page, email, "/attendance");
  await page.getByRole("button", { name: "Check In" }).click();
  await expect(page.getByRole("heading", { name: "You're checked in" })).toBeVisible();
}

export async function signInEmployee(page: Page, email?: string, next = "/attendance") {
  if (email) await page.request.get(`${MOCK_URL}/as?email=${encodeURIComponent(email)}&name=${encodeURIComponent(email.split("@")[0].split(".")[0].replace(/^./, c => c.toUpperCase()))}`);
  try {
    await page.goto(`/api/auth/google?next=${encodeURIComponent(next)}`);
    // Signed in once we land on a page that isn't sign-in. Not always `next` itself: retired
    // routes redirect (/settings → /account, /events → /feed?filter=event; see next.config.ts).
    await page.waitForURL((url) => !url.pathname.startsWith("/api/auth") && url.pathname !== "/sign-in");
  } finally { if (email) await page.request.get(`${MOCK_URL}/as?reset=1`); }
}

// Signs in as a verified company employee and marks today as in-office, from a position inside
// the test office geofence (playwright.config: OFFICE_LAT/LNG 12.935,77.624). Check-in is
// location-only, so this is the same request Home's "Check in" button sends.
export async function signInOffice(page: Page, email?: string) {
  await signInEmployee(page, email, "/");
  const res = await page.request.post("/api/days", { data: { mode: "office", lat: 12.9352, lng: 77.6241, accuracyM: 20 } });
  expect(res.status(), "office check-in").toBe(200);
}

export type AdminTab = "today" | "approvals" | "people" | "publish";

// The dashboard groups its sections into URL-driven tabs and only queries the open one, so
// tests have to say which tab they need. Defaults to Today, same as the dashboard.
// Admin access is a Google identity with the admin role: admin@innovinlabs.com is listed in
// ADMIN_EMAILS (playwright.config), so signing in as it lands on the dashboard.
export const ADMIN_EMAIL = "admin@innovinlabs.com";

export async function adminLogin(page: Page, tab: AdminTab = "today") {
  await signInEmployee(page, ADMIN_EMAIL, "/admin");
  await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
  if (tab !== "today") await adminTab(page, tab);
}

export async function adminTab(page: Page, tab: AdminTab) {
  const label = { today: "Today", approvals: "Approvals", people: "People", publish: "Publish" }[tab];
  // Scoped to the dashboard's own nav — "People" also exists in the app sidebar.
  await page
    .getByRole("navigation", { name: "Dashboard sections" })
    .getByRole("link", { name: new RegExp(`^${label}`) })
    .click();
  await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
}
