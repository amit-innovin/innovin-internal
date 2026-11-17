import type { Page } from "@playwright/test";
import { futureWorkday } from "./dates";
import { expect, test, uniqueEmail, signInEmployee } from "./fixtures";

// The Material 3 Days screen (prototype: docs/design/m3/Prototype.dc.html, "Days").
// Dates come from the server's own view, so these tests hold on any calendar day.
type Day = { date: string; working: boolean; fixable: boolean; mode: string | null; planned: boolean };
type View = { today: string; month: string; fixableFrom: string; officeDays: number[]; days: Day[] };
const view = async (page: Page, month?: string): Promise<View> => (await page.request.get(month ? `/api/days?month=${month}` : "/api/days")).json();
const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const longDay = (date: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const calendar = (page: Page) => page.getByRole("group", { name: /^Your days in / });
const cell = (page: Page, date: string) => calendar(page).getByRole("button", { name: new RegExp(`^${longDay(date)}[,.]`) });
const FUTURE = futureWorkday();

async function openMonthOf(page: Page, date: string) {
  await page.goto(`/days?month=${date.slice(0, 7)}`);
  await expect(calendar(page)).toBeVisible();
}

test.describe("Days", () => {
  test("plan a single future day in, and a double tap doesn't undo it", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("days-plan"), "/days");
    await expect(page.getByRole("heading", { level: 1, name: "Days" })).toBeVisible();
    await openMonthOf(page, FUTURE);
    await cell(page, FUTURE).click();
    const sheet = page.getByRole("dialog", { name: "Plan this day" });
    await expect(sheet).toContainText("Not planned yet");
    await sheet.getByRole("button", { name: "Plan to come in" }).dblclick();
    await expect(sheet).toHaveCount(0);
    await expect(cell(page, FUTURE)).toHaveAccessibleName(new RegExp(`^${longDay(FUTURE)}, planned\\.`));
    const coming = page.getByRole("region", { name: "Coming up" });
    await expect(coming).toContainText("Added by you");
    await expect(coming.locator(".m3-avatar")).toHaveCount(0);
    await page.screenshot({ path: `output/playwright/m3-days-${test.info().project.name}.png`, fullPage: true });
  });

  test("a usual day can be taken out of the plan", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("days-unplan"), "/days");
    const weekday = (new Date(`${FUTURE}T00:00:00Z`).getUTCDay() + 6) % 7;
    expect((await page.request.patch("/api/days", { data: { officeDays: [weekday] } })).ok()).toBe(true);
    await openMonthOf(page, FUTURE);
    await expect(page.getByRole("region", { name: "Coming up" })).toContainText("Your usual day");
    await cell(page, FUTURE).click();
    await page.getByRole("dialog", { name: "Plan this day" }).getByRole("button", { name: "Remove from my plan" }).click();
    await expect(cell(page, FUTURE)).toHaveAccessibleName(new RegExp(`^${longDay(FUTURE)}\\. Tap to plan`));
  });

  test("apply for leave from a date, see it pending, and cancel it", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("days-leave"), "/days");
    await expect(page.getByRole("group", { name: "Leave left" })).toContainText("Casual");
    await openMonthOf(page, FUTURE);
    await cell(page, FUTURE).click();
    const sheet = page.getByRole("dialog", { name: "Plan this day" });
    await sheet.getByRole("button", { name: "Apply for leave" }).click();
    await expect(sheet).toContainText("Your request goes for approval. You'll see its status here.");
    await expect(sheet.getByRole("button", { name: "Send request" })).toBeDisabled();
    await sheet.getByRole("button", { name: /^Casual/ }).click();
    await expect(sheet.getByRole("switch", { name: "Half day" })).toBeVisible();
    await sheet.getByRole("button", { name: "Send request" }).click();
    await expect(sheet).toHaveCount(0);
    // Leave days aren't buttons; their state is read out from the cell's text.
    await expect(calendar(page).getByText(`${longDay(FUTURE)}, leave requested`)).toHaveCount(1);
    const requests = page.getByRole("region", { name: "Your leave requests" });
    await expect(requests).toContainText("Pending");
    await requests.getByRole("button", { name: /^Cancel / }).click();
    await expect(requests).toContainText("Cancelled");
    await expect(cell(page, FUTURE)).toHaveAccessibleName(new RegExp(`^${longDay(FUTURE)}\\. Tap to plan`));
  });

  test("fix one of your last 7 days: in office or not in office", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("days-fix"), "/days");
    const now = await view(page);
    let target: { month: string; day: Day } | null = null;
    for (const month of [now.month, shiftMonth(now.month, -1)]) {
      const day = (await view(page, month)).days.filter((d) => d.fixable && d.working).at(-1);
      if (day) { target = { month, day }; break; }
    }
    expect(target, "a fixable working day in the last 7 days").not.toBeNull();
    await page.goto(`/days?month=${target!.month}`);
    await cell(page, target!.day.date).click();
    const sheet = page.getByRole("dialog", { name: "Fix a day" });
    await expect(sheet).toContainText("Marked later, so there's no location check.");
    await expect(sheet.getByRole("radio")).toHaveCount(2);
    await sheet.getByRole("radio", { name: "In office", exact: true }).click();
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(cell(page, target!.day.date)).toHaveAccessibleName(new RegExp(`^${longDay(target!.day.date)}, done\\. Tap to fix`));
    await cell(page, target!.day.date).click();
    await sheet.getByRole("radio", { name: "Not in office" }).click();
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(cell(page, target!.day.date)).toHaveAccessibleName(new RegExp(`^${longDay(target!.day.date)}\\. Tap to fix`));
  });

  test("an older day is locked and says who can change it", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("days-locked"), "/days");
    const month = shiftMonth((await view(page)).month, -1);
    const old = (await view(page, month)).days.find((d) => d.working && !d.fixable && d.mode === null)!;
    await page.goto(`/days?month=${month}`);
    await cell(page, old.date).click();
    const locked = page.getByRole("dialog", { name: "Day locked" });
    await expect(locked).toContainText("You can fix your own last 7 days. Anything older needs an admin.");
    await locked.getByRole("button", { name: "OK" }).click();
    await expect(locked).toHaveCount(0);
  });

  test("a short legend, and months up to two ahead", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("days-legend"), "/days");
    await expect(page.locator("[data-legend] > span")).toHaveText(["Done", "Planned", "Leave"]);
    await expect(page.getByRole("heading", { name: "Still to plan" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Working remote" })).toHaveCount(0);
    const next = page.getByRole("button", { name: "Next month" });
    await next.click();
    await next.click();
    await expect(next).toBeDisabled();
  });

  test("your usual office days are saved", async ({ page }) => {
    await signInEmployee(page, uniqueEmail("days-usual"), "/days");
    const usual = page.getByRole("region", { name: "Your usual office days" });
    await usual.getByRole("button", { name: "Monday" }).click();
    await expect(usual.getByRole("button", { name: "Monday" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await view(page)).officeDays).toEqual([0]);
  });
});
