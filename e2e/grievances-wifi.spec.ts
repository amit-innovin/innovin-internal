import { expect, test, uniqueText } from "./fixtures";

test.describe("Daily Grievances", () => {
  test("anonymous submission is confirmed and tracked on this device only", async ({ page, browser }) => {
    const text = uniqueText("Projector flickers in room 2");
    await page.goto("/grievances");
    const submit = page.getByRole("button", { name: "Submit" });
    await expect(submit).toBeDisabled();
    await page.getByLabel("Your feedback").fill(text);
    await expect(page.getByText(`${text.length}/500`)).toBeVisible();
    await submit.click();
    await expect(page.getByText("we'll look into it")).toBeVisible();
    await expect(page.getByLabel("Your feedback")).toHaveValue("");

    const mine = page.locator("#mine");
    await expect(mine).toContainText(text);
    await expect(mine.locator("li", { hasText: text })).toContainText("Anonymous");
    await expect(mine.locator("li", { hasText: text })).toContainText("Open");

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto("/grievances");
    await expect(otherPage.getByText(text)).toHaveCount(0);
    await other.close();
  });

  test("'With Name' requires a name, and the feedback box caps at 500 characters", async ({ page }) => {
    await page.goto("/grievances");
    await page.getByRole("tab", { name: "With Name" }).click();
    const name = page.getByLabel("Your name");
    await expect(name).toBeVisible();
    await page.getByLabel("Your feedback").fill("x".repeat(600));
    await expect(page.getByLabel("Your feedback")).toHaveValue("x".repeat(500));
    await page.getByRole("button", { name: "Submit" }).click();
    expect(await name.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);

    const text = uniqueText("Named feedback");
    await page.getByLabel("Your feedback").fill(text);
    await name.fill("E2E Tester");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.locator("#mine li", { hasText: text })).toContainText("With name");
  });

  test("home 'View all' deep-links and scrolls to the submissions list", async ({ page }) => {
    const text = uniqueText("Deep link check");
    await page.goto("/grievances");
    await page.getByLabel("Your feedback").fill(text);
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.locator("#mine")).toContainText(text);

    await page.goto("/");
    await expect(page.getByText(text)).toBeVisible();
    await page.getByRole("link", { name: "View all" }).click();
    await expect(page).toHaveURL(/\/grievances#mine$/);
    await expect(page.locator("#mine")).toBeInViewport();
  });
});

test.describe("Wi-Fi Quality", () => {
  test("home 'Check Speed' runs the test immediately and cleans the URL", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Check Speed" }).click();
    await expect(page).toHaveURL(/\/wifi$/);
    await expect(page.getByText(/^Download/)).toContainText("Mbps", { timeout: 20_000 });
  });

  test("reports with a note appear in the feed, update the status, and reset the speed", async ({ page }) => {
    const note = uniqueText("Slow near meeting room");
    await page.goto("/wifi");
    await page.getByRole("button", { name: "Check Speed" }).click();
    await expect(page.getByText(/^Download/)).toContainText("Mbps", { timeout: 20_000 });

    await page.getByLabel("Note").fill(note);
    await page.getByRole("button", { name: "Poor" }).click();
    await expect(page.getByText("report submitted")).toBeVisible();
    await expect(page.getByText(note)).toBeVisible();
    await expect(page.getByLabel("Note")).toHaveValue("");
    await expect(page.getByText(/^Download/)).toHaveCount(0);
    await expect(page.locator("li", { hasText: note })).toContainText("Mbps");
    await expect(page.getByText("Poor", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Good" }).click();
    await expect(page.getByText("report submitted").first()).toBeVisible();
    await expect(page.locator("li").first()).not.toContainText("Mbps");
  });
});
