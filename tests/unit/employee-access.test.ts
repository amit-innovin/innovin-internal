import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as attendance, POST as mark } from "@/app/api/attendance/route";
import { GET as directory } from "@/app/api/people/route";
import { GET as away, POST as requestAway } from "@/app/api/away/route";
import { GET as steps } from "@/app/api/steps/route";

vi.mock("@/lib/store", () => ({ store: {
  listAttendance: vi.fn(async () => []), getAttendance: vi.fn(async () => null),
  listEmployees: vi.fn(async () => []), listAttendanceRange: vi.fn(async () => []),
  addAway: vi.fn(async (row: unknown) => row),
}, id: () => "unused" }));
afterEach(() => vi.unstubAllEnvs());

describe("employee access", () => {
  it("rejects guest reads and writes even with a remembered company email", async () => {
    vi.stubEnv("SESSION_SECRET", "test-secret");
    for (const cookie of ["", "innovin_email=owner@innovinlabs.com", "innovin_user=forged.signature"]) {
      for (const path of ["/api/attendance", "/api/attendance?month=2026-10", "/api/people", "/api/away?scope=mine", "/api/steps"]) {
        const req = new NextRequest(`https://internal.example${path}`, { headers: { cookie } });
        const res = path.startsWith("/api/people") ? await directory(req)
          : path.startsWith("/api/away") ? await away(req)
          : path.startsWith("/api/steps") ? await steps(req) : await attendance(req);
        expect(res.status).toBe(401);
      }
      const res = await mark(new NextRequest("https://internal.example/api/attendance", {
        method: "POST", headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ email: "owner@innovinlabs.com", action: "in" }),
      }));
      expect(res.status).toBe(401);
    }
  });

  it("rejects forged leave requests submitted directly around the sign-in page", async () => {
    vi.stubEnv("SESSION_SECRET", "test-secret");
    const res = await requestAway(new NextRequest("https://internal.example/api/away", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@innovinlabs.com", type: "wfh", startDate: "2026-11-09", endDate: "2026-11-09" }),
    }));
    expect(res.status).toBe(401);
  });
});
