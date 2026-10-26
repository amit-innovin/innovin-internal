import { afterEach, beforeEach, expect, it, vi } from "vitest";
const employee = "12345678901234567890";
beforeEach(() => vi.resetModules());
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function configure() {
  vi.stubEnv("ZOHO_CLIENT_ID", "test-client"); vi.stubEnv("ZOHO_CLIENT_SECRET", "test-secret"); vi.stubEnv("ZOHO_REFRESH_TOKEN", "test-refresh");
  vi.stubEnv("ZOHO_DATA_CENTER", "in"); vi.stubEnv("ZOHO_DATE_FORMAT", "yyyy-MM-dd");
  vi.stubEnv("ZOHO_EMPLOYEE_IDS", JSON.stringify({ "a@innovinlabs.com": employee }));
  vi.stubEnv("ZOHO_LEAVE_TYPE_IDS", JSON.stringify({ cl: "1", sl: "2", el: "3", fl: "4" }));
}
function provider(wrongEmployee = false) {
  return vi.fn(async (input: string | URL) => {
    const url = new URL(input.toString());
    if (url.hostname.startsWith("accounts.")) return Response.json({ access_token: "fixture-token", expires_in: 3600 });
    expect(url.hostname).toBe("people.zoho.in");
    expect(JSON.parse(url.searchParams.get("employee")!)).toEqual([employee]);
    if (url.pathname.includes("bookedAndBalance")) return Response.json({ report: { [employee]: { "1": { balance: 3, booked: 1 }, "2": { balance: "", booked: 0 }, "3": { balance: 12, booked: 0 }, "4": { balance: 1, booked: 0 } } } });
    return Response.json({ records: { "r1": { "Employee.ID": wrongEmployee ? "9999" : employee, ApprovalStatus: "Approved", Unit: "Days", From: "2026-11-02", To: "2026-11-02", Leavetype: "Casual", Days: { "2026-11-02": { LeaveCount: 1 } }, Reason: "Private reason must not be returned" } } });
  });
}
it("preserves unsafe numeric provider IDs without rounding", async () => {
  const { parseZohoJSON } = await import("@/lib/zoho-people");
  expect(parseZohoJSON('{"Employee.ID":12345678901234567890}')).toEqual({ "Employee.ID": employee });
});
it("shows an honest disconnected state without making a provider request", async () => {
  vi.stubEnv("ZOHO_CLIENT_ID", "");
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const { zohoLeave } = await import("@/lib/zoho-people");
  expect((await zohoLeave("a@innovinlabs.com", 2026)).state).toBe("not-connected");
  expect(fetcher).not.toHaveBeenCalled();
});
it("reads only the mapped employee and keeps missing balances distinct from zero", async () => {
  configure(); const fetcher = provider(); vi.stubGlobal("fetch", fetcher);
  const { zohoLeave } = await import("@/lib/zoho-people");
  const result = await zohoLeave("a@innovinlabs.com", 2026);
  expect(result.state).toBe("ready");
  expect(result.data?.balances.find(b => b.type === "sl")?.remaining).toBeNull();
  expect(result.data?.approved).toHaveLength(1);
  expect(JSON.stringify(result)).not.toContain("Private reason");
  expect((await zohoLeave("b@innovinlabs.com", 2026)).state).toBe("unmapped");
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it("fails closed when the provider returns another employee", async () => {
  configure(); vi.stubGlobal("fetch", provider(true));
  const { zohoLeave } = await import("@/lib/zoho-people");
  const result = await zohoLeave("a@innovinlabs.com", 2026);
  expect(result.state).toBe("unavailable");
  expect(result.data).toBeUndefined();
});
