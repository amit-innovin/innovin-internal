import { CLOSED_URL } from "../playwright.config";
import { expect, test } from "./fixtures";

test.describe("Meals & Snacks (orders open)", () => {
  test("place a multi-item order, change it, view history, see it on home, then cancel", async ({ page }) => {
    await page.goto("/snacks");
    await expect(page.getByText("No items selected")).toBeVisible();
    await expect(page.getByText(/Order anytime today/)).toBeVisible();
    const submit = page.getByRole("button", { name: "Submit Order" });
    await expect(submit).toBeDisabled();

    await page.getByRole("button", { name: /^Tea/ }).click();
    await page.getByRole("button", { name: /^Lunch/ }).click();
    await expect(page.getByRole("button", { name: /^Tea/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^Lunch/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("1 × Tea")).toBeVisible();
    await expect(page.getByText("1 × Lunch")).toBeVisible();
    await page.getByLabel("Special instructions").fill("  less sugar  ");
    await submit.click();
    await expect(page.getByText("Order placed: Tea + Lunch")).toBeVisible();
    await expect(page.getByRole("button", { name: "Update Order" })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Special instructions")).toHaveValue("less sugar");
    await expect(page.getByRole("button", { name: /^Tea/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^Lunch/ })).toHaveAttribute("aria-pressed", "true");

    // Drop tea, keep lunch — the day's selection is replaced.
    await page.getByRole("button", { name: /^Tea/ }).click();
    await expect(page.getByText("1 × Tea")).toHaveCount(0);
    await page.getByRole("button", { name: "Update Order" }).click();
    await expect(page.getByText("Order updated: Lunch")).toBeVisible();

    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Today ·")).toBeVisible();
    // The post-update reload may still be in flight — wait for it to settle to [lunch] only.
    await expect(page.getByText("less sugar")).toHaveCount(1);
    await expect(page.getByText("less sugar").first()).toBeVisible();
    await page.getByRole("tab", { name: "Today" }).click();

    await page.goto("/");
    await expect(page.getByText("Lunch").first()).toBeVisible();
    await expect(page.getByText("Ordered • less sugar")).toBeVisible();

    await page.goto("/snacks");
    await page.getByRole("button", { name: "Cancel today's order" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Lunch will be removed");
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel order" }).click();
    await expect(page.getByText("Order cancelled")).toBeVisible();
    await expect(page.getByText("No items selected")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit Order" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Cancel today's order" })).toHaveCount(0);
  });

  test("keeping an order from the cancel dialog leaves it untouched", async ({ page }) => {
    await page.goto("/snacks");
    await page.getByRole("button", { name: /^Healthy Option/ }).click();
    await page.getByRole("button", { name: "Submit Order" }).click();
    await expect(page.getByText("Order placed: Healthy Option")).toBeVisible();
    await page.getByRole("button", { name: "Cancel today's order" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Keep order" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Update Order" })).toBeVisible();
  });

  test("each device keeps its own order", async ({ browser }) => {
    const deviceA = await browser.newContext();
    const deviceB = await browser.newContext();
    const a = await deviceA.newPage();
    const b = await deviceB.newPage();
    await a.goto("/snacks");
    await a.getByRole("button", { name: /^Tea/ }).click();
    await a.getByRole("button", { name: "Submit Order" }).click();
    await expect(a.getByText("Order placed: Tea")).toBeVisible();
    await b.goto("/snacks");
    await expect(b.getByText("No items selected")).toBeVisible();
    await Promise.all([deviceA.close(), deviceB.close()]);
  });
});

test.describe("Meals & Snacks (after cutoff)", () => {
  test.use({ baseURL: CLOSED_URL });

  test("shows orders closed, disables ordering, and home says closed", async ({ page }) => {
    await page.goto("/snacks");
    await expect(page.getByText("Orders are closed for today")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Tea/ })).toBeDisabled();
    await expect(page.getByLabel("Special instructions")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Submit Order" })).toBeDisabled();

    await page.goto("/");
    await expect(page.getByText("Orders are closed for today")).toBeVisible();
    await expect(page.getByRole("link", { name: "Order now" })).toHaveCount(0);
  });
});
