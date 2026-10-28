"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {ArrowRight,Minus,Plus,Package,Search,ShoppingBag} from "lucide-react";
import {toast} from "sonner";
import {PageHeader} from "@/components/kit";
import {LoadRecovery} from "@/components/load-recovery";
import {getJSON,send,readError} from "@/lib/fetcher";
import {FULFILLMENT_LABELS,fulfillmentOf} from "@/lib/order-state";
import {SHOP_CATEGORIES,catalogFresh,productKey,orderName,orderQuantity,type ShopProduct} from "@/lib/pantry/shop";
import type {OrderRow} from "@/lib/types";
import {useMobileViewport} from "@/lib/hooks/use-mobile-viewport";

type PublicOrder=Omit<OrderRow,"submitterRef">;
type Shop={unavailable?:boolean;products:ShopProduct[];revision:string;ready:boolean;email:string;today:string;open:boolean;officeAllowed:boolean;canManage:boolean;orders:PublicOrder[]};
type Line={product:ShopProduct;quantity:number};
const money=(value:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(value);
export function ProductPhoto({product}:{product:Pick<ShopProduct,"imageUrl"|"name">}){
 const [failed,setFailed]=useState(false);
 return <div className="shop-product-photo">{product.imageUrl&&!failed?<img src={product.imageUrl} alt={product.name} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<Package size={38} aria-hidden="true"/>}</div>;
}
export default function PantryShop(){
 const [data,setData]=useState<Shop|null>(null),[lines,setLines]=useState<Line[]>([]),[note,setNote]=useState("");
 const [query,setQuery]=useState(""),[category,setCategory]=useState("All"),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[draftStored,setDraftStored]=useState(false);
 const writing=useRef(false),basket=useRef<HTMLElement|null>(null);const keyboardOpen=useMobileViewport(true);
 const key=(email:string)=>`innovin:product-basket:${email}`;
 async function load(restore=false){
  const result=await getJSON<Shop>("/api/pantry-shop","the office shop",{fresh:true});if(!result){setFailed(true);return;}setFailed(false);
  const rows=result.orders.filter(r=>r.date===result.today),canEdit=result.open&&fulfillmentOf(rows[0])==="requested";let next=rows.flatMap(r=>r.product?[{product:canEdit?(result.products.find(p=>productKey(p)===productKey(r.product!))??r.product):r.product,quantity:r.product.quantity}]:[]),instructions=rows[0]?.instructions??"";
  if(restore&&canEdit)try{const saved=JSON.parse(localStorage.getItem(key(result.email))??"null");if(saved?.date===result.today&&saved.revision===result.revision&&Array.isArray(saved.ids)&&JSON.stringify([...saved.ids].sort())===JSON.stringify(rows.map(r=>r.id).sort())){next=saved.lines.flatMap((line:{spinId:string;skuId:string;quantity:number})=>{const product=result.products.find(p=>p.spinId===line.spinId&&p.skuId===line.skuId);return product&&Number.isInteger(line.quantity)&&line.quantity>0&&line.quantity<=product.maxQuantity?[{product,quantity:line.quantity}]:[];}).slice(0,4);instructions=String(saved.note??"").slice(0,500);}}catch{}
  setData(result);setLines(next);setNote(instructions);
 }
 useEffect(()=>{void load(true);},[]);
 useEffect(()=>{if(!data)return;try{localStorage.setItem(key(data.email),JSON.stringify({date:data.today,revision:data.revision,ids:data.orders.filter(r=>r.date===data.today).map(r=>r.id),lines:lines.map(l=>({spinId:l.product.spinId,skuId:l.product.skuId,quantity:l.quantity})),note}));setDraftStored(true);}catch{setDraftStored(false);}},[data,lines,note]);
 if(!data)return <div className="pantry-shop"><PageHeader title="Office pantry" subtitle="Choose exact products for the shared office order."/><LoadRecovery><p role="status">{failed?"The shop could not be loaded.":"Opening the pantry…"}</p><button className="studio-button" onClick={()=>load(true)}>Reload shop</button></LoadRecovery></div>;
 const today=data.orders.filter(r=>r.date===data.today),stage=fulfillmentOf(today[0]);const editable=stage==="requested"&&data.open;
 const total=lines.reduce((sum,l)=>sum+l.product.price*l.quantity,0),units=lines.reduce((sum,l)=>sum+l.quantity,0);
 const rows=data.products.filter(p=>(category==="All"||p.category===category)&&`${p.name} ${p.brand??""} ${p.variant}`.toLowerCase().includes(query.trim().toLowerCase()));
 const original=today.flatMap(r=>r.product?[{key:productKey(r.product),quantity:r.product.quantity,price:r.product.price,sourceKey:r.product.sourceKey}]:[]),chosen=lines.map(l=>({key:productKey(l.product),quantity:l.quantity,price:l.product.price,sourceKey:l.product.sourceKey}));
 const dirty=JSON.stringify(original)!==JSON.stringify(chosen)||note!==(today[0]?.instructions??"");
 function change(product:ShopProduct,delta:number){if(busy||!editable)return;setLines(old=>{const found=old.find(l=>productKey(l.product)===productKey(product));const quantity=(found?.quantity??0)+delta;if(quantity<=0)return old.filter(l=>l!==found);if(!product.available||quantity>product.maxQuantity||(!found&&old.length>=4))return old;return found?old.map(l=>l===found?{...l,quantity}:l):[...old,{product,quantity}];});}
 async function save(cancel=false){
  if(writing.current)return;
  if(cancel&&!window.confirm("Cancel today's pantry request? This does not cancel a supplier purchase."))return;
  if(!cancel&&today.some(r=>!r.product)&&!window.confirm(`Replace today's office request (${today.map(orderName).join(", ")}) with these exact products?`))return;
  writing.current=true;setBusy(true);
  try{const res=await send("/api/pantry-shop",{method:"POST",json:{items:cancel?[]:lines.map(l=>({spinId:l.product.spinId,skuId:l.product.skuId,quantity:l.quantity})),revision:data!.revision,expectedIds:today.map(r=>r.id),instructions:note}});
   if(!res.ok){toast.error(await readError(res));if(res.status===409){try{localStorage.removeItem(key(data!.email));}catch{}await load();}return;}
   try{localStorage.removeItem(key(data!.email));}catch{}await load();toast.success(cancel?"Pantry request cancelled":today.length?"Request updated":"Request sent to the coordinator");
  }finally{writing.current=false;setBusy(false);}
 }
 return <div className="pantry-shop" data-keyboard-open={keyboardOpen||undefined}>
  <PageHeader title="Office pantry" subtitle="Pick what you’d like. Your coordinator handles the office order."/>
  <div className="shop-intro"><span className="shop-provider-label"><ShoppingBag size={17}/>Instamart products</span><div className="shop-intro-links"><button disabled={busy} onClick={()=>{if(dirty&&!window.confirm("Refresh the catalog and discard your unsent basket changes?"))return;void load();}}>Refresh</button>{data.canManage&&<Link href="/admin/pantry">Manage shop ↗</Link>}</div><p>Products selected for our office · prices are estimates until checkout</p></div>
  {today.length>0&&<div className="shop-request-status" role="status"><strong>{FULFILLMENT_LABELS[stage]}</strong><p>{today.map(r=>`${orderName(r)} × ${orderQuantity(r)}`).join(" + ")}</p>{stage!=="requested"&&<small>Contact your coordinator for changes. Supplier purchases are handled separately.</small>}</div>}
  {data.unavailable&&<p role="alert" className="studio-notice">The product catalog is temporarily unavailable. Your saved request and cancellation remain available below.</p>}
  {data.products.some(p=>!catalogFresh(p))&&<p className="studio-notice">Some listings are older than a day. Ask your coordinator to refresh them before requesting.</p>}
  {!data.officeAllowed&&<p className="studio-notice">You can browse now. <Link href="/attendance">Check in to the office</Link> to send a request.</p>}
  {!data.open&&<p className="studio-notice">Requests are closed for today. You can still browse and see your saved status.</p>}
  <label className="shop-search"><Search size={19}/><input type="search" aria-label="Search office products" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products, brands or pack sizes"/></label>
  <div className="shop-categories" role="group" aria-label="Product categories">{["All",...SHOP_CATEGORIES].map(c=><button key={c} aria-pressed={c===category} onClick={()=>setCategory(c)}>{c}</button>)}</div>
  {!data.products.length?<section className="shop-empty"><ShoppingBag size={36}/><h2>The office shop is being stocked</h2><p>Your coordinator can share exact Instamart products here. Once available, you can choose packs and quantities for the office order.</p>{data.canManage?<Link className="studio-button" href="/admin/pantry">Set up the office catalog</Link>:<p>Ask the office coordinator to add products.</p>}</section>:rows.length?<div className="shop-product-grid">{rows.map(p=>{const line=lines.find(l=>productKey(l.product)===productKey(p));return <article className="shop-product-card" key={productKey(p)}><ProductPhoto product={p}/><div className="shop-product-details">{p.brand&&<small>{p.brand}</small>}<h2 title={p.name}>{p.name}</h2><p>{p.variant||"Pack size provided at checkout"}</p><div className="shop-price"><strong>{money(p.price)}</strong>{p.mrp&&p.mrp>p.price?<s>{money(p.mrp)}</s>:null}</div><small className="shop-price-note">Estimate · refreshed {new Date(p.publishedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</small></div>{line?<div className="shop-quantity"><button aria-label={`Decrease ${p.name}`} disabled={busy||!editable} onClick={()=>change(p,-1)}><Minus size={16}/></button><output aria-label={`Quantity of ${p.name}`}>{line.quantity}</output><button aria-label={`Increase ${p.name}`} disabled={busy||!editable||!p.available||line.quantity>=p.maxQuantity} onClick={()=>change(p,1)}><Plus size={16}/></button></div>:<button className="shop-add" aria-label={`Add ${p.name} ${p.variant}`} disabled={busy||!editable||!p.available||lines.length>=4} onClick={()=>change(p,1)}>{p.available?"Add +":"Unavailable"}</button>}</article>;})}</div>:<p className="shop-empty">No products match. Try another search or category.</p>}
  <section className="shop-basket" id="pantry-basket" ref={basket} aria-label="Your product basket"><div className="shop-basket-heading"><h2>Your basket</h2><span>{lines.length} / 4 products</span></div>{lines.length?<><ul>{lines.map(l=><li key={productKey(l.product)}><div><strong>{l.product.name}</strong><small>{l.product.variant} × {l.quantity}</small></div><span>{money(l.product.price*l.quantity)}</span><button aria-label={`Remove ${l.product.name}`} disabled={busy||!editable} onClick={()=>setLines(old=>old.filter(v=>v!==l))}>Remove</button></li>)}</ul><p className="shop-total"><span>Estimated product total</span><strong>{money(total)}</strong></p><p className="shop-price-note">Delivery fees, stock and final prices are confirmed by the coordinator before purchase.</p></>:<p>Add up to four products from the office catalog.</p>}
   <label className="shop-note-label">Request instructions<textarea aria-label="Request instructions" value={note} onChange={e=>setNote(e.target.value)} maxLength={500} rows={2} disabled={busy||!editable} placeholder="Anything the coordinator should know?"/></label>
   {today.some(r=>!r.product)&&<p className="studio-notice">Sending this basket replaces your existing meal/drink request for today.</p>}
   <button className="shop-submit" disabled={busy||!editable||!data.officeAllowed||!lines.length||!dirty||lines.some(l=>!data.products.some(p=>productKey(p)===productKey(l.product)&&p.available))} onClick={()=>save()}>{busy?"Saving…":today.length?"Update request":"Send request"}<ArrowRight size={18}/></button>
   {dirty&&editable&&<p className="shop-draft-note">{draftStored?"Basket changes are saved on this device.":"These changes have not been sent."} Send your request to add it to the coordinator’s list.</p>}
   {!!today.length&&editable&&<button className="shop-cancel" disabled={busy} onClick={()=>save(true)}>Cancel today’s request</button>}
  </section>
  <div className="shop-secondary"><Link href="/snacks?tab=history">Request history ↗</Link><Link href="/snacks">Office meals & drinks ↗</Link></div>
  {lines.length>0&&editable&&<div className="shop-basket-bar"><button onClick={()=>basket.current?.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"})}><span><ShoppingBag size={19}/>Review basket · {units} {units===1?"item":"items"}</span><strong>{money(total)} →</strong></button></div>}
 </div>;
}
