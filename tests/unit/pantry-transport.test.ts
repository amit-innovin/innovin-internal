import { afterEach, expect, it, vi } from "vitest";
import { decodeToolResult, swiggyBase, exchangeToken, registerClient } from "@/lib/pantry/swiggy";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("accepts documented MCP envelopes but never mistakes text or tool errors for success", () => {
  const envelope = { success: true, data: { addresses: [] } };
  expect(decodeToolResult({ structuredContent: envelope })).toEqual(envelope);
  expect(decodeToolResult({ content: [{ type: "text", text: JSON.stringify(envelope) }] })).toEqual(envelope);
  expect(() => decodeToolResult({ content: [{ type: "text", text: "Something failed" }] })).toThrow();
  expect(() => decodeToolResult({ isError: true, structuredContent: envelope })).toThrow();
});
it("never sends purchasing credentials to an arbitrary configured URL", () => {
  expect(swiggyBase().origin).toBe("https://mcp.swiggy.com");
  vi.stubEnv("PANTRY_SWIGGY_TEST_URL", "https://attacker.example");
  expect(() => swiggyBase()).toThrow();
  vi.stubEnv("PANTRY_SWIGGY_TEST_URL", "http://localhost:3998");
  vi.stubEnv("VERCEL", "1");
  expect(() => swiggyBase()).toThrow();
});
it("uses JSON OAuth exchanges and retains the provider's rotating refresh token", async () => {
  const mocked = vi.fn(async (url: string | URL, init?: RequestInit) => {
    expect(url.toString()).toBe("https://mcp.swiggy.com/auth/token");
    expect(init?.redirect).toBe("error");
    expect(JSON.parse(init?.body as string)).toMatchObject({ grant_type: "refresh_token", refresh_token: "old-refresh" });
    return Response.json({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 });
  });
  vi.stubGlobal("fetch", mocked);
  expect(await exchangeToken({ grant_type: "refresh_token", refresh_token: "old-refresh" })).toMatchObject({ accessToken: "new-access", refreshToken: "new-refresh" });
  expect(mocked).toHaveBeenCalledTimes(1);
});
it("registers only the exact application callback and a public PKCE client", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    expect(JSON.parse(init.body)).toMatchObject({ redirect_uris: ["http://localhost:3000/api/pantry-provider/callback"], token_endpoint_auth_method: "none" });
    return Response.json({ client_id: "registered-client", token_endpoint_auth_method: "none" });
  }));
  expect(await registerClient("http://localhost:3000/api/pantry-provider/callback")).toBe("registered-client");
});
