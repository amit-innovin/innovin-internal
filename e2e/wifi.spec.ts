import { expect, test, uniqueEmail, signInEmployee, signInOffice } from "./fixtures";

// The Material 3 Wi-Fi check (prototype: docs/design/m3/Prototype.dc.html, "Wi-Fi"). The e2e
// server measures against our own payload (SPEEDTEST_PROVIDER=self).
test.describe("Wi-Fi check", () => {
  test("Today's Wi-Fi card starts the check straight away and cleans the URL", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("wifi-home"), "/");
    await page.getByRole("link", { name: "Check now" }).click();
    await expect(page).toHaveURL(/\/wifi$/);
    await expect(page.getByText("Testing download, upload and delay…")).toBeVisible();
    await expect(page.getByText("While you wait: catch the packets")).toBeVisible();
  });

  test("not checked in: you get the verdict and numbers, but no report", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("wifi-remote"), "/wifi");
    await expect(page.getByText("You're not checked in. The check still runs, but reports are for the office Wi-Fi only.")).toBeVisible();
    await page.getByRole("button", { name: "Run check" }).click();
    const verdict = page.getByRole("region", { name: /The connection (is slow right now|looks good)/ });
    await expect(verdict).toBeVisible({ timeout: 20_000 });
    for (const unit of ["Mbps down", "Mbps up", "ms delay"]) await expect(verdict).toContainText(unit);
    await expect(page.getByRole("region", { name: "Report it to admins" })).toHaveCount(0);
  });

  test("checked in: report where you're sitting and it reaches admins", async ({ page }) => {
    await signInOffice(page, uniqueEmail("wifi-office"));
    await page.goto("/wifi");
    await page.getByRole("button", { name: "Run check" }).click();
    await expect(page.getByRole("region", { name: /The connection (is slow right now|looks good)/ })).toBeVisible({ timeout: 20_000 });
    const anyway = page.getByRole("button", { name: "Report anyway" });
    if (await anyway.isVisible()) await anyway.click();
    const report = page.getByRole("region", { name: "Report it to admins" });
    await report.getByRole("radio", { name: "Pantry" }).click();
    await report.getByRole("button", { name: "Send report" }).click();
    await expect(page.getByText("Sent to admins with your result")).toBeVisible();
    await page.screenshot({ path: `output/playwright/m3-wifi-${test.info().project.name}.png`, fullPage: true });
  });
});
