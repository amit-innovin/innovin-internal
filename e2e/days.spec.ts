import type { Page } from "@playwright/test";
import { expect, test, uniqueEmail, signInEmployee } from "./fixtures";

// The rebuilt Days screen (design canvas: D-Prototype "days", D-Desk-Days, D-Tab-Days, D-Days-Backfill).
type View = { today: string; month: string; fixableFrom: string; officeDays: number[]; days: { date: string; working: boolean; fixable: boolean; mode: string | null }[] };
const days = async (page: Page, month?: string): Promise<View> => (await page.request.get(month ? `/api/days?month=${month}` : "/api/days")).json();
const prevMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const longDay = (date: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const calendar = (page: Page) => page.getByRole("grid", { name: /Your days in/ });

// A working day you can still fix: in this month if there is one, else at the end of last month.
async function fixableDay(page: Page) {
  const now = await days(page);
  for (const view of [now, await days(page, prevMonth(now.month))]) {
    const day = view.days.filter((d) => d.fixable && d.working).at(-1);
    if (day) return { view, day };
  }
  throw new Error("no fixable working day in the last 7 days");
}

test.describe("Days", () => {
  test("fix one of your last 7 days: it counts and is flagged as added later", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("days-fix"), "/days");
    await expect(page.getByRole("heading", { level: 1, name: "Days" })).toBeVisible();
    const { view, day } = await fixableDay(page);
    if (view.month !== (await days(page)).month) await page.goto(`/days?month=${view.month}`);

    await calendar(page).getByRole("button", { name: `${longDay(day.date)}: nothing marked. Fix this day` }).click();
    const sheet = page.getByRole("dialog", { name: "Fix a day" });
    await expect(sheet).toContainText("Nothing is marked for this day. Where were you?");
    await expect(sheet.getByRole("radio", { name: "In office" })).toHaveAttribute("aria-checked", "true");
    await sheet.getByRole("button", { name: /^Save / }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByText(/marked In office$/)).toBeVisible();
    await expect(calendar(page).getByRole("button", { name: `${longDay(day.date)}: In office, added later. Fix this day` })).toBeVisible();
    await expect(page.getByText("1 of 8 office days")).toBeVisible();
    await page.screenshot({ path: `output/playwright/duo-days-${test.info().project.name}.png`, fullPage: true });

    // Change it to Remote, then clear it: each change is a second tap on the same day.
    await calendar(page).getByRole("button", { name: new RegExp(`^${longDay(day.date)}: In office`) }).click();
    await sheet.getByRole("radio", { name: "Remote" }).click();
    await sheet.getByRole("button", { name: /^Save / }).click();
    await expect(calendar(page).getByRole("button", { name: `${longDay(day.date)}: Remote, added later. Fix this day` })).toBeVisible();
    await expect(page.getByText("0 of 8 office days")).toBeVisible();
    await calendar(page).getByRole("button", { name: new RegExp(`^${longDay(day.date)}: Remote`) }).click();
    await sheet.getByRole("radio", { name: "Not working" }).click();
    await sheet.getByRole("button", { name: /^Save / }).click();
    await expect(calendar(page).getByRole("button", { name: `${longDay(day.date)}: nothing marked. Fix this day` })).toBeVisible();
  });

  test("an older day is locked and says who can change it", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("days-locked"), "/days");
    const month = prevMonth((await days(page)).month);
    const view = await days(page, month);
    const old = view.days.find((d) => d.working && d.date < view.fixableFrom)!;
    await page.goto(`/days?month=${month}`);
    await calendar(page).getByRole("button", { name: new RegExp(`^${longDay(old.date)}: .*Locked$`) }).click();
    const locked = page.getByRole("dialog", { name: "Day locked" });
    await expect(locked).toContainText("is locked");
    await expect(locked).toContainText("Anything older needs an admin");
    await locked.getByRole("button", { name: "OK" }).click();
    await expect(locked).toHaveCount(0);
    // Months are in the URL, and the next month can't go past this one.
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();
  });

  test("your office days are saved and shown", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("days-schedule"), "/days");
    await page.getByRole("button", { name: "Set your days" }).click();
    const sheet = page.getByRole("dialog", { name: "Your office days" });
    await sheet.getByRole("button", { name: "Mon", exact: true }).click();
    await sheet.getByRole("button", { name: "Wed", exact: true }).click();
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByText("Mon + Wed", { exact: true })).toBeVisible();
    expect((await days(page)).officeDays).toEqual([0, 2]);
    await page.reload();
    await expect(page.getByText("Mon + Wed", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Change days" })).toBeVisible();
  });

  test("leave: balances, the way to request, and your requests", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("days-leave"), "/days");
    await expect(page.getByRole("heading", { name: "Leave balance" }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText(/^of \d+(\.\d+)? CL$/).filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your requests" })).toBeVisible();
    await expect(page.getByText("No leave requests yet.")).toBeVisible();
    await page.getByRole("link", { name: "Request leave" }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/attendance\?tab=leave$/);
  });

  test("tablet width: one column, with the month's summary under the calendar", async ({ page, isMobile }) => {
    test.skip(isMobile, "phone layout is covered by the other Days tests");
    await page.setViewportSize({ width: 834, height: 1100 });
    await signInEmployee(page, uniqueEmail("days-tablet"), "/days");
    await expect(page.getByRole("complementary", { name: "This month" })).toBeHidden();
    await expect(page.getByRole("region", { name: "Office days this month" }).filter({ visible: true })).toBeVisible();
    await page.screenshot({ path: "output/playwright/duo-days-tablet.png", fullPage: true });
  });
});
