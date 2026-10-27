import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
export type Tokens = { accessToken: string; refreshToken: string; expiresAt: number; accountId?: string };
export type ToolReply = { success: boolean; data?: unknown; message?: string; error?: { message?: string } };
export type SwiggyTool = "get_addresses" | "search_products" | "update_cart" | "get_cart" | "checkout" | "get_orders" | "get_delivery_status" | "get_payment_options";
export class PantryError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
export const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function swiggyBase() {
  const override = process.env.PANTRY_SWIGGY_TEST_URL;
  if (!override) return new URL("https://mcp.swiggy.com");
  const url = new URL(override);
  if (process.env.VERCEL || url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new PantryError("Invalid local provider fixture URL", 503);
  return url;
}
async function oauthPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(new URL(path, swiggyBase()), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new PantryError(res.status === 400 || res.status === 401 ? "Instamart authorization needs to be renewed" : "Instamart authorization is unavailable", res.status === 400 || res.status === 401 ? 401 : 502);
  const raw = await res.text();
  if (raw.length > 100000) throw new PantryError("Invalid authorization response");
  return object(JSON.parse(raw));
}
export async function registerClient(redirectUri: string) {
  const body = await oauthPost("/auth/register", { client_name: "Innovin Internal Pantry", redirect_uris: [redirectUri], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] });
  if (typeof body.client_id !== "string" || !body.client_id || body.client_id.length > 512 || (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== "none")) throw new PantryError("Instamart client registration was not accepted");
  return body.client_id;
}
export async function exchangeToken(input: Record<string, string>): Promise<Tokens> {
  const body = await oauthPost("/auth/token", input);
  if (typeof body.access_token !== "string" || !body.access_token || typeof body.refresh_token !== "string" || !body.refresh_token || body.access_token.length > 20000 || body.refresh_token.length > 20000 || typeof body.expires_in !== "number" || !Number.isFinite(body.expires_in) || body.expires_in <= 60 || body.expires_in > 32 * 86400) throw new PantryError("Invalid Instamart authorization response");
  let accountId: string | undefined;
  try {
    // The token comes directly from Swiggy's TLS-protected exchange, never from browser input.
    const claim = object(JSON.parse(Buffer.from(body.access_token.split(".")[1], "base64url").toString("utf8"))).user_id;
    if (typeof claim === "string" && claim.length <= 180) accountId = claim;
    else if (typeof claim === "number" && Number.isSafeInteger(claim)) accountId = String(claim);
  } catch { /* Opaque tokens may connect, but cannot prove same-account recovery. */ }
  return { accountId, accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: Date.now() + body.expires_in * 1000 };
}
export function decodeToolResult(value: unknown): ToolReply {
  const result = object(value);
  if (result.isError) throw new PantryError("Instamart could not complete that operation");
  let envelope = object(result.structuredContent);
  if (typeof envelope.success !== "boolean") {
    for (const part of Array.isArray(result.content) ? result.content : []) {
      const block = object(part);
      if (block.type !== "text" || typeof block.text !== "string") continue;
      try { const candidate = object(JSON.parse(block.text)); if (typeof candidate.success === "boolean") { envelope = candidate; break; } } catch { /* A content block may be explanatory text, not a result. */ }
    }
  }
  if (typeof envelope.success !== "boolean") throw new PantryError("Instamart returned an unsupported result. Nothing has been confirmed.");
  return { success: envelope.success, data: envelope.data, message: typeof envelope.message === "string" ? envelope.message.slice(0, 2000) : undefined, error: typeof object(envelope.error).message === "string" ? { message: String(object(envelope.error).message).slice(0, 500) } : undefined };
}
export async function callSwiggy(token: string, name: SwiggyTool, args: Record<string, unknown>): Promise<ToolReply> {
  const base = swiggyBase();
  const transport = new StreamableHTTPClientTransport(new URL("/im", base), {
    requestInit: { headers: { Authorization: `Bearer ${token}` }, redirect: "error" },
    // A timeout/stream disconnection must never replay a non-idempotent checkout.
    reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 1000, maxReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1 },
    fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.origin !== base.origin || url.pathname !== "/im") throw new PantryError("Unexpected purchasing endpoint");
      return fetch(input, { ...init, redirect: "error", cache: "no-store", signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), AbortSignal.timeout(20000)]) });
    },
  });
  const client = new Client({ name: "innovin-internal-pantry", version: "0.1.0" });
  try {
    await client.connect(transport, { timeout: 12000 });
    return decodeToolResult(await client.callTool({ name, arguments: args }, undefined, { timeout: 20000, maxTotalTimeout: 20000 }));
  } catch (error) {
    if (error instanceof PantryError) throw error;
    const code = object(error).code;
    throw new PantryError(code === 401 || code === -32001 ? "Reconnect the Instamart purchasing account" : "Instamart could not be reached. Check the saved operation status before retrying.", code === 401 || code === -32001 ? 401 : 502);
  } finally { await client.close().catch(() => {}); }
}
export function requireSuccess(reply: ToolReply) {
  if (!reply.success) throw new PantryError(reply.error?.message || "Instamart could not complete that operation");
  return object(reply.data);
}
