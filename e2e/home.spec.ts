import { expect, test, uniqueEmail, signInEmployee, signInOffice } from "./fixtures";

// Today (design: https://claude.ai/artifact/1cR9t8dgrFiqAPsFeV1kPo): Apple Health-style summary in Material 3.
// Check-in is verified by location only; the office network is not proof.
test.describe("Home", () => {
  // Today counts as one of your days, so the full check-in card shows (skipped on a non-working day).
  async function plannedToday(page: import("@playwright/test").Page) {
    const res = await page.request.patch("/api/days", { data: { officeDays: [0, 1, 2, 3, 4, 5, 6] } });
    expect(res.ok()).toBe(true);
    test.skip(!(await res.json()).isOfficeDayToday, "today isn't a working day");
    await page.reload();
  }

  test("near the office: checks in by location and collapses to a chip", async ({ page, context, browser }) => {
    // Someone else is in, so "In office today" has a person to show (it never lists you).
    const other = await browser.newContext();
    await signInOffice(await other.newPage(), uniqueEmail("home-colleague"));
    await other.close();
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 12.9352, longitude: 77.6241 });
    await signInEmployee(page, uniqueEmail("home-in"), "/");
    await plannedToday(page);
    await expect(page.getByRole("region", { name: "Your day" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Working remote" })).toHaveCount(0);

    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Change today's status" })).toBeVisible();
    await expect(page.getByText(/^In office · \d{1,2}:\d{2}/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Check in", exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "In office today" })).toBeVisible();
    await page.screenshot({ path: `output/playwright/m3-home-${test.info().project.name}.png`, fullPage: true });

    // There is no check-out; "Change" takes the mark back.
    await expect(page.getByRole("button", { name: /check ?out/i })).toHaveCount(0);
    await page.getByRole("button", { name: "Change today's status" }).click();
    await expect(page.getByRole("button", { name: "Check in", exact: true })).toBeVisible();
  });

  test("away from the office: says how far", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 12.99, longitude: 77.7 });
    await signInEmployee(page, uniqueEmail("home-far"), "/");
    await plannedToday(page);
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(page.getByText(/about \d+(\.\d)? km from the office/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("location blocked: says so", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("home-blocked"), "/");
    await plannedToday(page);
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(page.getByText("Location is off for innovin")).toBeVisible();
  });

  test("on a day you're not planned in, you can still check in", async ({ page, context, isMobile }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 12.9352, longitude: 77.6241 });
    await signInEmployee(page, uniqueEmail("home-quiet"), "/");
    if (!isMobile) await expect(page.getByText("In the office after all?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Working remote" })).toHaveCount(0);
    await expect(page.getByText("Tea round", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(page.getByText(/^In office · \d{1,2}:\d{2}/)).toBeVisible();
  });

  test("large title greets by time of day, with the Your day ribbon under it", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("home-hello"), "/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Good (morning|afternoon|evening), /);
    await expect(page.getByRole("region", { name: "Your day" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pinned" })).toBeVisible();
  });

  test("office days show a verdict, not counts", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("home-week"), "/");
    const pinned = page.getByRole("region", { name: "Pinned" });
    await expect(pinned).toContainText(/more to plan|On track|Done for|No office days needed/);
    await expect(page.getByText(/\d+ in (the office|today)/)).toHaveCount(0);
    await expect(page.getByText(/\d+ done · \d+ planned/)).toHaveCount(0);
  });

  test("the bell, Wi-Fi and Speak up open their own pages", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("home-nav"), "/");
    await page.getByRole("link", { name: /^Notifications/ }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/notifications$/);
    await page.goto("/");
    await page.getByRole("link", { name: "Check now" }).click();
    await expect(page).toHaveURL(/\/wifi\?check=1$/);
    await page.goto("/");
    await page.getByRole("link", { name: /Speak up anonymously/ }).click();
    await expect(page).toHaveURL(/\/grievances$/);
  });

  test("links to the old Home panels go to the real page", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("home-old"), "/?view=days");
    await expect(page).toHaveURL(/\/days$/);
    await page.goto("/?view=admin-people");
    await expect(page).toHaveURL(/\/$/);
  });
});
