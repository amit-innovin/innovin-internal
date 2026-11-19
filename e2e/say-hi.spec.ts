import type { Browser } from "@playwright/test";
import { expect, test, uniqueEmail, signInEmployee, signInOffice } from "./fixtures";

// Say hi (prototype: docs/design/m3/Prototype.dc.html, "Say hi to {name}"): opt-in waves and
// invites between people checked in at the office.
async function colleague(browser: Browser, prefix: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInOffice(page, uniqueEmail(prefix));
  expect((await page.request.post("/api/hi/setting", { data: { on: true } })).status()).toBe(200);
  return { page, name: prefix.replace(/^./, (c) => c.toUpperCase()), close: () => context.close() };
}

test.describe("Say hi", () => {
  test("invite someone for chai; they say yes and you see it", async ({ page, browser }) => {
    const them = await colleague(browser, `hb${Date.now().toString(36)}`);
    const mePrefix = `ha${Date.now().toString(36)}`;
    await signInOffice(page, uniqueEmail(mePrefix));
    await page.request.post("/api/hi/setting", { data: { on: true } });
    await page.goto("/");
    const inOffice = page.getByRole("region", { name: "In office today" });
    await inOffice.getByRole("button", { name: `Wave at ${them.name}` }).click();
    const sheet = page.getByRole("dialog", { name: `Say hi to ${them.name}` });
    await expect(sheet.getByRole("button", { name: /^Pick something to send$/ })).toBeDisabled();
    await sheet.getByRole("button", { name: "Chai break?" }).click();
    await expect(sheet.getByRole("button", { name: "Send Chai break" })).toBeDisabled();
    await sheet.getByRole("button", { name: "Now" }).click();
    await sheet.getByRole("button", { name: "Send Chai break" }).click();
    await expect(inOffice.getByRole("button", { name: `Chai now to ${them.name}` })).toBeDisabled();

    await them.page.goto("/notifications");
    const me = mePrefix.replace(/^./, (c) => c.toUpperCase());
    await expect(them.page.getByText(`${me}: chai break now?`)).toBeVisible();
    await them.page.getByRole("button", { name: "I'm in" }).click();
    await expect(them.page.getByText(`You said yes. ${me} can see it.`)).toBeVisible();
    await them.close();

    await page.goto("/notifications");
    await expect(page.getByText(`${them.name} is in for chai`)).toBeVisible();
  });

  test("with Say hi off there are no Wave buttons, just a quiet way to turn it on", async ({ page, browser }) => {
    const them = await colleague(browser, `hc${Date.now().toString(36)}`);
    await signInOffice(page, uniqueEmail("hi-off"));
    await page.goto("/");
    const inOffice = page.getByRole("region", { name: "In office today" });
    await expect(inOffice).toContainText("Say hi is off. Turn it on to wave at people and get invites.");
    await expect(inOffice.getByRole("button", { name: `Wave at ${them.name}` })).toHaveCount(0);
    await inOffice.getByRole("button", { name: "Turn on" }).click();
    await expect(inOffice.getByRole("button", { name: `Wave at ${them.name}` })).toBeVisible();
    await them.close();
  });
});
