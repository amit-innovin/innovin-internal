import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isPublicPath, proxy } from "@/proxy";
import nextConfig from "@/next.config";

const visit = (path: string, cookie = "") => proxy(new NextRequest(`https://internal.example${path}`, { headers: cookie ? { cookie } : {} }));

describe("proxy", () => {
  it("sends a signed-out visitor to sign-in, remembering the page", () => {
    const res = visit("/admin");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://internal.example/sign-in?next=%2Fadmin");
  });

  it("keeps the query string in the remembered page", () => {
    expect(visit("/attendance?tab=leave").headers.get("location")).toBe("https://internal.example/sign-in?next=%2Fattendance%3Ftab%3Dleave");
  });

  it.each(["/grievances", "/sign-in", "/api/attendance", "/sw.js", "/manifest.webmanifest", "/icon.svg", "/brand/logo.svg", "/_next/static/x.js"])(
    "lets %s through without a session",
    (path) => {
      expect(isPublicPath(path)).toBe(true);
      expect(visit(path).headers.get("location")).toBeNull();
    },
  );

  it.each(["/", "/admin", "/steps", "/settings", "/grievances-admin", "/sign-inx"])("%s needs a session", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });

  it("passes a session through, telling pages where they are", () => {
    const res = visit("/admin?tab=people", "innovin_user=x.y");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-request-x-pathname")).toBe("/admin?tab=people");
  });
});

// Removed pages send old links Home. next.config redirects run before the proxy, so a
// signed-out visitor is redirected to "/" first and the proxy then sends "/" to sign-in.
describe("old links to removed pages", () => {
  const REMOVED = ["/pantry", "/snacks", "/planner", "/people", "/admin/pantry"];

  it.each(REMOVED)("%s redirects Home, temporarily", async (path) => {
    const rules = (await nextConfig.redirects!()).filter((r) => r.source === path);
    expect(rules).toEqual([{ source: path, destination: "/", permanent: false }]);
  });

  it("a signed-out visitor carried Home by an old link is asked to sign in", () => {
    // Redirects pass the query through, so /snacks?tab=today arrives here as /?tab=today.
    expect(visit("/?tab=today").headers.get("location")).toBe("https://internal.example/sign-in?next=%2F%3Ftab%3Dtoday");
    expect(visit("/?ping=a%40innovinlabs.com").headers.get("location")).toBe("https://internal.example/sign-in?next=%2F%3Fping%3Da%2540innovinlabs.com");
  });
});
