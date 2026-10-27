import type { OrderRow } from "./types";
export const FULFILLMENT_LABELS = { requested:"Request received",preparing:"Being prepared",ready:"Ready for collection",fulfilled:"Collected / delivered" } as const;
export type OrderFulfillment = keyof typeof FULFILLMENT_LABELS;
export function fulfillmentOf(row?: Pick<OrderRow,"fulfillment">):OrderFulfillment { return row?.fulfillment??"requested"; }
export function nextFulfillment(from:OrderFulfillment):OrderFulfillment|null { return ({requested:"preparing",preparing:"ready",ready:"fulfilled",fulfilled:null} as const)[from]; }
export function canMoveFulfillment(from:OrderFulfillment,to:OrderFulfillment) { return nextFulfillment(from)===to || (to==="requested"&&(from==="preparing"||from==="ready")); }
export function isFulfillment(value:unknown):value is OrderFulfillment { return typeof value==="string" && Object.hasOwn(FULFILLMENT_LABELS,value); }
export class PantryRequestLockedError extends Error { constructor(){super("Preparation has started. Contact the coordinator to change or cancel this request; supplier purchases are separate.");} }
export function assertRequestEditable(rows: Pick<OrderRow,"fulfillment">[]) { if(rows.some(r=>fulfillmentOf(r)!=="requested"))throw new PantryRequestLockedError(); }
export function sameTray(rows:Pick<OrderRow,"id">[],expectedIds:string[]) { return rows.length>0 && rows.length===expectedIds.length && new Set(expectedIds).size===expectedIds.length && rows.every(r=>expectedIds.includes(r.id)); }
