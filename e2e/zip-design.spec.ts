import { expect, test, uniqueText, signInOffice } from "./fixtures";

test.describe("Supplied workspace design", () => {
  test("board posts, anonymous authors and reactions persist through the real API", async ({ page, isMobile }) => {
    expect((await page.request.get("/api/notices")).status()).toBe(401);
    expect((await page.request.post("/api/notices", { data: { body: "Denied" } })).status()).toBe(401);
    await signInOffice(page);
    if (isMobile) await page.getByRole("button", { name: "Office Notice Board", exact: true }).click();
    await expect(page.getByRole("heading", { name: isMobile ? "Notice Board" : "Office Notice Board", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Post Note", exact: true }).click();
    const text = uniqueText("A thoughtful team builds useful things");
    await page.getByLabel("Your board note").fill(text);
    await page.getByRole("dialog").getByLabel("Post anonymously").check();
    await page.getByRole("button", { name: "blue memo" }).click();
    await page.getByRole("button", { name: "Pin to board" }).click();
    const card = page.getByRole("article").filter({ hasText: text });
    await expect(card).toContainText("Anonymous Teammate");
    await card.getByRole("button", { name: "React ❤️", exact: true }).click();
    await expect(card.getByRole("button", { name: "React ❤️", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    if (isMobile) await page.getByRole("button", { name: "Office Notice Board", exact: true }).click();
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "React ❤️", exact: true })).toHaveAttribute("aria-pressed", "true");
    const rows = await (await page.request.get("/api/notices")).json();
    const row = rows.find((n: { body: string }) => n.body === text);
    expect(row.anonymous).toBe(true);
    expect(row.authorName).toBeNull();
    expect(row).not.toHaveProperty("authorEmail");
    expect(row.reactions.find((r: { emoji: string }) => r.emoji === "❤️")).toMatchObject({ count: 1, mine: true });
    expect(JSON.stringify(row.reactions)).not.toContain("@innovinlabs.com");
    await page.getByRole("button", { name: /Feedback/ }).click();
    await expect(card).toHaveCount(0);
    await page.getByRole("button", { name: /Quotes/ }).click();
    await expect(card).toBeVisible();
    await page.screenshot({ path: `output/playwright/zip-board-${test.info().project.name}.png`, fullPage: true });
  });

  test("three-column overview and phone wallet expose the connected tools without overflow", async ({ page, isMobile }) => {
    await signInOffice(page);
    if (isMobile) {
      await expect(page.locator(".phone-id-name")).toBeVisible();
      await expect(page.getByRole("button", { name: "Expand Pantry", exact: true })).toBeVisible();
      await page.screenshot({ path: "output/playwright/zip-wallet-mobile.png", fullPage: true });
      await page.getByRole("button", { name: "Expand Pantry", exact: true }).click();
    } else {
      await expect(page.locator(".dashboard-grid > .dash-col")).toHaveCount(3);
      await expect(page.getByRole("heading", { name: "Office Notice Board", exact: true })).toBeVisible();
    }
    await page.getByRole("searchbox", { name: "Search pantry" }).fill("Tea");
    await page.getByRole("button", { name: "Add Tea", exact: true }).click();
    await expect(page.locator(".pantry-cart-items")).toContainText("Tea");
    expect((await (await page.request.get("/api/snacks?scope=mine")).json()).items.some((r: { itemId: string }) => r.itemId === "tea")).toBe(true);
    await page.getByRole("button", { name: "Clear pantry search" }).click();
    await page.screenshot({ path: `output/playwright/zip-overview-${test.info().project.name}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (!isMobile) {
      await expect(page.getByRole("button", { name: "Phone View", exact: true })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "People in Office", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Add event", exact: true })).toBeVisible();
    }
  });

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
