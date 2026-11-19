import { ADMIN_EMAIL, expect, test, signInEmployee, signInOffice } from "./fixtures";

test.describe("Navigation", () => {
  test("the new shell reaches every module", async ({ page, isMobile }) => {
    await signInEmployee(page, undefined, "/");
    const main = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
    await expect(main.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");

    await main.getByRole("link", { name: "Days", exact: true }).click();
    await expect(page).toHaveURL(/\/days$/);
    await expect(page.getByRole("heading", { level: 1, name: "Days" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Days", exact: true })).toHaveAttribute("aria-current", "page");

    await main.getByRole("link", { name: /^Feed(, \d+ new)?$/ }).click();
    await expect(page).toHaveURL(/\/feed$/);
    await expect(main.getByRole("link", { name: /^Feed(, \d+ new)?$/ })).toHaveAttribute("aria-current", "page");

    await page.goto("/");
    if (isMobile) {
      await main.getByRole("link", { name: "Account", exact: true }).click();
      // Account's header is your name (prototype); the page is known by its Sign out row.
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    } else {
      await main.getByRole("link", { name: "10K steps", exact: true }).click();
      await expect(page).toHaveURL(/\/steps$/);
      for (const [item, heading] of [["Settings", "Account"], ["Help", "Help"]]) {
        await page.goto("/");
        await page.getByRole("button", { name: "Account menu" }).click();
        await page.getByRole("menuitem", { name: item, exact: true }).click();
        if (heading === "Account") await expect(page.getByRole("button", { name: "Sign out" }).filter({ visible: true }).last()).toBeVisible();
        else await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      }
    }
  });

  test("retired routes redirect to their new homes", async ({ page }) => {
    await signInEmployee(page, undefined, "/");
    for (const [from, to] of [["/settings", /\/account$/], ["/events", /\/feed\?filter=event$/], ["/board", /\/feed$/], ["/attendance", /\/days$/], ["/leave", /\/days$/], ["/reading", /\/$/]] as const) {
      await page.goto(from);
      await expect(page).toHaveURL(to);
    }
  });

  test("an admin reaches the admin app from Account, and anyone reaches Help from Account", async ({ page }) => {
    await signInEmployee(page, ADMIN_EMAIL, "/account");
    await page.getByRole("link", { name: /^Admin/ }).filter({ visible: true }).first().click();
    // The admin app opens on Today, with Needs you first.
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await page.goto("/account");
    await page.getByRole("link", { name: "Help" }).filter({ visible: true }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Is Speak up really anonymous?" })).toBeVisible();
  });

  test("main pages have no redundant back links; detail pages get one on phones", async ({ page, isMobile }) => {
    await signInEmployee(page, undefined, "/");
    for (const path of ["/feed", "/days", "/snacks", "/account"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: "Back to home" })).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Main" }).filter({ visible: true })).toBeVisible();
    }
    // Help is a detail page under Account: a back arrow on phones.
    await page.goto("/help");
    await expect(page.getByRole("link", { name: "Back to account" }).filter({ visible: true })).toHaveCount(isMobile ? 1 : 0);
    // Opened from the bell / the Home tile, these show a back arrow where there's no sidebar.
    for (const path of ["/notifications", "/steps"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: "Back to home" }).filter({ visible: true })).toHaveCount(isMobile ? 1 : 0);
    }
  });

  test("Home reflects a day already marked", async ({ page }) => {
    await signInOffice(page);
    await page.goto("/");
    await expect(page.getByText(/^In office · \d{1,2}:\d{2}/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Check in", exact: true })).toHaveCount(0);
  });

  test("unknown pages show the branded 404 with a way home", async ({ page }) => {
    await signInEmployee(page, undefined, "/");
    const res = await page.goto("/profile");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  // Removed features: their old links (bookmarks, notifications, chat messages) go Home with a
  // temporary redirect — never a 404. The old query string rides along (Next passes it
  // through) and Home ignores it, so the assertion is on the path.
  for (const old of ["/pantry", "/planner", "/people?ping=a%40innovinlabs.com", "/admin/pantry"]) {
    test(`old link ${old} lands on Home when signed in`, async ({ page }) => {
      await signInEmployee(page, undefined, "/");
      const res = await page.goto(old);
      expect(res?.status()).toBe(200);
      await expect(page).toHaveURL((url) => url.pathname === "/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
    test(`old link ${old} asks a signed-out visitor to sign in`, async ({ page }) => {
      await page.goto(old);
      await expect(page).toHaveURL(/\/sign-in/);
    });
  }

  test("navigation offers no removed feature and no Admin entry to a member", async ({ page, isMobile }) => {
    await signInEmployee(page, undefined, "/");
    const main = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
    await expect(main.getByRole("link").first()).toBeAttached();
    if (isMobile) await expect(main.getByRole("link")).toHaveText(["Home", /^\d*Feed$/, "Days", "Snacks", "Account"]);
    else {
      await expect(main.getByRole("link", { name: /^(Home|Feed(, \d+ new)?|Days|Tea & snacks|10K steps|Speak up)$/ })).toHaveCount(6);
      await page.getByRole("button", { name: "Account menu" }).click();
      await expect(page.getByRole("menuitem")).toHaveText(["Settings", "Help", "Sign out"]);
    }
    await expect(page.getByRole("link", { name: /pantry|plans|people|reading/i, includeHidden: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Admin", exact: true, includeHidden: true })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Admin", includeHidden: true })).toHaveCount(0);
  });

  test("signed-in pages never overflow horizontally", async ({ page }) => {
    await signInOffice(page);
    for (const path of ["/", "/days", "/notifications", "/feed", "/snacks", "/steps", "/account", "/attendance", "/grievances", "/wifi", "/help"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBeLessThanOrEqual(0);
    }
  });

});
