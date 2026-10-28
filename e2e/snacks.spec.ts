import { CLOSED_URL } from "../playwright.config";
import { expect,test,signInOffice } from "./fixtures";

test.describe("Meals & Snacks (requests open)",()=>{
  test("selections and notes save across pages, history and reload before cancellation",async({page,isMobile})=>{
    await signInOffice(page);await page.goto("/snacks");
    await expect(page.getByRole("button",{name:"Save pantry request",exact:true})).toBeDisabled();
    await page.getByRole("button",{name:/^Tea/}).click();
    await expect(page.getByText(/Request received.*Tea/)).toBeVisible();
    await page.getByRole("button",{name:/^Lunch/}).click();
    await expect(page.getByText(/Request received.*Tea.*Lunch/)).toBeVisible();
    await page.getByLabel("Special instructions").fill("  less sugar  ");
    await page.getByLabel("Special instructions").press("Tab");
    await expect.poll(async()=>{const data=await(await page.request.get("/api/snacks?scope=mine")).json();return data.items[0]?.instructions;}).toBe("less sugar");
    await page.reload();await expect(page.getByLabel("Special instructions")).toHaveValue("less sugar");
    await expect(page.getByRole("button",{name:/^Tea/})).toHaveAttribute("aria-pressed","true");
    await page.getByRole("button",{name:/^Tea/}).click();
    await expect(page.getByRole("button",{name:/^Tea/})).toHaveAttribute("aria-pressed","false");
    await page.getByRole("tab",{name:"History"}).click();
    await expect(page.getByText("Today ·")).toBeVisible();await expect(page.getByText("less sugar",{exact:true})).toBeVisible();
    await page.goto("/");await expect(page.locator(".home-shop-status,.phone-pantry-summary").filter({visible:true})).toContainText("Lunch");
    await page.goto("/snacks");await page.getByRole("button",{name:"Cancel today's request",exact:true}).click();
    await expect(page.getByRole("alertdialog")).toContainText("Lunch will be removed");
    await page.getByRole("alertdialog").getByRole("button",{name:"Cancel request",exact:true}).click();
    await expect(page.getByText("Pantry request cancelled",{exact:true})).toBeVisible();
    await page.reload();await expect(page.getByRole("button",{name:"Save pantry request",exact:true})).toBeDisabled();
    expect((await(await page.request.get("/api/snacks?scope=mine")).json()).items).toEqual([]);
  });
  test("keeping a request from the cancel dialog leaves it untouched",async({page})=>{
    await signInOffice(page);await page.goto("/snacks");await page.getByRole("button",{name:/^Healthy Option/}).click();
    await expect(page.getByText(/Request received.*Healthy Option/)).toBeVisible();
    await page.getByRole("button",{name:"Cancel today's request",exact:true}).click();
    await page.getByRole("alertdialog").getByRole("button",{name:"Keep request",exact:true}).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);await page.reload();
    await expect(page.getByRole("button",{name:/^Healthy Option/})).toHaveAttribute("aria-pressed","true");
  });
  test("each signed-in employee keeps their own request",async({browser})=>{
    const ca=await browser.newContext(),cb=await browser.newContext(),a=await ca.newPage(),b=await cb.newPage();
    await signInOffice(a);await a.goto("/snacks");await a.getByRole("button",{name:/^Tea/}).click();await expect(a.getByText(/Request received.*Tea/)).toBeVisible();
    await signInOffice(b);await b.goto("/snacks");await expect(b.getByText(/Nothing ordered yet/)).toBeVisible();
    expect((await(await b.request.get("/api/snacks?scope=mine")).json()).items).toEqual([]);await ca.close();await cb.close();
  });
});
test.describe("Meals & Snacks (after cutoff)",()=>{
  test.use({baseURL:CLOSED_URL});
  test("closed requests cannot be edited or cancelled",async({page,isMobile})=>{
    await signInOffice(page);await page.goto("/snacks");await expect(page.getByText("Orders are closed for today")).toBeVisible();
    await expect(page.getByRole("button",{name:/^Tea/})).toBeDisabled();await expect(page.getByLabel("Special instructions")).toBeDisabled();await expect(page.getByRole("button",{name:"Save pantry request",exact:true})).toBeDisabled();
    await page.goto("/pantry");await expect(page.getByText("Requests are closed for today. You can still browse and see your saved status.")).toBeVisible();
    await expect(page.getByRole("button",{name:"Send request",exact:true})).toBeDisabled();
  });
});
