import { SHOP_CATEGORIES,productKey,catalogFresh,productImage,type ShopCategory,type RequestedProduct } from "./shop";
import { createHash, randomUUID } from "node:crypto";
import { store as defaultStore } from "../store";
import type { Store } from "../types";
import { encryptionReady, seal, unseal } from "./crypto";
import { callSwiggy, exchangeToken, object, PantryError, requireSuccess, type SwiggyTool, type Tokens, type ToolReply } from "./swiggy";
import { identifier, parseAddresses, parseCatalog, parseQuote, text } from "./schema";
import type { Attempt, ProviderState, PublicState } from "./types";
const KEY = "pantry:instamart:v1";
const empty = (): ProviderState => ({ addresses: [], addressPage: 1, moreAddresses: false, catalog: [], catalogUntil: 0, draft: [], attempts: [] });
const unresolved = (s: ProviderState) => s.attempts.some(a => ["submitting", "unknown", "partial"].includes(a.status));
type Invoke = (tool: SwiggyTool, args: Record<string, unknown>) => Promise<ToolReply>;
type Options = { store?: Pick<Store, "getProviderRecord" | "putProviderRecord">; call?: typeof callSwiggy; refresh?: typeof exchangeToken };

export class PantryPurchasing {
  private storage: Pick<Store, "getProviderRecord" | "putProviderRecord">;
  private call: typeof callSwiggy;
  private refresh: typeof exchangeToken;
  constructor(options: Options = {}) { this.storage = options.store ?? defaultStore; this.call = options.call ?? callSwiggy; this.refresh = options.refresh ?? exchangeToken; }
  private async read() {
    const row = await this.storage.getProviderRecord(KEY);
    if (!row) return { state: empty(), version: null };
    try { return { state: unseal<ProviderState>(row.value, "record"), version: row.version }; }
    catch { throw new PantryError("Purchasing state cannot be decrypted. Restore the configured integration key before reconnecting.", 503); }
  }
  private public(state: ProviderState, version: number | null): PublicState {
    const { connection, operation, catalogUntil: _ttl, quote, ...visible } = state;
    const publicQuote = quote ? (({ fingerprint: _hash, ...rest }) => rest)(quote) : undefined;
    return { ...visible, attempts: visible.attempts.map(a => a.status === "submitting" && (!operation || operation.until < Date.now()) ? { ...a, status: "unknown" } : a), quote: publicQuote, version, configured: encryptionReady(), connected: !!connection, generation: connection?.generation, linkedBy: connection?.linkedBy, orderingEnabled: process.env.PANTRY_ORDERING_ENABLED === "true", busy: !!operation && operation.until > Date.now(), unresolved: unresolved(state), blinkit: "partner-access-required" };
  }
  async status() {
    if (!encryptionReady()) return this.public(empty(), null);
    const { state, version } = await this.read();
    return this.public(state, version);
  }
  private sourceKey(state:ProviderState) {
    return createHash("sha256").update(JSON.stringify([state.connection?.generation,state.selectedAddress?.id])).digest("hex");
  }
  async shop() {
    if(!encryptionReady())return {products:[],revision:"unavailable",ready:false};
    const {state}=await this.read();const key=this.sourceKey(state);
    const products=(state.connection&&state.selectedAddress?state.sharedCatalog??[]:[]).filter(p=>p.sourceKey===key).map(p=>({spinId:p.spinId,skuId:p.skuId,name:p.name,variant:p.variant,price:p.price,mrp:p.mrp,brand:p.brand,imageUrl:productImage(p.imageUrl),available:p.available&&catalogFresh(p),maxQuantity:p.maxQuantity,category:p.category,publishedAt:p.publishedAt,sourceKey:p.sourceKey}));
    return {products,revision:createHash("sha256").update(JSON.stringify([key,products])).digest("hex"),ready:!!state.connection&&!!state.selectedAddress};
  }
  async publish(actor:string,spinId:string,skuId:string,category:string,expected:number|null) {
    if(!SHOP_CATEGORIES.includes(category as ShopCategory))throw new PantryError("Choose an office category",400);
    return this.work(actor,"publish",async state=>{
      const product=state.catalogUntil>Date.now()?state.catalog.find(p=>p.spinId===spinId&&p.skuId===skuId):null;
      if(!state.selectedAddress||!product)throw new PantryError("Search this exact product again before sharing it",409);
      const other=(state.sharedCatalog??[]).filter(p=>productKey(p)!==productKey(product));
      if(other.length>=100)throw new PantryError("Keep the office shop to 100 variants",400);
      state.sharedCatalog=[...other,{...product,imageUrl:productImage(product.imageUrl),category:category as ShopCategory,publishedAt:new Date().toISOString(),sourceKey:this.sourceKey(state)}];
    },{expected});
  }
  async unpublish(actor:string,spinId:string,skuId:string,expected:number|null) {
    return this.work(actor,"publish",async state=>{state.sharedCatalog=(state.sharedCatalog??[]).filter(p=>p.spinId!==spinId||p.skuId!==skuId);},{expected});
  }
  async selection(input:unknown,revision:string):Promise<RequestedProduct[]> {
    const shop=await this.shop();if(revision!==shop.revision)throw new PantryError("The office catalog changed. Refresh before submitting.",409);
    if(!Array.isArray(input)||!input.length||input.length>4)throw new PantryError("Choose up to four exact products",400);
    const seen=new Set<string>();return input.map(raw=>{
      const row=object(raw),product=shop.products.find(p=>p.spinId===row.spinId&&p.skuId===row.skuId);
      if(!product||!product.available||!Number.isInteger(row.quantity)||Number(row.quantity)<1||Number(row.quantity)>product.maxQuantity)throw new PantryError("Choose an available product and valid quantity",400);
      if(seen.has(productKey(product)))throw new PantryError("Choose each variant only once",400);seen.add(productKey(product));
      return {...product,quantity:Number(row.quantity)};
    });
  }
  async teamDraft(actor:string,requests:RequestedProduct[],expected:number|null) {
    return this.work(actor,"draft",async state=>{
      if(!requests.length)throw new PantryError("Mark product requests Being prepared first",400);
      const combined=new Map<string,typeof requests[number]>();
      for(const row of requests){
        const product=(state.sharedCatalog??[]).find(p=>productKey(p)===productKey(row));
        if(!product||!product.available||!catalogFresh(product)||row.sourceKey!==this.sourceKey(state))throw new PantryError("The office catalog changed or expired. Refresh its products before building the basket.",409);
        const key=productKey(product),quantity=(combined.get(key)?.quantity??0)+row.quantity;
        if(!Number.isInteger(quantity)||quantity<1||quantity>product.maxQuantity)throw new PantryError(`Team quantity exceeds the available limit for ${product.name}. Review requests.`,409);
        combined.set(key,{...product,quantity});
      }
      if(combined.size>50)throw new PantryError("Choose up to 50 variants for one supplier basket",400);
      state.draft=[...combined.values()];
    },{expected});
  }
  private async work(actor: string, kind: string, action: (state: ProviderState, invoke: Invoke, checkpoint: () => Promise<void>) => Promise<void>, options: { expected?: number | null; allowUnresolved?: boolean; connect?: boolean } = {}) {
    if (!encryptionReady()) throw new PantryError("Configure the pantry integration encryption key first", 503);
    const loaded = await this.read();
    let version = loaded.version;
    const state = loaded.state;
    if (state.operation && state.operation.until > Date.now()) throw new PantryError("Another coordinator operation is in progress. Refresh shortly.", 409);
    // A crashed checkout is not an expired lock that may be retried.
    if (state.operation?.kind === "checkout") {
      for (const a of state.attempts) if (a.status === "submitting") { a.status = "unknown"; a.message = "Checkout was interrupted. Review provider orders before proceeding."; }
    }
    if (options.expected !== undefined && version !== options.expected) throw new PantryError("The purchasing basket changed. Reload before editing.", 409);
    if (!options.allowUnresolved && unresolved(state)) throw new PantryError("An earlier order is unresolved. Review its provider result before another purchase.", 409);
    if (!options.connect && !state.connection) throw new PantryError("Connect the office Instamart purchasing account first", 409);
    state.operation = { id: randomUUID(), kind, until: Date.now()+90000 };
    if (["address", "draft", "review", "connect", "disconnect"].includes(kind)) state.quote = undefined;
    const save = async () => {
      if (!await this.storage.putProviderRecord(KEY, version, seal(state, "record"), new Date().toISOString())) throw new PantryError("Another coordinator changed this operation. Reload its saved status.", 409);
      version = (version ?? 0)+1;
    };
    await save();
    const checkpoint = async () => { if (state.operation) state.operation.until = Date.now()+90000; await save(); };
    const refresh = async () => {
      if (!state.connection) throw new PantryError("Reconnect Instamart", 401);
      const tokens = await this.refresh({ grant_type: "refresh_token", refresh_token: state.connection.refreshToken, client_id: state.connection.clientId });
      if (state.connection.accountId && tokens.accountId && tokens.accountId !== state.connection.accountId) throw new PantryError("Instamart refreshed a different account. Reconnect with the original purchaser.", 401);
      Object.assign(state.connection, tokens, { accountId: tokens.accountId ?? state.connection.accountId });
      // Refresh tokens rotate: persist them before any subsequent provider operation.
      await checkpoint();
    };
    const invoke: Invoke = async (tool, args) => {
      if (!state.connection) throw new PantryError("Reconnect Instamart", 401);
      if (state.connection.expiresAt <= Date.now()+60000) await refresh();
      let result: ToolReply;
      try { result = await this.call(state.connection!.accessToken, tool, args); }
      catch(error) {
        if (!(error instanceof PantryError) || error.status !== 401 || tool === "checkout") throw error;
        await refresh();
        result = await this.call(state.connection!.accessToken, tool, args);
      }
      await checkpoint();
      return result;
    };
    try {
      await action(state, invoke, checkpoint);
      state.operation = undefined;
      await save();
      return this.public(state, version);
    } catch(error) {
      state.operation = undefined;
      // Persist conservative state even after a provider failure; never silently clear attempts.
      await save();
      if (error instanceof PantryError) throw error;
      throw new PantryError("Instamart is unavailable. Review the saved basket or order status before retrying.");
    }
  }
  async connect(actor: string, tokens: Tokens, clientId: string, expected: number | null) {
    const addresses = parseAddresses(requireSuccess(await this.call(tokens.accessToken, "get_addresses", { page: 1, pageSize: 10 })));
    return this.work(actor, "connect", async state => {
      const sameAccount = !!tokens.accountId && tokens.accountId === state.connection?.accountId;
      if (unresolved(state) && !sameAccount) throw new PantryError("Reconnect the same Swiggy purchasing account while an order is unresolved.", 409);
      state.connection = { ...tokens, clientId, generation: sameAccount ? state.connection!.generation : randomUUID(), linkedBy: actor, linkedAt: new Date().toISOString() };
      state.addresses = addresses.addresses; state.addressPage = 1; state.moreAddresses = addresses.more;
      if (!sameAccount) { state.selectedAddress = undefined; state.sharedCatalog=[]; state.catalog = []; state.catalogUntil = 0; state.draft = []; }
    }, { expected, connect: true, allowUnresolved: true });
  }
  async disconnect(actor: string, expected: number | null) {
    return this.work(actor, "disconnect", async state => {
      state.connection = undefined; state.sharedCatalog=[]; state.selectedAddress = undefined; state.addresses = []; state.catalog = []; state.draft = [];
    }, { expected });
  }
  async addresses(actor: string, page: number) {
    if (!Number.isInteger(page) || page < 1 || page > 50) throw new PantryError("Choose a valid address page", 400);
    return this.work(actor, "addresses", async (state, invoke) => {
      const result = parseAddresses(requireSuccess(await invoke("get_addresses", { page, pageSize: 10 })));
      state.addresses = result.addresses; state.addressPage = page; state.moreAddresses = result.more;
    });
  }
  async selectAddress(actor: string, id: string, expected: number | null) {
    return this.work(actor, "address", async state => {
      const address = state.addresses.find(a => a.id === id);
      if (!address) throw new PantryError("Choose an address returned by Instamart", 400);
      state.selectedAddress = address; state.sharedCatalog=[]; state.catalog = []; state.catalogUntil = 0; state.draft = [];
    }, { expected });
  }
  async search(actor: string, query: string, offset: number) {
    if (!query.trim() || query.length > 120 || !Number.isInteger(offset) || offset < 0 || offset > 10000) throw new PantryError("Enter a valid product search", 400);
    return this.work(actor, "search", async (state, invoke) => {
      if (!state.selectedAddress) throw new PantryError("Choose the office delivery address first", 400);
      const result = parseCatalog(requireSuccess(await invoke("search_products", { addressId: state.selectedAddress.id, query: query.trim(), offset })));
      state.catalog = result.products; state.nextOffset = result.nextOffset; state.searchQuery = query.trim(); state.catalogUntil = Date.now()+600000;
    });
  }
  async setDraft(actor: string, input: unknown, expected: number | null) {
    if (!Array.isArray(input) || input.length > 50) throw new PantryError("Choose up to 50 product variants", 400);
    return this.work(actor, "draft", async state => {
      if (!state.selectedAddress) throw new PantryError("Choose the office address first", 400);
      const used = new Set<string>();
      state.draft = input.map(raw => {
        const item = object(raw), key = `${item.spinId}:${item.skuId}`;
        if (used.has(key)) throw new PantryError("Each variant may appear once", 400);
        used.add(key);
        const fromSearch = state.catalogUntil > Date.now() ? state.catalog.find(p => p.spinId === item.spinId && p.skuId === item.skuId) : undefined;
        const product = fromSearch ?? state.draft.find(p => p.spinId === item.spinId && p.skuId === item.skuId);
        if (!product || !product.available || !Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > product.maxQuantity) throw new PantryError("Search and choose an available variant and valid quantity", 400);
        return { ...product, quantity: Number(item.quantity) };
      });
    }, { expected });
  }
  async review(actor: string, replaceConfirmed: boolean, expected: number | null) {
    if (!replaceConfirmed) throw new PantryError("Confirm that this office basket will replace the connected account's Instamart cart", 400);
    return this.work(actor, "review", async (state, invoke) => {
      if (!state.selectedAddress || !state.draft.length) throw new PantryError("Choose an address and add product variants first", 400);
      requireSuccess(await invoke("update_cart", { selectedAddressId: state.selectedAddress.id, items: state.draft.map(({ spinId, skuId, quantity }) => ({ spinId, skuId, quantity })) }));
      const cart = requireSuccess(await invoke("get_cart", {}));
      cart.paymentOptions = requireSuccess(await invoke("get_payment_options", {}));
      const quote = parseQuote(cart, state.selectedAddress, state.draft, actor);
      state.quote = quote;
      // The provider may reduce stock/quantity. Present its actual basket for explicit review.
      state.draft = quote.items;
    }, { expected });
  }
  async checkout(actor: string, quoteId: string, method: string, confirmed: boolean) {
    if (!confirmed || process.env.PANTRY_ORDERING_ENABLED !== "true") throw new PantryError(!confirmed ? "Confirm this exact order, payment and delivery address" : "Ordering is disabled for this environment", 400);
    return this.work(actor, "checkout", async (state, invoke, checkpoint) => {
      const quote = state.quote;
      if (!quote || quote.id !== quoteId || quote.actor !== actor || quote.expiresAt <= Date.now()) throw new PantryError("Review the current basket under your own account before ordering", 409);
      if (!quote.paymentMethods.includes(method) || !/^(cash|cod)$/i.test(method)) throw new PantryError("Select an available cash-on-delivery method", 400);
      const liveCart = requireSuccess(await invoke("get_cart", {}));
      liveCart.paymentOptions = requireSuccess(await invoke("get_payment_options", {}));
      const live = parseQuote(liveCart, quote.address, quote.items, actor);
      if (quote.expiresAt <= Date.now() || live.fingerprint !== quote.fingerprint) { state.quote = undefined; throw new PantryError("Instamart changed the items, bill, address or payment options. Review the basket again.", 409); }
      const attempt: Attempt = { id: randomUUID(), actor, startedAt: new Date().toISOString(), status: "submitting", generation: state.connection!.generation, address: quote.address, items: quote.items, total: quote.total, paymentMethod: method, orders: [], message: "Submitting to Instamart" };
      state.attempts.unshift(attempt); state.attempts = state.attempts.slice(0, 30); state.quote = undefined;
      // A retry or another instance can now see that checkout may have reached the provider.
      await checkpoint();
      try {
        const reply = await invoke("checkout", { addressId: quote.address.id, paymentMethod: method });
        const data = object(reply.data);
        if (Array.isArray(data.orders)) {
          attempt.orders = data.orders.slice(0, 20).map(raw => ({ orderId: typeof object(raw).orderId === "string" ? identifier(object(raw).orderId) : undefined, status: text(object(raw).status), error: text(object(raw).error) || undefined }));
          attempt.status = reply.success && data.allSucceeded === true && attempt.orders.length > 0 && attempt.orders.every(r => !!r.orderId && !r.error) ? "placed" : attempt.orders.some(r => !!r.orderId) ? "partial" : "unknown";
        } else if (reply.success && typeof data.orderId === "string" && text(data.status) && data.status !== "PENDING_PAYMENT" && !/(fail|cancel|reject)/i.test(String(data.status)) && (data.paymentMethod === undefined || data.paymentMethod === method)) {
          attempt.orders = [{ orderId: identifier(data.orderId), status: text(data.status) }]; attempt.status = "placed";
        } else attempt.status = "unknown";
        attempt.message = reply.message || (attempt.status === "placed" ? "Instamart order placed successfully" : reply.error?.message || "Check the provider's order history. The full basket must not be retried.");
        if (attempt.status === "placed") state.draft = [];
      } catch {
        attempt.status = "unknown"; attempt.message = "Instamart did not return a confirmed outcome. Do not place this basket again; check recent provider orders and reconcile it.";
      }
    });
  }
  async recentOrders(actor: string) {
    let orders: unknown[] = [], more = false;
    const state = await this.work(actor, "history", async (_state, invoke) => {
      const data = requireSuccess(await invoke("get_orders", { count: 20, activeOnly: false }));
      if (!Array.isArray(data.orders)) throw new PantryError("Instamart order history is unavailable");
      orders = data.orders.slice(0, 20).map(raw => {
        const row = object(raw), delivery = object(row.deliveryAddress);
        return { orderId: identifier(row.orderId), status: text(row.statusMessage) || text(row.currentStatus) || text(row.status), createdAt: text(row.createdAt), total: typeof row.totalAmount === "number" ? row.totalAmount : null, addressId: typeof delivery.id === "string" ? delivery.id : null, addressLine: text(delivery.addressLine, 1000), items: Array.isArray(row.items) ? row.items.map(i => ({ name: text(object(i).name), quantity: object(i).quantity })) : [] };
      });
      more = data.hasMore === true;
    }, { allowUnresolved: true });
    return { state, orders, more };
  }
  async reconcile(actor: string, attemptId: string, orderIds: string[], confirmed: boolean) {
    if (!confirmed || !orderIds.length || orderIds.length > 10 || new Set(orderIds).size !== orderIds.length) throw new PantryError("Select and confirm the provider orders matching this submission", 400);
    return this.work(actor, "reconcile", async (state, invoke) => {
      const attempt = state.attempts.find(a => a.id === attemptId && a.status === "unknown" && a.generation === state.connection?.generation);
      if (!attempt) throw new PantryError("Unresolved submission not found for this connection", 404);
      if (state.attempts.some(other => other.id !== attempt.id && other.orders.some(order => order.orderId && orderIds.includes(order.orderId)))) throw new PantryError("A selected provider receipt already belongs to another submission. Check for the new order instead.", 409);
      const response = requireSuccess(await invoke("get_orders", { count: 20, activeOnly: false }));
      if (!Array.isArray(response.orders)) throw new PantryError("Provider order history is unavailable");
      const providerOrders = response.orders as unknown[];
      const rows = orderIds.map(id => providerOrders.find((raw: unknown) => object(raw).orderId === id)).map(object);
      const start = Date.parse(attempt.startedAt);
      const amount = (value: string) => {
        const raw = value.replace(/₹|INR|,/gi, "").trim();
        if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new PantryError("The provider amount cannot be reconciled automatically", 409);
        return Math.round(Number(raw)*100);
      };
      const total = rows.reduce((sum, row) => sum + (typeof row.totalAmount === "number" ? Math.round(row.totalAmount*100) : NaN), 0);
      const names = (items: {name: string; quantity: number}[]) => {
        const counts = new Map<string, number>();
        for (const item of items) {
          if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new PantryError("The provider quantities cannot be reconciled", 409);
          const name = item.name.normalize("NFKC").trim().toLowerCase(); counts.set(name, (counts.get(name) ?? 0)+item.quantity);
        }
        return JSON.stringify([...counts].sort(([a],[b]) => a.localeCompare(b)));
      };
      const actual = rows.flatMap(row => Array.isArray(row.items) ? row.items.map(raw => ({ name: text(object(raw).name), quantity: Number(object(raw).quantity) })) : []);
      if (rows.some(row => !row.orderId || object(row.deliveryAddress).id !== attempt.address.id || !Number.isFinite(Date.parse(String(row.createdAt))) || Date.parse(String(row.createdAt)) < start-120000 || Date.parse(String(row.createdAt)) > start+300000 || /(fail|cancel|reject)/i.test(String(row.currentStatus ?? row.status))) || total !== amount(attempt.total) || names(actual) !== names(attempt.items)) throw new PantryError("Those provider orders do not exactly match this submission's address, time, items and total. Do not retry; review the Swiggy account or contact support.", 409);
      attempt.orders = rows.map(row => ({ orderId: identifier(row.orderId), status: text(row.currentStatus) || text(row.status) }));
      attempt.status = "placed"; attempt.message = "Instamart order confirmed from provider history after reconciliation.";
      state.draft = []; state.quote = undefined;
    }, { allowUnresolved: true });
  }
  async delivery(actor: string, attemptId: string, orderId: string) {
    let delivery: Record<string, unknown> = {};
    const state = await this.work(actor, "delivery", async (state, invoke) => {
      const attempt = state.attempts.find(a => a.id === attemptId && a.generation === state.connection?.generation && a.orders.some(o => o.orderId === orderId));
      if (!attempt) throw new PantryError("Choose an order from this purchasing connection", 404);
      const order = attempt.orders.find(o => o.orderId === orderId)!;
      if (order.delivery && (order.delivery.nextAt > Date.now() || order.delivery.delivered || order.delivery.cancelled)) { delivery = order.delivery; return; }
      const data = requireSuccess(await invoke("get_delivery_status", { orderId, addressId: attempt.address.id }));
      if (data.orderId !== orderId) throw new PantryError("Instamart returned a different order");
      const cached = { orderId, statusText: text(data.statusText), etaText: text(data.etaText), delivered: data.delivered === true, cancelled: data.cancelled === true, pollIntervalSec: typeof data.pollIntervalSec === "number" ? Math.min(3600, Math.max(10, data.pollIntervalSec)) : 30, nextAt: 0 };
      cached.nextAt = Date.now()+cached.pollIntervalSec*1000; order.delivery = cached; delivery = cached;
    }, { allowUnresolved: true });
    return { state, delivery };
  }
  async acknowledgePartial(actor: string, attemptId: string, confirmed: boolean) {
    if (!confirmed) throw new PantryError("Confirm that you reviewed every store result before building another basket", 400);
    return this.work(actor, "partial-review", async state => {
      const attempt = state.attempts.find(a => a.id === attemptId && a.status === "partial");
      if (!attempt) throw new PantryError("Partial order not found", 404);
      attempt.status = "partial-reviewed"; state.draft = []; state.quote = undefined;
    }, { allowUnresolved: true });
  }
}
export const pantryPurchasing = new PantryPurchasing();
