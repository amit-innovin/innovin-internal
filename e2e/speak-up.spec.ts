import { ADMIN_EMAIL, expect, test, uniqueEmail, signInEmployee } from "./fixtures";

// Speak up (prototype: docs/design/m3/Prototype.dc.html, "Speak up"): a private, anonymous
// message to admins, from this device, signed in or not.
test.describe("Speak up", () => {
  test("signed out: send anonymously with a topic, and see it under My reports", async ({ page }) => {
    await page.goto("/grievances");
    await expect(page.getByText("Anonymous by design")).toBeVisible();
    const send = page.getByRole("button", { name: "Send anonymously" });
    await expect(send).toBeDisabled();
    await page.getByRole("group", { name: "Topic" }).getByRole("button", { name: "Facilities" }).click();
    await page.getByRole("textbox", { name: "What's going on?" }).fill(`The pantry tap leaks ${Date.now()}`);
    await send.click();
    await expect(page.getByRole("status")).toContainText(/Sent anonymously[\s\S]*Reference SU-[A-Z0-9]{4}/);
    const reports = page.getByRole("region", { name: "My reports" });
    await expect(reports).toContainText("Facilities · SU-");
    await expect(reports).toContainText("no reply yet");
  });

  test("an admin's reply shows on the device that sent the message, and nowhere else", async ({ page, browser }) => {
    await signInEmployee(page, uniqueEmail("speak-in"), "/grievances");
    const body = `Meeting room AC is too cold ${Date.now()}`;
    await page.getByRole("textbox", { name: "What's going on?" }).fill(body);
    await page.getByRole("button", { name: "Send anonymously" }).click();
    await expect(page.getByRole("status")).toContainText("Sent anonymously");

    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await signInEmployee(admin, ADMIN_EMAIL, "/");
    const row = (await (await admin.request.get("/api/grievances")).json()).find((g: { body: string }) => g.body === body);
    expect((await admin.request.patch("/api/grievances", { data: { id: row.id, reply: "Facilities will fix it today" } })).status()).toBe(200);
    await page.reload();
    await expect(page.getByRole("region", { name: "My reports" })).toContainText("Reply from admins: Facilities will fix it today");
    // A reply alone (no status change) still reads as answered.
    await expect(page.getByRole("region", { name: "My reports" })).not.toContainText("no reply yet");
    await admin.goto("/grievances");
    await expect(admin.getByText("Facilities will fix it today")).toHaveCount(0);
    await adminContext.close();
  });
});
