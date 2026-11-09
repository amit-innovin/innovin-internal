import { expect, test } from "./fixtures";

test("provider purchasing denies anonymous callers, and its page sends them to sign-in", async ({ page }) => {
  expect((await page.request.get("/api/pantry-provider")).status()).toBe(403);
  expect((await page.request.post("/api/pantry-provider", {data:{action:"checkout",version:null}})).status()).toBe(403);
  await page.goto("/admin/pantry");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Fpantry/);
});
test("coordinator connects, chooses variants, reviews the bill and places one provider order", async ({ page }, testInfo) => {
  await page.request.get("http://localhost:3999/as?email=admin@innovinlabs.com&name=Pantry%20admin");
  await page.goto("/api/auth/google?next=/admin/pantry");
  await page.request.get("http://localhost:3999/as?reset=1");
  await expect(page.getByRole("heading",{name:"Office purchasing",exact:true})).toBeVisible();
  const link = page.getByRole("link",{name:/^(Connect|Reconnect) Instamart$/});
  await expect(link).toBeVisible();
  if (await page.getByRole("button", {name:"Disconnect account",exact:true}).isVisible()) {
    await page.getByRole("button", {name:"Disconnect account",exact:true}).click();
    await expect(page.getByRole("link", {name:"Connect Instamart",exact:true})).toBeVisible();
  }
  await link.click();
  await expect(page.getByText("Instamart account connected. Choose the office address below.")).toBeVisible();
  await page.getByRole("button",{name:"Use this address",exact:true}).click();
  await page.getByRole("textbox",{name:"Search Instamart products"}).fill("biscuits");
  await page.getByRole("button",{name:"Search products",exact:true}).click();
  await page.getByRole("button",{name:"Add variant",exact:true}).click();
  await page.getByRole("combobox",{name:"Quantity for Test biscuits 200 g"}).selectOption("2");
  await page.getByRole("checkbox",{name:/reviewing this basket replaces/}).check();
  await page.getByRole("button",{name:"Price and review basket"}).click();
  await expect(page.getByRole("heading",{name:"4. Confirm the provider order"})).toBeVisible();
  await page.screenshot({ path:testInfo.outputPath("provider-review.png"), fullPage:true });
  await page.getByRole("combobox",{name:"Payment method"}).selectOption("COD");
  await page.getByRole("checkbox",{name:/I confirm these exact items/}).check();
  await page.getByRole("button",{name:"Place Instamart order · ₹80"}).click();
  await expect(page.getByRole("heading",{name:"Confirmed order"}).first()).toBeVisible();
  await expect(page.getByRole("button",{name:/Place Instamart order/})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading",{name:"Confirmed order"}).first()).toBeVisible();
  await page.getByRole("button",{name:/Refresh delivery/}).first().click();
  await expect(page.getByText("On the way · 10 minutes")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
