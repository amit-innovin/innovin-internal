import { test, expect, signInEmployee, uniqueEmail } from "./fixtures";
test("an ordinary member cannot access supplier credentials or operations", async ({page})=>{
  await signInEmployee(page,uniqueEmail("pantry-member"),"/settings");
  expect((await page.request.get("/api/pantry-provider")).status()).toBe(403);
  expect((await page.request.post("/api/pantry-provider",{data:{action:"history",version:null}})).status()).toBe(403);
});
test("a lost checkout response stays blocked after reload and is reconciled from matching live history", async ({page})=>{
  await signInEmployee(page,"admin@innovinlabs.com","/admin/pantry");
  const link=page.getByRole("link",{name:/^(Connect|Reconnect) Instamart$/});await expect(link).toBeVisible();
  if(await page.getByRole("button",{name:"Disconnect account",exact:true}).isVisible()) {
    await page.getByRole("button",{name:"Disconnect account",exact:true}).click();
    await expect(page.getByRole("link",{name:"Connect Instamart",exact:true})).toBeVisible();
  }
  await link.click();
  await page.getByRole("button",{name:"Use this address",exact:true}).click();
  await page.getByRole("textbox",{name:"Search Instamart products"}).fill("biscuits");
  await page.getByRole("button",{name:"Search products",exact:true}).click();
  await page.getByRole("button",{name:"Add variant",exact:true}).click();
  await page.getByRole("combobox",{name:"Quantity for Test biscuits 200 g"}).selectOption("2");
  await page.getByRole("checkbox",{name:/reviewing this basket replaces/}).check();
  await page.getByRole("button",{name:"Price and review basket"}).click();
  await page.getByRole("combobox",{name:"Payment method"}).selectOption("COD");
  await page.getByRole("checkbox",{name:/I confirm these exact items/}).check();
  await page.request.get("http://localhost:3998/fixture/lose-next-checkout");
  await page.getByRole("button",{name:"Place Instamart order · ₹80"}).click();
  await expect(page.getByRole("heading",{name:"Outcome unconfirmed - do not reorder"})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading",{name:"Outcome unconfirmed - do not reorder"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Search products",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Check recent provider orders",exact:true}).click();
  await page.locator("li").filter({hasText:/CONFIRMED · ₹80/}).first().getByRole("checkbox").check();
  await page.getByRole("button",{name:"Confirm selected provider orders match this submission"}).click();
  await expect(page.getByRole("heading",{name:"Outcome unconfirmed - do not reorder"})).toHaveCount(0);
  await expect(page.getByText("Instamart order confirmed from provider history after reconciliation.").first()).toBeVisible();
});
