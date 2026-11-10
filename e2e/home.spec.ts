import { expect, test, uniqueEmail, signInEmployee } from "./fixtures";

// The rebuilt Home (design canvas: D-Prototype "home", D-Desktop, D-Tablet, D-CheckIn-Location).
test.describe("Home", () => {
  test("off office Wi-Fi: asks for a location once, then marks the office day", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 12.9352, longitude: 77.6241 });
    await signInEmployee(page, uniqueEmail("home-in"), "/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Morning|Afternoon|Evening/);
    await expect(page.getByRole("img", { name: /Lappy/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Office days this month" })).toContainText("0 of 8");

    await page.getByRole("button", { name: /I'm in the office/ }).click();
    const sheet = page.getByRole("dialog", { name: "Location check" });
    await expect(sheet).toContainText("Quick check that you're at the office");
    await sheet.getByRole("button", { name: "Allow location" }).click();

    await expect(page.getByText("You're in today")).toBeVisible();
    await expect(page.getByText(/Verified by location/)).toBeVisible();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Office days this month" })).toContainText("1 of 8");
    await expect(page.getByText(/Checked in! That's 1 of your 8 office days/)).toBeVisible();
    await expect(page.getByRole("group", { name: "Who's around" })).toContainText(/[1-9]\d* in today/);
    await page.screenshot({ path: `output/playwright/duo-home-${test.info().project.name}.png`, fullPage: true });

    // There is no check-out; "Change" takes the mark back.
    await expect(page.getByRole("button", { name: /check ?out/i })).toHaveCount(0);
    await page.getByRole("button", { name: "Change" }).click();
    await expect(page.getByRole("button", { name: /I'm in the office/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Office days this month" })).toContainText("0 of 8");
  });

  test("away from the office: explains why and offers remote instead", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 12.99, longitude: 77.7 });
    await signInEmployee(page, uniqueEmail("home-far"), "/");
    await page.getByRole("button", { name: /I'm in the office/ }).click();
    await page.getByRole("dialog", { name: "Location check" }).getByRole("button", { name: "Allow location" }).click();
    const away = page.getByRole("dialog", { name: "Not at the office" });
    await expect(away).toContainText(/about \d+(\.\d)? km away/);
    await page.screenshot({ path: `output/playwright/duo-home-outside-${test.info().project.name}.png` });
    await away.getByRole("button", { name: "Working remote today" }).click();
    await expect(away).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Remote today/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Remote today, noted.")).toBeVisible();
    // A remote day is not an office day.
    await expect(page.getByRole("region", { name: "Office days this month" })).toContainText("0 of 8");
  });

  test("location blocked: says so, and remote needs no location at all", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("home-blocked"), "/");
    await page.getByRole("button", { name: /I'm in the office/ }).click();
    await page.getByRole("dialog", { name: "Location check" }).getByRole("button", { name: "Allow location" }).click();
    const blocked = page.getByRole("dialog", { name: "Location blocked" });
    await expect(blocked).toContainText("We couldn't get your location");
    await page.keyboard.press("Escape");
    await expect(blocked).toHaveCount(0);
    await page.getByRole("button", { name: "Working remote today" }).click();
    await expect(page.getByRole("button", { name: /Remote today/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("the bell and the Wi-Fi button go to their own pages; old board links still work", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("home-nav"), "/");
    await page.getByRole("link", { name: /^Notifications/ }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await page.goto("/");
    await page.getByRole("link", { name: "Wi-Fi check" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/wifi/);
    await page.goto("/?view=board");
    await expect(page).toHaveURL(/\/board\?view=board/);
  });
});
