import { checkIn, expect, test, uniqueEmail, signInEmployee } from "./fixtures";

test.describe("People", () => {
  test("the directory page loads with In today and Everyone sections", async ({ page }) => {
    await signInEmployee(page, undefined, "/people");
    await expect(page.getByRole("heading", { level: 1, name: "People" })).toBeVisible();
    await expect(page.getByText(/In today/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Everyone/ })).toBeVisible();
  });

  test("a check-in shows the person in In today with a broad location tag", async ({ page }) => {
    const email = uniqueEmail("present"); // firstName → "Present"
    await checkIn(page, email);
    await page.goto("/people");
    const item = page.locator("li", { hasText: "Present" }).first();
    await expect(item).toContainText("since");
    await expect(item).toContainText("Location not shared"); // geolocation not granted in e2e
  });

  test("no horizontal overflow on the directory", async ({ page }) => {
    await signInEmployee(page, undefined, "/people");
    await expect(page.getByRole("heading", { level: 1, name: "People" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
