"use client";
import Link from "next/link";
import { fulfillmentOf,FULFILLMENT_LABELS } from "@/lib/order-state";
import { useState } from "react";
import { Coffee, LockKeyhole, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { readError, send } from "@/lib/fetcher";
import { MENU } from "@/lib/menu";
import { PANTRY_LIMIT } from "@/lib/workspace-model";
import type { WorkspaceData } from "@/lib/workspace";
const emoji: Record<string, string> = { tea: "☕", snacks: "🍪", healthy: "🥑", lunch: "🥗", dinner: "🍲" };
export function Pantry({ data, onSaved, onOffice }: { data: WorkspaceData; onSaved: () => Promise<void>; onOffice: () => Promise<void> }) {
  const [busy, setBusy] = useState(false), [query, setQuery] = useState(""), [browse, setBrowse] = useState(false), [saved, setSaved] = useState(false);
  const selected = data.snacks.items.map(r => r.itemId), locked = data.mode !== "office";
  const stage=fulfillmentOf(data.snacks.items[0]);
  const editable=stage==="requested";
  const menu = MENU.filter(m => m.name.toLowerCase().includes(query.trim().toLowerCase()));
  async function save(next: string[]) {
    if (busy || !editable) return;
    if(!next.length && selected.length && !window.confirm("Cancel today's pantry request? This does not cancel a supplier purchase."))return;
    setBusy(true);
    const res = await send("/api/snacks", next.length ? { method: "POST", json: { items: next, instructions: data.snacks.items[0]?.instructions || "" } } : { method: "DELETE" });
    if (!res.ok) toast.error(await readError(res)); else { await onSaved(); setSaved(true); toast.success("Your pantry request is saved.",{id:"pantry-request"}); }
    setBusy(false);
  }
  return <section className="widget-card snacks-widget reference-pantry"><div className="widget-header"><div className="widget-title-group"><span className="widget-icon-pill amber"><Coffee size={16} /></span><div><h2 className="widget-title">Pantry &amp; Snacks Bar</h2><span className="widget-sub">Pantry requests · prepared by the coordinator</span></div></div><div className="snacks-quota-badge">{selected.length} / {PANTRY_LIMIT} requested today</div></div>
    {locked ? <div className="snacks-locked-overlay"><div className="locked-card-content"><div className="lock-icon-circle"><LockKeyhole size={28} /></div><h3>The pantry is an office perk.</h3><p>You are currently {data.mode === "remote" ? "Remote / WFH" : "not checked in"}. Check in when you are in the office to order.</p><button className="btn-coral-auth" disabled={busy} onClick={async () => { setBusy(true); await onOffice(); setBusy(false); }}>Check In to Office to Request</button></div></div> : <div className="snacks-body">
      <div className="pantry-search-container"><div className="pantry-search-box"><Search className="pantry-search-icon" size={14} /><input type="search" aria-label="Search pantry" placeholder="Search tea, snacks, treats..." value={query} onFocus={() => setBrowse(true)} onChange={e => { setQuery(e.target.value); setBrowse(true); }} /><button className="btn-clear-search" aria-label="Clear pantry search" onClick={() => { setQuery(""); setBrowse(false); }}><X size={15} /></button></div>
        {browse && <div className="pantry-search-dropdown"><div className="pantry-search-results">{menu.map(m => <div key={m.id} className="pantry-result-row"><span className="snack-emoji">{emoji[m.id]}</span><div><strong>{m.name}</strong><small>{m.price === null ? "Office menu" : `₹${m.price}`}</small></div><button className="btn-add-snack" aria-label={`${selected.includes(m.id) ? "Remove" : "Add"} ${m.name}`} disabled={busy || !editable || !data.snacks.open || (!selected.includes(m.id) && selected.length >= PANTRY_LIMIT)} onClick={() => save(selected.includes(m.id) ? selected.filter(v => v !== m.id) : [...selected, m.id])}>{selected.includes(m.id) ? "✓ Added" : "+ Add"}</button></div>)}{!menu.length && <p className="pantry-no-results">No menu items match. Try another search.</p>}</div></div>}
      </div>
      <div className="pantry-quick-tags">{MENU.map(m => <button key={m.id} className="pantry-tag-chip" aria-pressed={selected.includes(m.id)} disabled={busy || !editable || !data.snacks.open || (!selected.includes(m.id) && selected.length>=PANTRY_LIMIT)} onClick={() => save(selected.includes(m.id)?selected.filter(v=>v!==m.id):[...selected,m.id])}>{emoji[m.id]} {m.name}</button>)}</div>
      <div className="pantry-cart-box"><div className="pantry-cart-header"><div className="cart-title-meta"><span className="cart-pill-icon"><ShoppingCart size={13} /></span><strong className="cart-heading">Your pantry request</strong><span className="cart-item-count">{selected.length} items</span></div><button className="btn-clear-cart-all" disabled={busy || !editable || !selected.length || !data.snacks.open} onClick={() => save([])}>Clear</button></div>
        <div className="pantry-cart-items">{selected.length ? selected.map(id => <div key={id} className="pantry-result-row"><span>{emoji[id]}</span><strong>{MENU.find(m => m.id === id)?.name}</strong><span className="cart-item-count">1 selection</span><button className="btn-delete-cart-item" aria-label={`Remove ${MENU.find(m => m.id === id)?.name} from cart`} disabled={busy || !editable || !data.snacks.open} onClick={() => save(selected.filter(v => v !== id))}><Trash2 size={13} /></button></div>) : <div className="empty-cart-state"><span className="empty-cart-icon">🛒</span><p>Your cart is empty</p><span>Search or tap a suggestion to add an item</span></div>}</div>
        <div className="pantry-cart-footer"><div className="cart-delivery-loc"><span className="desk-dot" /><span>Office desk: <strong>{data.profile?.desk || "Set in profile"}</strong></span></div><span className="cart-save-state">{busy ? "Saving…" : selected.length ? FULFILLMENT_LABELS[stage] : !data.snacks.open ? "Requests closed" : "Up to 4 items"}</span></div>
      </div><Link className="reference-tray-history" href="/snacks">Notes &amp; request history ↗</Link>{saved && <span role="status" className="sr-only">Your tray is saved.</span>}
    </div>}
  </section>;
}
