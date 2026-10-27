import { adminLogin, expect, test, uniqueText } from "./fixtures";

async function publishEvent(page: import("@playwright/test").Page, title: string) {
  await adminLogin(page, "publish");
  // The composer opens on Announcement; events are the other half of the toggle.
  await page.getByRole("tab", { name: "Event" }).click();
  await page.getByLabel("Event title").fill(title);
  await page.getByLabel("Category").selectOption("sports");
  await page.getByLabel("Starts at").fill("2026-12-25T17:00");
  await page.getByLabel("Location").fill("Common area");
  await page.getByRole("button", { name: "Publish event" }).click();
  await expect(page.getByText("Event published")).toBeVisible();
}

test.describe("Events", () => {
  test("the events page loads and shows upcoming events", async ({ page }) => {
    await page.goto("/events");
    await expect(page.getByRole("heading", { level: 1, name: "Events" })).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });

  test("admin publishes an event, an employee sees it and RSVPs", async ({ page, browser }) => {
    const title = uniqueText("IPL screening");
    await publishEvent(page, title);
    const adminItem = page.locator("li", { hasText: title });
    await expect(adminItem).toContainText("sports");
    await expect(adminItem).toContainText("No RSVPs yet");

    const employee = await browser.newContext();
    const e = await employee.newPage();
    await e.goto("/events");
    const card = e.locator("li", { hasText: title });
    await expect(card).toContainText("Sports");
    await expect(card).toContainText("Common area");
    await expect(card).toContainText("Be the first to join");

    await card.getByRole("button", { name: "Join" }).click();
    await expect(card.getByRole("button", { name: "Cancel RSVP" })).toBeVisible();
    await expect(card).toContainText("1 going");

    // The RSVP survives a reload (device cookie).
    await e.reload();
    const again = e.locator("li", { hasText: title });
    await expect(again.getByRole("button", { name: "Cancel RSVP" })).toBeVisible();

    // Toggling off drops the count.
    await again.getByRole("button", { name: "Cancel RSVP" }).click();
    await expect(again.getByRole("button", { name: "Join" })).toBeVisible();
    await expect(again).toContainText("Be the first to join");
    await employee.close();
  });

  test("admin deletes an event and it disappears for employees", async ({ page, browser }) => {
    const title = uniqueText("Town hall");
    await publishEvent(page, title);
    const item = page.locator("li", { hasText: title });
    await item.getByLabel(`Delete ${title}`).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Event deleted")).toBeVisible();
    await expect(page.locator("li", { hasText: title })).toHaveCount(0);

    const employee = await browser.newContext();
    const e = await employee.newPage();
    await e.goto("/events");
    await expect(e.locator("li", { hasText: title })).toHaveCount(0);
    await employee.close();
  });

  test("the page has no horizontal overflow on mobile", async ({ page }) => {
    await page.goto("/events");
    await expect(page.getByRole("heading", { level: 1, name: "Events" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
