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
      await expect(page.getByText("3 new since yesterday, then everything else")).toBeVisible();
      await expect(page.getByRole("region", { name: "New posts" }).locator("article")).toHaveCount(3);
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

test.describe("Important announcements and the Feed badge", () => {
  test("an important announcement shows once on any page and never again after Got it", async ({ page, browser }) => {
    const admin = await person(browser, ADMIN_EMAIL);
    const title = uniqueText("Office closed");
    expect((await admin.page.request.post("/api/announcements", { form: { title, body: "Building maintenance.", important: "on", pinnedUntil: inDays(3) }, maxRedirects: 0 })).status()).toBe(303);
    const id = (await (await admin.page.request.get("/api/announcements")).json()).find((a: { title: string }) => a.title === title).id;
    try {
      await signInEmployee(page, uniqueEmail("feedimportant"), "/days");
      // Acknowledge any older important announcement other tests left pinned, so ours is next.
      for (let i = 0; i < 5; i++) {
        const next = (await (await page.request.get("/api/announcements/important")).json()).announcement;
        if (!next || next.id === id) break;
        await page.request.post("/api/announcements/ack", { data: { id: next.id } });
      }
      await page.reload();
      const sheet = page.getByRole("dialog", { name: "Important announcement" });
      await expect(sheet).toContainText(title);
      await expect(sheet).toContainText("Building maintenance.");
      await sheet.getByRole("button", { name: "Got it" }).click();
      await expect(sheet).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: "Days" })).toBeVisible();
      await expect(page.getByRole("dialog", { name: "Important announcement" })).toHaveCount(0);
    } finally {
      await admin.page.request.post("/api/announcements", { form: { _action: "delete", id }, maxRedirects: 0 });
      await admin.close();
    }
  });

  test("the Feed nav item shows how many posts are new", async ({ page, browser }) => {
    await signInEmployee(page, uniqueEmail("feedbadge"), "/");
    await seenNow(page);
    await seed(browser);
    await page.goto("/days");
    await expect(page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).getByRole("link", { name: /Feed.*3 new/ })).toBeVisible();
  });
});

test.describe("Feed freshness", () => {
  const feedLink = (page: Page) => page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).getByRole("link", { name: /^Feed/ });

  test("a post made after you opened the app is in the stack when you go to Feed", async ({ page, browser }) => {
    await signInEmployee(page, uniqueEmail("feedfresh"), "/");
    await seenNow(page);
    await page.goto("/days");
    await expect(page.getByRole("heading", { level: 1, name: "Days" })).toBeVisible();
    const { kudos } = await seed(browser);
    await feedLink(page).click();
    await expect(page).toHaveURL(/\/feed$/);
    // Oldest first: the kudos is the first card on a phone, and on screen with the rest on a laptop.
    await expect(page.getByRole("region", { name: "New posts" })).toContainText(kudos);
  });

  test("posts you've read aren't new again when you come back", async ({ page, browser }) => {
    await signInEmployee(page, uniqueEmail("feedback-again"), "/");
    await seenNow(page);
    await seed(browser);
    await page.goto("/feed");
    const wide = (page.viewportSize()?.width ?? 0) >= 1100;
    if (!wide) for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next post" }).click();
    await expect(page.getByRole("heading", { name: "You're all caught up" })).toBeVisible();
    await page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).getByRole("link", { name: /^Days/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Days" })).toBeVisible();
    await expect(feedLink(page)).not.toHaveAccessibleName(/new/);
    await feedLink(page).click();
    await expect(page.getByText("Nothing new since yesterday")).toBeVisible();
  });
});

test.describe("Reporting a post", () => {
  test("someone else's post can be reported quietly, once", async ({ page, browser }) => {
    const authorContext = await browser.newContext();
    const author = await authorContext.newPage();
    await signInEmployee(author, uniqueEmail("feed-reported"), "/");
    const body = uniqueText("A quote to report");
    expect((await author.request.post("/api/notices", { data: { kind: "quote", body, title: "", attribution: "", color: "purple", anonymous: false } })).status()).toBe(201);
    await authorContext.close();
    await signInEmployee(page, uniqueEmail("feed-reporter"), "/");
    // Seen up to now, so the post is under Earlier on every screen size.
    await seenNow(page);
    await page.goto("/feed");
    await page.getByRole("region", { name: "Earlier" }).getByRole("button", { name: new RegExp(body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
    const target = page.locator("article").filter({ hasText: body }).filter({ visible: true }).first();
    await target.getByRole("button", { name: "Report" }).click();
    await target.getByRole("button", { name: "Report post" }).click();
    await expect(page.getByText("Reported. An admin will take a look.")).toBeVisible();
    await expect(target.getByText("Reported", { exact: true })).toBeVisible();
  });
});
