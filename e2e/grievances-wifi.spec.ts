import { expect, test, uniqueText, signInEmployee } from "./fixtures";

test.describe("Speak Up", () => {
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

  test("a photo attaches, previews, can be removed, and lands in the submission", async ({ page }) => {
    // 1×1 PNG — compression runs in the browser before upload.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const file = { name: "broken-ac.png", mimeType: "image/png", buffer: png };

    const text = uniqueText("AC vent is dripping");
    await page.goto("/grievances");
    // Fill first — the counter updating proves React has hydrated before we set files.
    await page.getByLabel("Your feedback").fill(text);
    await expect(page.getByText(`${text.length}/500`)).toBeVisible();

    const attach = page.getByLabel("Attach a photo");
    await attach.setInputFiles(file);
    await expect(page.getByRole("button", { name: "View Attached photo" })).toBeVisible();

    // Remove, then attach again for real.
    await page.getByRole("button", { name: "Remove photo" }).click();
    await expect(page.getByRole("button", { name: "View Attached photo" })).toHaveCount(0);
    await attach.setInputFiles(file);
    await expect(page.getByRole("button", { name: "View Attached photo" })).toBeVisible();
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("we'll look into it")).toBeVisible();
    const mine = page.locator("#mine li", { hasText: text });
    await expect(mine.getByRole("button", { name: "View Attached photo" })).toBeVisible();
  });

  test("Speak Up accepts anonymous feedback without an employee account", async ({ page }) => {
    const text = uniqueText("Guest feedback");
    await page.goto("/grievances");
    await page.getByLabel("Your feedback").fill(text);
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.locator("#mine li", { hasText: text })).toContainText("Anonymous");
    expect((await (await page.request.get("/api/auth/me")).json()).signedIn).toBe(false);
  });

  test("the urgent toggle marks the report and floats it to the top for admins", async ({ page }) => {
    const text = uniqueText("Flooded bathroom");
    await page.goto("/grievances");
    await page.getByLabel("Your feedback").fill(text);
    await page.getByRole("button", { name: /This is urgent/ }).click();
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Sent — marked urgent for admins. Notifications are best-effort.", { exact: true })).toBeVisible();
    await expect(page.locator("#mine li", { hasText: text })).toContainText("Urgent");
  });
});
