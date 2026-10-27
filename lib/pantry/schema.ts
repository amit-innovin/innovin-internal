import { createHash, randomUUID } from "node:crypto";
import { object, PantryError } from "./swiggy";
import type { Address, BasketItem, Product, Quote } from "./types";
export const text = (value: unknown, limit = 300) => typeof value === "string" ? value.trim().slice(0, limit) : "";
export function identifier(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.length > 180 || /[\u0000-\u001f]/.test(value)) throw new PantryError("Invalid Instamart identifier");
  return value;
}
export function parseAddresses(data: Record<string, unknown>) {
  if (!Array.isArray(data.addresses) || data.addresses.length > 50) throw new PantryError("Instamart addresses could not be read");
  const addresses: Address[] = data.addresses.map(raw => {
    const row = object(raw), addressLine = text(row.addressLine, 1000);
    if (!addressLine) throw new PantryError("Instamart returned an incomplete address");
    return { id: identifier(row.id), addressLine, label: text(row.addressTag) || text(row.addressCategory) || "Saved address" };
  });
  return { addresses, more: object(data.pagination).hasMore === true };
}
export function parseCatalog(data: Record<string, unknown>) {
  if (!Array.isArray(data.products)) throw new PantryError("Instamart catalog is unavailable");
  const products: Product[] = [];
  for (const [rows, similar] of [[data.products, false], [Array.isArray(data.similarProducts) ? data.similarProducts : [], true]] as const) {
    for (const item of rows.slice(0, 50)) {
      const parent = object(item);
      if (!Array.isArray(parent.variations)) throw new PantryError("Instamart returned unsupported product variants");
      for (const raw of parent.variations.slice(0, 10)) {
        const v = object(raw), price = object(v.price).offerPrice;
        if (typeof price !== "number" || !Number.isFinite(price) || price < 0) throw new PantryError("Instamart product price is unavailable");
        const name = text(v.displayName) || text(parent.displayName), variant = text(v.quantityDescription);
        if (!name) throw new PantryError("Instamart product details are missing");
        products.push({ spinId: identifier(v.spinId), skuId: identifier(v.skuId), name, variant, price, available: v.isInStockAndAvailable === true, maxQuantity: typeof v.maxQuantity === "number" && Number.isInteger(v.maxQuantity) && v.maxQuantity > 0 ? Math.min(100, v.maxQuantity) : 100, similar });
      }
    }
  }
  const unique = [...new Map(products.map(p => [`${p.spinId}:${p.skuId}`, p])).values()].slice(0, 150);
  const cursor = String(data.nextOffset ?? "");
  return { products: unique, nextOffset: /^\d+$/.test(cursor) && Number(cursor) > 0 && Number(cursor) <= 10000 ? Number(cursor) : undefined };
}
export function parseQuote(data: Record<string, unknown>, address: Address, draft: BasketItem[], actor: string): Quote {
  const selected = object(data.selectedAddressDetails);
  if ((selected.id ?? data.selectedAddress) !== address.id) throw new PantryError("Instamart cart address changed. Select and review the office address again.", 409);
  if (!text(selected.address, 1000)) throw new PantryError("Instamart has not returned the full live delivery address. Review it in Swiggy before continuing.", 409);
  const destination: Address = { id: address.id, label: address.label, addressLine: [text(selected.flatNo), text(selected.address,1000), text(selected.area), text(selected.city), text(selected.name), text(selected.mobile)].filter(Boolean).join(", ") };
  if (data.cartAbsent === true || !Array.isArray(data.items) || !data.items.length || data.items.length > 50 || (Array.isArray(data.unserviceableItems) && data.unserviceableItems.length) || text(data.addressWarning) || Number(object(data.cartWarning).statusCode) >= 400) throw new PantryError("Instamart cannot fulfill this basket at the selected address. Review stock and serviceability.", 409);
  const items: BasketItem[] = data.items.map(raw => {
    const row = object(raw), spinId = identifier(row.spinId), skuId = identifier(row.skuId);
    const chosen = draft.find(p => p.spinId === spinId && p.skuId === skuId);
    if (!chosen || !Number.isInteger(row.quantity) || Number(row.quantity) < 1 || Number(row.quantity) > chosen.quantity || row.isInStockAndAvailable !== true || typeof row.discountedFinalPrice !== "number" || !Number.isFinite(row.discountedFinalPrice) || row.discountedFinalPrice < 0) throw new PantryError("The provider basket differs from your selections. Rebuild and review it.", 409);
    return { ...chosen, name: text(row.itemName) || chosen.name, variant: text(row.itemVariant) || chosen.variant, price: row.discountedFinalPrice, quantity: Number(row.quantity), available: true };
  });
  if (new Set(items.map(i => `${i.spinId}:${i.skuId}`)).size !== items.length) throw new PantryError("Unsupported duplicate provider cart lines");
  const breakdown = object(data.billBreakdown), total = text(object(breakdown.toPay).value);
  if (!total || !Array.isArray(breakdown.lineItems)) throw new PantryError("Instamart has not returned a complete bill");
  const bill = breakdown.lineItems.slice(0, 30).map(raw => ({ label: text(object(raw).label), value: text(object(raw).value) }));
  const methods = new Set<string>();
  for (const value of !data.paymentOptions && Array.isArray(data.availablePaymentMethods) ? data.availablePaymentMethods : []) if (typeof value === "string" && /^(cash|cod)$/i.test(value)) methods.add(value);
  for (const value of Array.isArray(object(data.paymentOptions).allMethods) ? object(data.paymentOptions).allMethods as unknown[] : []) {
    const row = object(value);
    if (row.enabled !== false && typeof row.id === "string" && /^(cash|cod)$/i.test(row.id)) methods.add(row.id);
  }
  const paymentMethods = [...methods].sort();
  const storeCount = new Set(data.items.map(raw => text(object(raw).storeId)).filter(Boolean)).size;
  const cartId = typeof data.cartId === "string" ? data.cartId : undefined;
  const stableItems = [...items].sort((a,b) => `${a.spinId}:${a.skuId}`.localeCompare(`${b.spinId}:${b.skuId}`)).map(({ spinId, skuId, name, variant, price, quantity }) => ({ spinId, skuId, name, variant, price, quantity }));
  const fingerprint = createHash("sha256").update(JSON.stringify({ address: destination, total, bill, cartId, items: stableItems, paymentMethods, storeCount })).digest("hex");
  return { id: randomUUID(), actor, expiresAt: Date.now()+120000, fingerprint, address: destination, total, bill, items, paymentMethods, storeCount, cartId };
}
