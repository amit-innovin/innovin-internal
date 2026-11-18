import type { Browser, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { ADMIN_EMAIL, expect, test, uniqueEmail, uniqueText, signInEmployee } from "./fixtures";
import { MOCK_URL } from "./mock-url";

// Admin events go out as Google Calendar invites (docs/superpowers/specs/2026-11-18-m3-calendar-invites-design.md).
// The Google mock (e2e/google-mock.ts) records every Calendar call, refresh and revoke.
test.describe.configure({ mode: "serial" });

type Call = { op: string; owner: string; id: string; sendUpdates: string | null; summary?: string; attendees?: string[] };
const calendarLog = async (page: Page) => (await (await page.request.get(`${MOCK_URL}/calendar-log`)).json()) as { log: Call[]; revoked: string[] };
const callsFor = async (page: Page, title: string) => (await calendarLog(page)).log.filter((c) => c.summary === title);
const mock = (page: Page, path: string) => page.request.get(`${MOCK_URL}${path}`);
const tomorrow = () => new Date(Date.now() + 5.5 * 3600_000 + 86_400_000).toISOString().slice(0, 10);

async function person(browser: Browser, prefix: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = uniqueEmail(prefix);
  await signInEmployee(page, email, "/");
  return { page, email, close: () => context.close() };
}

async function connect(page: Page) {
  await page.goto("/admin/publish?tab=events");
  const card = page.getByRole("region", { name: "Google Calendar" });
  const disconnect = card.getByRole("button", { name: "Disconnect" });
  await expect(disconnect.or(card.getByRole("link", { name: "Connect Google Calendar" }))).toBeVisible();
  if (await disconnect.count()) return card;
  await card.getByRole("link", { name: "Connect Google Calendar" }).click();
  await page.waitForURL(/\/admin\/publish/);
  await expect(card).toContainText("Invites go out from");
  return card;
}

async function postEvent(page: Page, title: string) {
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Date").fill(tomorrow());
  await page.getByLabel("Time (IST)").fill("16:00");
  await page.getByLabel("Place").fill("Big room");
  await page.getByRole("button", { name: "Post event" }).click();
}

async function makeAdmin(admin: Page, email: string) {
  expect((await admin.request.patch("/api/people", { data: { email, role: "admin" } })).ok()).toBe(true);
}

test.describe("Google Calendar invites", () => {
  test("connect, publish: one invite to every active person, and a retry never sends a second", async ({ page, browser }) => {
    const member = await person(browser, "cal-member");
    const leaver = await person(browser, "cal-leaver");
    await member.close(); await leaver.close();
    await signInEmployee(page, ADMIN_EMAIL, "/admin");
    expect((await page.request.patch("/api/people", { data: { email: leaver.email, left: true } })).ok()).toBe(true);

    await connect(page);
    const title = uniqueText("Diwali potluck");
    await postEvent(page, title);
    await expect(page.getByText("Posted. Invites sent")).toBeVisible();

    const inserts = (await callsFor(page, title)).filter((c) => c.op === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ owner: ADMIN_EMAIL, sendUpdates: "all" });
    expect(inserts[0].attendees).toContain(member.email);
    expect(inserts[0].attendees).not.toContain(leaver.email);
    expect(inserts[0].attendees).not.toContain(ADMIN_EMAIL);
    expect(new Set(inserts[0].attendees).size).toBe(inserts[0].attendees!.length);

    // Sending again (double submit, retry) updates the same Google event.
    const event = (await (await page.request.get("/api/events")).json()).find((e: { title: string }) => e.title === title);
    expect((await page.request.post("/api/admin/calendar/invite", { data: { id: event.id } })).ok()).toBe(true);
    const after = await callsFor(page, title);
    expect(after.filter((c) => c.op === "insert")).toHaveLength(1);
    expect(after.every((c) => c.id === inserts[0].id)).toBe(true);
  });

  test("the token is stored sealed, never in the clear", async ({ page }) => {
    test.skip(!!process.env.E2E_DATABASE_URL, "JSON store only");
    await signInEmployee(page, ADMIN_EMAIL, "/admin");
    await connect(page);
    const raw = readFileSync(".test-data/main.json", "utf8");
    expect(raw).toContain(`"calendarTokens"`);
    expect(raw).not.toMatch(/rt:admin@innovinlabs\.com/);
  });

  test("a new joiner is added quietly; someone marked as left is taken off", async ({ page, browser }) => {
    await signInEmployee(page, ADMIN_EMAIL, "/admin");
    await connect(page);
    const title = uniqueText("Team lunch");
    await postEvent(page, title);
    await expect(page.getByText("Posted. Invites sent")).toBeVisible();

    const joiner = await person(browser, "cal-joiner");
    await joiner.close();
    await expect.poll(async () => (await callsFor(page, title)).some((c) => c.op === "patch" && c.attendees?.includes(joiner.email) && c.sendUpdates === "none")).toBe(true);

    expect((await page.request.patch("/api/people", { data: { email: joiner.email, left: true } })).ok()).toBe(true);
    await expect.poll(async () => {
      const patches = (await callsFor(page, title)).filter((c) => c.op === "patch");
      return patches.length > 0 && !patches[patches.length - 1].attendees!.includes(joiner.email);
    }).toBe(true);
  });

  test("cancelling in the app cancels the invite and tells guests", async ({ page }) => {
    await signInEmployee(page, ADMIN_EMAIL, "/admin");
    await connect(page);
    const title = uniqueText("Board games night");
    await postEvent(page, title);
    await expect(page.getByText("Posted. Invites sent")).toBeVisible();
    await page.getByRole("button", { name: `Cancel ${title}` }).click();
    await expect.poll(async () => (await callsFor(page, title)).find((c) => c.op === "delete")?.sendUpdates).toBe("all");
  });

  test("disconnecting hands invites to the next connected admin, then revokes and forgets", async ({ page, browser }) => {
    await signInEmployee(page, ADMIN_EMAIL, "/admin");
    await connect(page);
    const second = await person(browser, "cal-admin");
    await makeAdmin(page, second.email);
    await connect(second.page);
    const title = uniqueText("Quiz hour");
    await postEvent(second.page, title);
    await expect(second.page.getByText("Posted. Invites sent")).toBeVisible();
    const first = (await callsFor(page, title)).find((c) => c.op === "insert")!;
    expect(first.owner).toBe(second.email);

    const card = second.page.getByRole("region", { name: "Google Calendar" });
    await card.getByRole("button", { name: "Disconnect" }).click();
    await expect(card).toContainText(/1 upcoming invite moves to/);
    await card.getByRole("button", { name: "Disconnect", exact: true }).last().click();
    await expect(card.getByRole("link", { name: "Connect Google Calendar" })).toBeVisible();

    const calls = await callsFor(page, title);
    const moved = calls.find((c) => c.op === "insert" && c.owner === ADMIN_EMAIL)!;
    expect(moved.sendUpdates).toBe("none");
    // Same guests, except the old organizer is now one of them and the new one isn't.
    const others = (list: string[] = []) => list.filter((e) => e !== second.email && e !== ADMIN_EMAIL).sort();
    expect(others(moved.attendees)).toEqual(others(first.attendees));
    expect(moved.attendees).toContain(second.email);
    expect(moved.attendees).not.toContain(ADMIN_EMAIL);
    expect(calls.find((c) => c.op === "delete" && c.owner === second.email)?.sendUpdates).toBe("none");
    expect((await calendarLog(page)).revoked.some((t) => t.startsWith(`rt:${second.email}:`))).toBe(true);
    await second.close();
  });

  test("losing admin retires the connection; with a dead token the invite is orphaned, not duplicated", async ({ page, browser }) => {
    await signInEmployee(page, ADMIN_EMAIL, "/admin");
    const other = await person(browser, "cal-gone");
    await makeAdmin(page, other.email);
    await connect(other.page);
    const title = uniqueText("Offsite briefing");
    await postEvent(other.page, title);
    await expect(other.page.getByText("Posted. Invites sent")).toBeVisible();
    await other.close();

    await mock(page, `/calendar-kill?email=${encodeURIComponent(other.email)}`);
    expect((await page.request.patch("/api/people", { data: { email: other.email, role: "member" } })).ok()).toBe(true);
    // Nothing copied (the old one can't be removed), and admins are told.
    expect((await callsFor(page, title)).filter((c) => c.op === "insert")).toHaveLength(1);
    await page.goto("/admin");
    await expect(page.getByRole("region", { name: "Needs you" })).toContainText(`Google invite can't be changed · ${title}`);
    await mock(page, `/calendar-revive?email=${encodeURIComponent(other.email)}`);
  });

  test("a dead token: the event still posts, Needs you asks to reconnect, Send again works once reconnected", async ({ page, browser }) => {
    const admin = await person(browser, "cal-dead");
    await signInEmployee(page, ADMIN_EMAIL, "/admin");
    await makeAdmin(page, admin.email);
    await connect(admin.page);
    await mock(page, `/calendar-kill?email=${encodeURIComponent(admin.email)}`);
    const title = uniqueText("Yoga session");
    await postEvent(admin.page, title);
    await expect(admin.page.getByText("Posted. Google invite didn't go out")).toBeVisible();
    await admin.page.goto("/admin");
    await expect(admin.page.getByRole("region", { name: "Needs you" })).toContainText(`Google invite didn't go out · ${title}`);

    await mock(page, `/calendar-revive?email=${encodeURIComponent(admin.email)}`);
    await connect(admin.page);
    await admin.page.getByRole("button", { name: `Send invite for ${title} again` }).click();
    await expect.poll(async () => (await callsFor(page, title)).filter((c) => c.op === "insert").length).toBe(1);
    await admin.close();
  });

  test("connect refuses another Google account and a grant without calendar access", async ({ page, browser }) => {
    const someone = await person(browser, "cal-check");
    const me = someone.email;
    await signInEmployee(page, ADMIN_EMAIL, "/admin");
    await makeAdmin(page, me);
    await someone.close();
    await signInEmployee(page, me, "/admin/publish?tab=events");
    const card = page.getByRole("region", { name: "Google Calendar" });
    await mock(page, `/calendar-as?email=${encodeURIComponent("someone.else@innovinlabs.com")}`);
    await card.getByRole("link", { name: "Connect Google Calendar" }).click();
    await page.waitForURL(/\/admin\/publish/);
    await expect(page.getByText(`Connect with your own work account (${me})`)).toBeVisible();
    await expect(card.getByRole("link", { name: "Connect Google Calendar" })).toBeVisible();

    await mock(page, "/calendar-noscope?on=1");
    await card.getByRole("link", { name: "Connect Google Calendar" }).click();
    await page.waitForURL(/\/admin\/publish/);
    await mock(page, "/calendar-noscope?on=0");
    await expect(page.getByText("Calendar access wasn't allowed. Try again and tick the calendar box.")).toBeVisible();
    await expect(card.getByRole("link", { name: "Connect Google Calendar" })).toBeVisible();
  });
});
