import type { Product } from "./types";
import type { OrderRow } from "../types";
export const SHOP_CATEGORIES=["Snacks","Drinks","Fruit & healthy","Essentials"] as const;
export type ShopCategory=typeof SHOP_CATEGORIES[number];
export type ShopProduct=Product & {category:ShopCategory;publishedAt:string;sourceKey:string};
export type RequestedProduct=ShopProduct & {quantity:number};
export const productKey=(p:Pick<Product,"spinId"|"skuId">)=>`${encodeURIComponent(p.spinId)}:${encodeURIComponent(p.skuId)}`;
export const orderName=(r:Pick<OrderRow,"itemId"|"product">)=>r.product?`${r.product.name} · ${r.product.variant}`:({tea:"Tea",snacks:"Snacks",healthy:"Healthy Option",lunch:"Lunch",dinner:"Dinner"}[r.itemId]??r.itemId);
export const orderQuantity=(r:Pick<OrderRow,"product">)=>r.product?.quantity??1;
export function productImage(value:unknown):string|undefined {
 if(typeof value!=="string")return;try{const url=new URL(value);if(url.protocol==="https:"&&["images.swiggy.com","media-assets.swiggy.com"].includes(url.hostname)&&!url.username&&!url.password&&!url.port)return url.href;}catch{}return;
}
export class PantryChangedError extends Error {constructor(){super("Your request changed in another tab. Reload it before saving.");}}
export function assertBasketRevision(rows:Pick<OrderRow,"id"|"product">[],expected?:string[]){if(expected===undefined&&rows.some(r=>r.product))throw new PantryChangedError();if(expected&&(rows.length!==expected.length||new Set(expected).size!==expected.length||rows.some(r=>!expected.includes(r.id))))throw new PantryChangedError();}
export const catalogFresh=(p:ShopProduct,now=Date.now())=>Number.isFinite(Date.parse(p.publishedAt))&&now-Date.parse(p.publishedAt)<86400000;
