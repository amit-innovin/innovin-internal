import { expect, test, signInEmployee, signInOffice, uniqueEmail, uniqueText } from "./fixtures";

test("a failed employee read offers recovery instead of an endless skeleton", async ({ page }) => {
  await signInEmployee(page, uniqueEmail(), "/");
  await page.route("**/api/people", route => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "Try again" }) }));
  await page.goto("/people");
  await expect(page.getByRole("alert").filter({ hasText: "Try again" })).toContainText("couldn't load");
  await page.unroute("**/api/people");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Everyone", exact: false })).toBeVisible();
});

test("whole-team paper notes reach the shared board after reload", async ({ page, isMobile }) => {
  await signInOffice(page, uniqueEmail());
  await page.getByRole("button", { name: "Write a paper note", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Drop a paper note", exact: true });
  await dialog.getByLabel("To", { exact: true }).selectOption("team");
  await expect(dialog).toContainText("Everyone can read this note");
  const body = uniqueText("A note for everyone");
  await dialog.getByLabel("Your note", { exact: true }).fill(body);
  await dialog.getByRole("button", { name: "Post to whole team", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  if (isMobile) await page.getByRole("button", { name: "Office Notice Board", exact: true }).click();
  await expect(page.getByRole("article").filter({ hasText: body })).toBeVisible();
  const rows = await (await page.request.get("/api/notices")).json();
  expect(rows.some((row: { body: string; anonymous: boolean }) => row.body === body && !row.anonymous)).toBe(true);
});

test("employee RSVP follows the account across devices", async ({ page, browser }) => {
  const email = uniqueEmail();
  await signInEmployee(page, email, "/");
  const title = uniqueText("Cross-device meetup");
  const event = await (await page.request.post("/api/events", { data: { title, category: "social", startsAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16), body: "", location: "Office" } })).json();
  expect(event.event.id).toBeTruthy();
  await page.request.patch("/api/events", { data: { eventId: event.event.id, going: true } });
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await signInEmployee(other, email, "/");
    const events = await (await other.request.get("/api/events")).json();
    expect(events.find((row: { id: string }) => row.id === event.event.id)).toMatchObject({ mine: true, going: 1 });
    await other.request.patch("/api/events", { data: { eventId: event.event.id, going: false } });
    const refreshed = await (await page.request.get("/api/events")).json();
    expect(refreshed.find((row: { id: string }) => row.id === event.event.id)).toMatchObject({ mine: false, going: 0 });
  } finally { await context.close(); }
});
