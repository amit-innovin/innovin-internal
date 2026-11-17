import { expect, test, uniqueEmail, signInEmployee } from "./fixtures";

// The Material 3 Home (prototype: docs/design/m3/Prototype.dc.html, "Home").
// Check-in is verified by location only; the office network is not proof.
test.describe("Home", () => {
  test("near the office: checks in by location and collapses to a chip", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 12.9352, longitude: 77.6241 });
    await signInEmployee(page, uniqueEmail("home-in"), "/");
    await expect(page.getByText("We check your location once, when you tap Check in. It isn't tracked.")).toBeVisible();

    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(page.getByText("You're in", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Change today's status" })).toBeVisible();
    await expect(page.getByText(/^In office · \d{1,2}:\d{2}/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Check in", exact: true })).toHaveCount(0);
    await page.screenshot({ path: `output/playwright/m3-home-${test.info().project.name}.png`, fullPage: true });

    // There is no check-out; "Change" takes the mark back.
    await expect(page.getByRole("button", { name: /check ?out/i })).toHaveCount(0);
    await page.getByRole("button", { name: "Change today's status" }).click();
    await expect(page.getByRole("button", { name: "Check in", exact: true })).toBeVisible();
  });

  test("away from the office: says how far and offers remote", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 12.99, longitude: 77.7 });
    await signInEmployee(page, uniqueEmail("home-far"), "/");
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(page.getByText(/about \d+(\.\d)? km from the office/)).toBeVisible();
    await page.getByRole("button", { name: "Working remote", exact: true }).click();
    await expect(page.getByText("Remote today", { exact: true })).toBeVisible();
  });

  test("location blocked: says so and remote still works", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("home-blocked"), "/");
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(page.getByText("Location is off for innovin")).toBeVisible();
    await page.getByRole("button", { name: "Working remote", exact: true }).click();
    await expect(page.getByText("Remote today", { exact: true })).toBeVisible();
  });

  test("remote day hides office-only items", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("home-remote"), "/");
    await page.getByRole("button", { name: "Working remote", exact: true }).click();
    await expect(page.getByText("Remote today", { exact: true })).toBeVisible();
    await expect(page.getByText("Tea round", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Your crowd today" })).toHaveCount(0);
    await expect(page.getByText(/Your crowd is in on|Nobody from your crowd is planned/)).toBeVisible();
  });

  test("header greets by time of day and shows Lappy", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("home-hello"), "/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Good (morning|afternoon|evening), /);
    await expect(page.getByRole("img", { name: /^Lappy / })).toBeVisible();
  });

  test("this week shows a verdict, not counts", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("home-week"), "/");
    const week = page.getByRole("region", { name: "This week" });
    await expect(week).toContainText(/On track|Plan \d+ more|Done for|No office days needed/);
    await expect(page.getByText(/\d+ in (the office|today)/)).toHaveCount(0);
    await expect(page.getByText(/\d+ done · \d+ planned/)).toHaveCount(0);
  });

  test("the bell and the Wi-Fi button go to their own pages; Speak up is one tap away", async ({ page, isMobile }) => {
    await signInEmployee(page, uniqueEmail("home-nav"), "/");
    await page.getByRole("link", { name: /^Notifications/ }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await page.goto("/");
    await page.getByRole("link", { name: "Check office Wi-Fi" }).click();
    await expect(page).toHaveURL(/\/wifi/);
    await page.goto("/");
    await page.getByRole("link", { name: isMobile ? "Speak up anonymously" : "Speak up" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/grievances/);
  });
});
