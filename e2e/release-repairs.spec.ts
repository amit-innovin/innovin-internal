import { expect, test, signInEmployee, uniqueEmail, uniqueText } from "./fixtures";

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
