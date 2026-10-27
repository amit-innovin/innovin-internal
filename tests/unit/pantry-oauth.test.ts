import { afterEach, expect, it, vi } from "vitest";
import { callbackUri, pendingOAuth, verifyPending } from "@/lib/pantry/oauth";
afterEach(()=>vi.unstubAllEnvs());
it("binds encrypted PKCE state to the initiating admin and expires it",()=>{
  vi.stubEnv("PANTRY_INTEGRATION_KEY","c".repeat(64));
  const {pending,cookie,challenge}=pendingOAuth("owner@example.com","client","http://localhost:3000/api/pantry-provider/callback",null);
  expect(challenge).toHaveLength(43);expect(cookie).not.toContain(pending.verifier);
  expect(verifyPending(cookie,pending.state,pending.actor)).toEqual(pending);
  expect(()=>verifyPending(cookie,"forged",pending.actor)).toThrow();
  expect(()=>verifyPending(cookie,pending.state,"other@example.com")).toThrow();
  vi.spyOn(Date,"now").mockReturnValue(pending.expiresAt+1);
  expect(()=>verifyPending(cookie,pending.state,pending.actor)).toThrow();vi.restoreAllMocks();
});
it("requires an exact same-origin production callback without open redirects",()=>{
  vi.stubEnv("PANTRY_SWIGGY_REDIRECT_URI","");
  expect(callbackUri("http://localhost:3000")).toBe("http://localhost:3000/api/pantry-provider/callback");
  expect(()=>callbackUri("https://office.example.com")).toThrow(/register/);
  vi.stubEnv("PANTRY_SWIGGY_REDIRECT_URI","https://attacker.example.com/api/pantry-provider/callback");
  expect(()=>callbackUri("https://office.example.com")).toThrow();
  vi.stubEnv("PANTRY_SWIGGY_REDIRECT_URI","https://office.example.com/api/pantry-provider/callback");
  expect(callbackUri("https://office.example.com")).toBe("https://office.example.com/api/pantry-provider/callback");
});
