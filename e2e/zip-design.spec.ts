import { expect, test, uniqueText, signInOffice } from "./fixtures";

test.describe("Supplied workspace design", () => {
  test("notice validation uses verified authors and protects private grievances", async ({ page }) => {
    await signInOffice(page);
    const payload = { kind: "feedback", title: "A team idea", body: uniqueText("Shared board feedback"), attribution: "", color: "peach", anonymous: false, authorEmail: "forged@innovinlabs.com", authorName: "Forged" };
    expect((await page.request.post("/api/notices", { data: { ...payload, kind: "script" } })).status()).toBe(400);
    expect((await page.request.post("/api/notices", { data: { ...payload, body: "x".repeat(2001) } })).status()).toBe(400);
    expect((await page.request.post("/api/notices", { data: payload })).status()).toBe(201);
    const identity = await (await page.request.get("/api/auth/me")).json();
    const rows = await (await page.request.get("/api/notices")).json();
    expect(rows.find((n: { body: string }) => n.body === payload.body).authorName).toBe(identity.name);
    const privateText = uniqueText("Private grievance must stay private");
    expect((await page.request.post("/api/grievances", { data: { body: privateText } })).ok()).toBe(true);
    expect(JSON.stringify(await (await page.request.get("/api/notices")).json())).not.toContain(privateText);
    const note = rows.find((n: { body: string }) => n.body === payload.body);
    expect((await page.request.delete("/api/notices", { data: { id: note.id } })).status()).toBe(403);
    expect((await page.request.patch("/api/notices", { data: { id: note.id, emoji: "invalid" } })).status()).toBe(400);
  });
});
