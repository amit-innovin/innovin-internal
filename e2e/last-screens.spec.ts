import type { Browser, Page } from "@playwright/test";
import { ADMIN_EMAIL, expect, test, uniqueEmail, uniqueText, signInEmployee } from "./fixtures";

// Stage 9 (docs/superpowers/specs/2026-11-19-m3-last-screens-design.md): the last screens in
// Material 3, from the canvas boards M3EventDetails, M3Help, M3SignIn and M3AdminApp (Publish).
const inDays = (n: number) => new Date(Date.now() + 5.5 * 3600_000 + n * 86_400_000).toISOString().slice(0, 10);

async function signedIn(browser: Browser, email: string, next = "/") {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInEmployee(page, email, next);
  return { page, close: () => context.close() };
}

async function postEvent(admin: Page, title: string, body = "Bring one dish from home.") {
  const res = await admin.request.post("/api/events", { data: { title, category: "social", startsAt: `${inDays(2)}T16:30`, body, location: "Big room" } });
  expect(res.status()).toBe(201);
  return (await res.json()).event.id as string;
}

test.describe("Event details", () => {
  test("shows when and where, takes an answer, and never shows members a headcount", async ({ page, browser }) => {
    const admin = await signedIn(browser, ADMIN_EMAIL, "/admin");
    const title = uniqueText("Diwali potluck");
    const id = await postEvent(admin.page, title);
    await admin.close();

    await signInEmployee(page, uniqueEmail("event-reader"), `/feed/events/${id}`);
    await expect(page.locator(".m3")).not.toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const where = page.getByRole("region", { name: "When and where" });
    await expect(where).toContainText("Big room");
    await expect(where).toContainText("Bring one dish from home.");
    await expect(page.getByText(/\d+ going/)).toHaveCount(0);
    const api = (await (await page.request.get(`/api/events?event=${id}`)).json())[0];
    expect(api.going).toBeUndefined();

    const answer = page.getByRole("region", { name: "Are you going?" });
    await answer.getByRole("button", { name: "I'm going" }).click();
    await expect(answer.getByRole("button", { name: "You're going" })).toHaveAttribute("aria-pressed", "true");
    await answer.getByRole("button", { name: "Not this time" }).click();
    await expect(answer.getByRole("button", { name: "Not this time" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("link", { name: "Back to feed" }).click();
    await expect(page).toHaveURL(/\/feed/);
    // Home's Up next row doesn't count heads either (it used to read "undefined going").
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Up next" })).toBeVisible();
    await expect(page.getByText(/(undefined|\d+) going/)).toHaveCount(0);
  });

  test("a cancelled event says so and takes no answers; a removed one points back to the Feed", async ({ page, browser }) => {
    const admin = await signedIn(browser, ADMIN_EMAIL, "/admin");
    const id = await postEvent(admin.page, uniqueText("Quiz night"));
    const row = (await (await admin.page.request.get(`/api/events?event=${id}`)).json())[0];
    expect((await admin.page.request.delete("/api/events", { data: { id, expectedUpdatedAt: row.updatedAt ?? row.createdAt } })).ok()).toBe(true);
    await signInEmployee(page, uniqueEmail("event-cancel"), `/feed/events/${id}`);
    await expect(page.getByRole("status").filter({ hasText: "This event was cancelled" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Are you going?" })).toHaveCount(0);

    await page.goto("/feed/events/not-a-real-event");
    await expect(page.getByRole("heading", { name: "This event isn't here any more" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Feed", exact: true })).toHaveAttribute("href", "/feed");
    await admin.close();
  });
});

test.describe("Help", () => {
  test("questions open one at a time, with today's answers", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("helper"), "/help");
    await expect(page.locator(".m3")).not.toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();
    const leave = page.getByRole("button", { name: "How do I apply for leave?" });
    await leave.click();
    await expect(leave).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/In Zoho People, where your approver decides/)).toBeVisible();
    const speak = page.getByRole("button", { name: "Is Speak up really anonymous?" });
    await speak.click();
    await expect(leave).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText(/They don’t see your name, email or device/)).toBeVisible();
    // Nothing from the old app: no Remote mode, no in-app leave approvals, no Urgent.
    await expect(page.getByText(/choose Remote|approves or rejects|Mark it Urgent/)).toHaveCount(0);
  });
});

test.describe("Sign in", () => {
  test("one card: Continue with Google, and plain errors", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Use your @innovinlabs.com Google account.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute("href", /\/api\/auth\/google\?next=/);
    await expect(page.getByText(/Live Digital ID Card|Manage your workspace/)).toHaveCount(0);
    await page.goto("/sign-in?auth=failed");
    await expect(page.getByRole("alert").filter({ hasText: "That didn’t work" })).toHaveText("That didn’t work. Use your @innovinlabs.com Google account.");
    await page.goto("/sign-in?auth=busy");
    await expect(page.getByRole("alert").filter({ hasText: "Too many tries" })).toHaveText("Too many tries. Wait a minute and try again.");
  });
});

test.describe("Publish › Events", () => {
  test("an event takes details, and Edit changes it", async ({ page }) => {
    await signInEmployee(page, ADMIN_EMAIL, "/admin/publish?tab=events");
    const title = uniqueText("Book club");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Date").fill(inDays(3));
    await page.getByLabel("Time (IST)").fill("17:30");
    await page.getByLabel("Place").fill("Library corner");
    await page.getByLabel("Details (optional)").fill("Chapter 1 to 3.");
    await page.getByRole("button", { name: "Post event" }).click();
    await expect(page.getByText(/^Posted/)).toBeVisible();

    const before = (await (await page.request.get("/api/events")).json()).find((e: { title: string }) => e.title === title);
    await page.getByRole("button", { name: `Edit ${title}` }).click();
    const dialog = page.getByRole("dialog", { name: "Edit event" });
    await expect(dialog.getByLabel("Details (optional)")).toHaveValue("Chapter 1 to 3.");
    await dialog.getByLabel("Place").fill("Big room");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Saved. People going were told.")).toBeVisible();
    const event = (await (await page.request.get("/api/events")).json()).find((e: { title: string }) => e.title === title);
    expect(event).toMatchObject({ location: "Big room", body: "Chapter 1 to 3.", startsAt: before.startsAt }); // the IST time survives the round trip
  });
});

test.describe("Retired pages", () => {
  for (const [from, to] of [["/attendance", /\/days$/], ["/reading", /\/$/], ["/admin/tools", /\/admin$/]] as const) {
    test(`${from} goes to its new home`, async ({ page }) => {
      await signInEmployee(page, ADMIN_EMAIL, "/");
      await page.goto(from);
      await expect(page).toHaveURL(to);
    });
  }
});

test.describe("System pages", () => {
  test("the 404 is a Material 3 card with a way home", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("lost"), "/");
    const res = await page.goto("/profile");
    expect(res?.status()).toBe(404);
    const card = page.locator(".m3").filter({ has: page.getByRole("heading", { name: "Page not found" }) });
    await expect(card).toHaveCount(1);
    await expect(page.locator(".studio-main, .studio-nav")).toHaveCount(0); // no old top bar or frame
    await expect(page.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });
});
