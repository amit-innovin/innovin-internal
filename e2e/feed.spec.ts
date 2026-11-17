import type { Browser, Page } from "@playwright/test";
import { ADMIN_EMAIL, expect, test, uniqueEmail, uniqueText, signInEmployee } from "./fixtures";

// The Material 3 catch-up Feed (prototype: docs/design/m3/Prototype.dc.html, "Feed").
// Every test starts by marking everything seen, then seeds its own posts, so other tests' posts
// never land in the stack under test.

async function person(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInEmployee(page, email, "/");
  return { page, close: () => context.close() };
}
const seenNow = (page: Page) => page.request.post("/api/feed/seen", { data: { at: new Date().toISOString() } });
const inDays = (n: number) => new Date(Date.now() + 5.5 * 3600_000 + n * 86_400_000).toISOString().slice(0, 10);
const tomorrowAt = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);

async function seed(browser: Browser) {
  const author = await person(browser, uniqueEmail("feedauthor"));
  const admin = await person(browser, ADMIN_EMAIL);
  const kudos = uniqueText("Thanks for the demo");
  const question = uniqueText("Lunch?");
  const event = uniqueText("Potluck");
  expect((await author.page.request.post("/api/notices", { data: { kind: "kudos", toEmail: ADMIN_EMAIL, body: kudos } })).status()).toBe(201);
  expect((await author.page.request.post("/api/notices", { data: { kind: "poll", title: question, options: ["Biryani", "Pizza"], closesOn: inDays(3) } })).status()).toBe(201);
  expect((await admin.page.request.post("/api/events", { data: { title: event, category: "social", startsAt: tomorrowAt(), body: "", location: "Terrace" } })).status()).toBe(201);
  await author.close();
  await admin.close();
  return { kudos, question, event };
}

test.describe("Feed", () => {
  test("new posts come one at a time on phones, all at once on a laptop, then you're caught up", async ({ page, browser }) => {
    await signInEmployee(page, uniqueEmail("feedreader"), "/");
    await seenNow(page);
    const { question, event } = await seed(browser);
    await page.goto("/feed");
    await expect(page.getByRole("heading", { level: 1, name: "Feed" })).toBeVisible();
    const wide = (page.viewportSize()?.width ?? 0) >= 1100;

    if (wide) {
      await expect(page.getByText("NEW SINCE YESTERDAY · 3")).toBeVisible();
      await expect(page.getByText("Results show after you vote", { exact: false })).toBeVisible();
    } else {
      await expect(page.getByText("1 / 3")).toBeVisible();
      await expect(page.getByText("1 of 3 new since yesterday")).toBeVisible();
      await page.getByRole("button", { name: "Next post" }).click();
      await expect(page.getByText("2 / 3")).toBeVisible();
      await page.getByRole("button", { name: "Previous post" }).click();
      await expect(page.getByText("1 / 3")).toBeVisible();
      await page.getByRole("button", { name: "Next post" }).click();
      // The poll: results stay hidden until you vote.
      const stack = page.getByRole("region", { name: "New posts" });
      await expect(stack).toContainText(question);
      await expect(stack).toContainText("Results show after you vote");
      await stack.getByRole("button", { name: "Biryani" }).click();
      await expect(stack).toContainText("100%");
      await expect(page.getByText("2 / 3")).toBeVisible();
      await page.getByRole("button", { name: "Next post" }).click();
      // The event: answering it doesn't move the stack.
      await expect(stack).toContainText(event);
      await stack.getByRole("button", { name: "I'm in" }).click();
      await expect(stack.getByRole("button", { name: "Going" })).toBeVisible();
      await expect(page.getByText("3 / 3")).toBeVisible();
      await page.screenshot({ path: `output/playwright/m3-feed-${test.info().project.name}.png`, fullPage: true });
      await page.getByRole("button", { name: "Next post" }).click();
    }
    await expect(page.getByRole("heading", { name: "You're all caught up" })).toBeVisible();
    await expect.poll(async () => (await (await page.request.get("/api/feed")).json()).newIds.length).toBe(0);
    await page.reload();
    await expect(page.getByText("Nothing new since yesterday")).toBeVisible();
  });

  test("Still open lists an event you haven't answered until you answer it", async ({ page, browser }) => {
    await signInEmployee(page, uniqueEmail("feedopen"), "/");
    const { event } = await seed(browser);
    await seenNow(page);
    await page.goto("/feed");
    const open = page.getByRole("region", { name: "Still open" });
    const row = open.locator(".m3-row").filter({ hasText: event });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "I'm in" }).click();
    await expect(row).toHaveCount(0);
  });

  test("the composer posts kudos, says where anonymous goes, and lists it under Earlier", async ({ page, browser }) => {
    const friendPrefix = `kf${Date.now().toString(36)}`;
    const friend = await person(browser, uniqueEmail(friendPrefix));
    await friend.close();
    await signInEmployee(page, uniqueEmail("feedposter"), "/");
    await seenNow(page);
    await page.goto("/feed");
    await page.getByRole("button", { name: "Post" }).first().click();
    const sheet = page.getByRole("dialog", { name: "New post" });
    await expect(sheet).toContainText("Events and announcements are posted by admins.");
    await expect(sheet).toContainText("Public, with your name. For anonymous, use Speak up.");
    await expect(sheet.getByText(/anonymous/i)).toHaveCount(1);
    await sheet.getByRole("button", { name: /^Kudos/ }).click();
    const name = friendPrefix.replace(/^./, (c) => c.toUpperCase());
    await sheet.getByRole("textbox", { name: "Search people" }).fill(name);
    await sheet.getByRole("button", { name }).click();
    await expect(sheet.getByRole("button", { name: "Post" })).toBeDisabled();
    await sheet.getByRole("textbox", { name: "What did they do?" }).fill("Fixed the printer");
    await sheet.getByRole("button", { name: "Post" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Earlier" })).toContainText(`You gave kudos to ${name}`);
  });
});
