import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { jsonStore } from "@/lib/jsonstore";
import type { ToolReply } from "@/lib/pantry/swiggy";
import { PantryPurchasing } from "@/lib/pantry/service";
const directory = path.join(os.tmpdir(), `innovin-pantry-service-${process.pid}`);
const address = { id: "office", addressLine: "Innovin office, Kerala", addressCategory: "Office" };
const variant = { spinId: "spin-1", skuId: "sku-1", displayName: "Biscuits", quantityDescription: "200 g", price: { offerPrice: 40 }, isInStockAndAvailable: true, maxQuantity: 50 };
function fixture() {
  let quantity = 2;
  const call = vi.fn(async (_token: string, name: string, args: Record<string, unknown>): Promise<ToolReply> => {
    if (name === "get_addresses") return { success: true, data: { addresses: [address], pagination: { hasMore: false } } };
    if (name === "search_products") return { success: true, data: { products: [{ variations: [variant] }], nextOffset: "" } };
    if (name === "update_cart") quantity = (args.items as {quantity:number}[])[0].quantity;
    if (name === "get_cart" || name === "update_cart") return { success: true, data: { cartId: "cart-1", selectedAddressDetails: { id: address.id, address: address.addressLine }, cartTotalAmount: "80", items: [{ ...variant, itemName: "Biscuits", itemVariant: "200 g", discountedFinalPrice: 40, quantity }], billBreakdown: { lineItems: [{ label: "Items", value: "₹80" }], toPay: { label: "To pay", value: "₹80" } }, availablePaymentMethods: ["COD"] } };
    if (name === "get_payment_options") return { success: true, data: { allMethods: [{ id: "COD", enabled: true }] } };
    if (name === "checkout") return { success: true, message: "Instamart order placed successfully", data: { orderId: "order-1", status: "CONFIRMED", paymentMethod: "COD" } };
    return { success: true, data: { orders: [] } };
  });
  return call;
}
beforeEach(async () => { vi.stubEnv("PANTRY_INTEGRATION_KEY", "a".repeat(64)); vi.stubEnv("PANTRY_ORDERING_ENABLED", "true"); vi.stubEnv("DATA_FILE", path.join(directory, "state.json")); await fs.rm(directory, { recursive: true, force: true }); });
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await fs.rm(directory, { recursive: true, force: true }); });
async function connected() {
  const call = fixture(); const service = new PantryPurchasing({ store: jsonStore, call });
  await service.connect("admin@innovinlabs.com", { accessToken: "private-token", refreshToken: "private-refresh", expiresAt: Date.now()+3600000 }, "client", null);
  let state = await service.status();
  state = await service.selectAddress("admin@innovinlabs.com", "office", state.version);
  state = await service.search("admin@innovinlabs.com", "biscuits", 0);
  state = await service.setDraft("admin@innovinlabs.com", [{ spinId: "spin-1", skuId: "sku-1", quantity: 2 }], state.version);
  return { service, call, state };
}
it("keeps tokens server-side and requires explicit provider-cart replacement consent", async () => {
  const { service, call, state } = await connected();
  expect(JSON.stringify(state)).not.toContain("private-token");
  await expect(service.review("admin@innovinlabs.com", false, state.version)).rejects.toThrow(/replace/i);
  expect(call.mock.calls.filter(row => row[1] === "update_cart")).toHaveLength(0);
});
it("persists a reviewed checkout once and refuses a replay", async () => {
  const { service, call, state } = await connected();
  const reviewed = await service.review("admin@innovinlabs.com", true, state.version);
  await expect(service.checkout("another@innovinlabs.com", reviewed.quote!.id, "COD", true)).rejects.toThrow(/review/i);
  const placed = await service.checkout("admin@innovinlabs.com", reviewed.quote!.id, "COD", true);
  expect(placed.attempts[0]).toMatchObject({ status: "placed", orders: [{ orderId: "order-1", status: "CONFIRMED" }] });
  await expect(service.checkout("admin@innovinlabs.com", reviewed.quote!.id, "COD", true)).rejects.toThrow();
  expect(call.mock.calls.filter(row => row[1] === "checkout")).toHaveLength(1);
});
it("durably blocks automatic retry after an uncertain provider checkout", async () => {
  const { service, call, state } = await connected();
  const reviewed = await service.review("admin@innovinlabs.com", true, state.version);
  const working = call.getMockImplementation()!;
  call.mockImplementation(async (...args) => { if (args[1] === "checkout") throw new Error("network lost"); return working(...args); });
  const unknown = await service.checkout("admin@innovinlabs.com", reviewed.quote!.id, "COD", true);
  expect(unknown.attempts[0].status).toBe("unknown");
  const restarted = new PantryPurchasing({ store: jsonStore, call });
  expect((await restarted.status()).unresolved).toBe(true);
  await expect(restarted.checkout("admin@innovinlabs.com", reviewed.quote!.id, "COD", true)).rejects.toThrow();
  expect(call.mock.calls.filter(row => row[1] === "checkout")).toHaveLength(1);
});
it("rejects a changed provider bill without ever submitting checkout", async () => {
  const {service,call,state}=await connected();
  const reviewed=await service.review("admin@innovinlabs.com",true,state.version);
  const original=call.getMockImplementation()!;
  call.mockImplementation(async (...args)=>{const reply=await original(...args);if(args[1]==="get_cart") (reply.data as any).billBreakdown.toPay.value="₹81";return reply;});
  await expect(service.checkout("admin@innovinlabs.com",reviewed.quote!.id,"COD",true)).rejects.toThrow(/changed/);
  expect(call.mock.calls.filter(c=>c[1]==="checkout")).toHaveLength(0);
  expect((await service.status()).quote).toBeUndefined();
});
it("allows only variants from provider search and rejects stale coordinator edits", async () => {
  const {service,state}=await connected();
  await expect(service.setDraft("admin@innovinlabs.com",[{spinId:"fake",skuId:"fake",quantity:1}],state.version)).rejects.toThrow(/variant/);
  await expect(service.setDraft("admin@innovinlabs.com",[],state.version)).rejects.toThrow(/changed/);
});
it("serializes concurrent checkout so the provider receives at most one submission", async () => {
  const {service,call,state}=await connected();
  const reviewed=await service.review("admin@innovinlabs.com",true,state.version);
  const results=await Promise.allSettled([service.checkout("admin@innovinlabs.com",reviewed.quote!.id,"COD",true),service.checkout("admin@innovinlabs.com",reviewed.quote!.id,"COD",true)]);
  expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
  expect(call.mock.calls.filter(c=>c[1]==="checkout")).toHaveLength(1);
});
it("does not infer cash availability from a stale cart field when live methods disable it", async () => {
  const {service,call,state}=await connected();const original=call.getMockImplementation()!;
  call.mockImplementation(async (...args)=>args[1]==="get_payment_options"?{success:true,data:{allMethods:[{id:"COD",enabled:false}]}}:original(...args));
  const reviewed=await service.review("admin@innovinlabs.com",true,state.version);
  expect(reviewed.quote!.paymentMethods).toEqual([]);
  await expect(service.checkout("admin@innovinlabs.com",reviewed.quote!.id,"COD",true)).rejects.toThrow(/available/);
  expect(call.mock.calls.filter(c=>c[1]==="checkout")).toHaveLength(0);
});
it("keeps a partial multi-store result blocked until every store is reviewed", async () => {
  const {service,call,state}=await connected();const original=call.getMockImplementation()!;
  call.mockImplementation(async (...args)=>args[1]==="checkout"?{success:true,data:{orders:[{orderId:"one",status:"CONFIRMED"},{error:"Unavailable"}],allSucceeded:false}}:original(...args));
  const reviewed=await service.review("admin@innovinlabs.com",true,state.version);
  const partial=await service.checkout("admin@innovinlabs.com",reviewed.quote!.id,"COD",true);
  expect(partial.unresolved).toBe(true);expect(partial.attempts[0].status).toBe("partial");
  await expect(service.setDraft("admin@innovinlabs.com",[],partial.version)).rejects.toThrow(/unresolved/);
  const acknowledged=await service.acknowledgePartial("admin@innovinlabs.com",partial.attempts[0].id,true);
  expect(acknowledged.unresolved).toBe(false);expect(acknowledged.draft).toEqual([]);
});
it("reconciles an unknown checkout only from positively matching live history", async () => {
  const {service,call,state}=await connected();const original=call.getMockImplementation()!;
  call.mockImplementation(async (...args)=>{if(args[1]==="checkout") throw new Error("lost response");return original(...args);});
  const reviewed=await service.review("admin@innovinlabs.com",true,state.version);
  const unknown=await service.checkout("admin@innovinlabs.com",reviewed.quote!.id,"COD",true);
  await expect(service.reconcile("admin@innovinlabs.com",unknown.attempts[0].id,["missing"],true)).rejects.toThrow(/match/);
  call.mockImplementation(async (...args)=>args[1]==="get_orders"?{success:true,data:{orders:[{orderId:"found",status:"CONFIRMED",createdAt:unknown.attempts[0].startedAt,totalAmount:80,deliveryAddress:address,items:[{name:"Biscuits",quantity:2}]}]}}:original(...args));
  const reconciled=await service.reconcile("admin@innovinlabs.com",unknown.attempts[0].id,["found"],true);
  expect(reconciled.attempts[0].status).toBe("placed");expect(reconciled.unresolved).toBe(false);
});
it("honors the provider delivery refresh interval on the server", async () => {
  const {service,call,state}=await connected();const original=call.getMockImplementation()!;
  call.mockImplementation(async (...args)=>args[1]==="get_delivery_status"?{success:true,data:{orderId:"order-1",statusText:"On the way",pollIntervalSec:45}}:original(...args));
  const reviewed=await service.review("admin@innovinlabs.com",true,state.version);
  const placed=await service.checkout("admin@innovinlabs.com",reviewed.quote!.id,"COD",true);
  await service.delivery("admin@innovinlabs.com",placed.attempts[0].id,"order-1");
  await service.delivery("admin@innovinlabs.com",placed.attempts[0].id,"order-1");
  expect(call.mock.calls.filter(c=>c[1]==="get_delivery_status")).toHaveLength(1);
});
it("rejects a same-ID delivery address edited after review", async () => {
  const {service,call,state}=await connected();
  const reviewed=await service.review("admin@innovinlabs.com",true,state.version);const original=call.getMockImplementation()!;
  call.mockImplementation(async (...args)=>{const result=await original(...args);if(args[1]==="get_cart") (result.data as any).selectedAddressDetails.address="Changed destination";return result;});
  await expect(service.checkout("admin@innovinlabs.com",reviewed.quote!.id,"COD",true)).rejects.toThrow(/changed/);
  expect(call.mock.calls.filter(c=>c[1]==="checkout")).toHaveLength(0);
});
it("never reuses an existing receipt to clear a later unknown submission", async () => {
  const {service,call,state}=await connected();
  const reviewed=await service.review("admin@innovinlabs.com",true,state.version);
  const placed=await service.checkout("admin@innovinlabs.com",reviewed.quote!.id,"COD",true);
  const draft=await service.setDraft("admin@innovinlabs.com",[{spinId:"spin-1",skuId:"sku-1",quantity:2}],placed.version);
  const next=await service.review("admin@innovinlabs.com",true,draft.version);const original=call.getMockImplementation()!;
  call.mockImplementation(async (...args)=>{if(args[1]==="checkout") throw new Error("lost");return original(...args);});
  const unknown=await service.checkout("admin@innovinlabs.com",next.quote!.id,"COD",true);
  await expect(service.reconcile("admin@innovinlabs.com",unknown.attempts[0].id,["order-1"],true)).rejects.toThrow(/already belongs/);
  expect((await service.status()).unresolved).toBe(true);
});
it("persists rotating refresh credentials before using the new access token", async () => {
  const call=fixture();const refresh=vi.fn(async()=>({accessToken:"rotated-access",refreshToken:"rotated-refresh",expiresAt:Date.now()+3600000,accountId:"account"}));
  const service=new PantryPurchasing({store:jsonStore,call,refresh});
  await service.connect("admin@innovinlabs.com",{accessToken:"old-access",refreshToken:"old-refresh",expiresAt:Date.now()-1,accountId:"account"},"client",null);
  call.mockClear();await service.addresses("admin@innovinlabs.com",1);
  expect(refresh).toHaveBeenCalledTimes(1);expect(call.mock.calls[0][0]).toBe("rotated-access");
  const row=await jsonStore.getProviderRecord("pantry:instamart:v1");
  const {unseal}=await import("@/lib/pantry/crypto");
  expect(unseal<any>(row!.value,"record").connection.refreshToken).toBe("rotated-refresh");
});
it("recovers a crashed submitting checkout conservatively and rejects expired reviews", async () => {
  const {service,call,state}=await connected();
  const reviewed=await service.review("admin@innovinlabs.com",true,state.version);
  const current=Date.now();vi.spyOn(Date,"now").mockReturnValue(current+121000);
  await expect(service.checkout("admin@innovinlabs.com",reviewed.quote!.id,"COD",true)).rejects.toThrow(/review/i);
  vi.restoreAllMocks();expect(call.mock.calls.filter(c=>c[1]==="checkout")).toHaveLength(0);
  const {seal,unseal}=await import("@/lib/pantry/crypto");
  const row=await jsonStore.getProviderRecord("pantry:instamart:v1");const saved=unseal<any>(row!.value,"record");
  saved.operation={id:"crashed",kind:"checkout",until:Date.now()-1};
  saved.attempts=[{id:"interrupted",status:"submitting",orders:[],generation:saved.connection.generation}];
  await jsonStore.putProviderRecord(row!.key,row!.version,seal(saved,"record"),new Date().toISOString());
  const restarted=new PantryPurchasing({store:jsonStore,call});
  expect((await restarted.status()).attempts[0].status).toBe("unknown");
  await expect(restarted.setDraft("admin@innovinlabs.com",[],(await restarted.status()).version)).rejects.toThrow(/unresolved/);
});
