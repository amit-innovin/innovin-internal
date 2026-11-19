import { ADMIN_EMAIL, expect, test, signInEmployee, uniqueEmail, uniqueText } from "./fixtures";

test("employee RSVP follows the account across devices", async ({ page, browser }) => {
  const email = uniqueEmail();
  await signInEmployee(page, email, "/");
  const title = uniqueText("Cross-device meetup");
  // Events are published by admins.
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await signInEmployee(adminPage, ADMIN_EMAIL, "/");
  const event = await (await adminPage.request.post("/api/events", { data: { title, category: "social", startsAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16), body: "", location: "Office" } })).json();
  await adminContext.close();
  expect(event.event.id).toBeTruthy();
  await page.request.patch("/api/events", { data: { eventId: event.event.id, going: true } });
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await signInEmployee(other, email, "/");
    const events = await (await other.request.get("/api/events")).json();
    expect(events.find((row: { id: string }) => row.id === event.event.id)).toMatchObject({ mine: true });
    await other.request.patch("/api/events", { data: { eventId: event.event.id, going: false } });
    const refreshed = await (await page.request.get("/api/events")).json();
    expect(refreshed.find((row: { id: string }) => row.id === event.event.id)).toMatchObject({ mine: false });
  } finally { await context.close(); }
});
