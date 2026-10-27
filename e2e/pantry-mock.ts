import http from "node:http";
import { createHash, randomUUID } from "node:crypto";
// Test-only provider boundary. No fixtures or control endpoints are compiled into the app.
export function startPantryMock(port = 3998) {
  let loseNextCheckout = false;
  const clients = new Map<string,string>();
  const codes = new Map<string,{client:string;challenge:string;redirect:string}>();
  let items: {spinId:string;skuId:string;quantity:number}[] = [];
  const orders: Record<string,unknown>[] = [];
  const address = { id: "office", addressLine: "Innovin test office, Kerala", addressCategory: "Office" };
  const variant = { spinId: "spin-1", skuId: "sku-1", displayName: "Test biscuits", quantityDescription: "200 g", price: {offerPrice:40}, isInStockAndAvailable:true,maxQuantity:10 };
  const cart = () => ({cartId:"test-cart",selectedAddressDetails:{id:address.id,address:address.addressLine},items:items.map(i => ({...i,itemName:"Test biscuits",itemVariant:"200 g",discountedFinalPrice:40,isInStockAndAvailable:true,storeId:"store-1"})),billBreakdown:{lineItems:[{label:"Items",value:`₹${items.reduce((s,i)=>s+i.quantity*40,0)}`}],toPay:{label:"To pay",value:`₹${items.reduce((s,i)=>s+i.quantity*40,0)}`}}});
  const server = http.createServer(async (req,res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    res.setHeader("Content-Type","application/json");
    if (url.pathname === "/fixture/lose-next-checkout") { loseNextCheckout = true; return res.end("{}"); }
    if (url.pathname === "/auth/authorize") {
      const client = url.searchParams.get("client_id")!;
      const redirect = url.searchParams.get("redirect_uri")!;
      if (clients.get(client) !== redirect || url.searchParams.get("code_challenge_method") !== "S256") {res.writeHead(400);return res.end("{}");}
      const code = randomUUID(); codes.set(code,{client,redirect,challenge:url.searchParams.get("code_challenge")!});
      const dest = new URL(redirect);dest.searchParams.set("code",code);dest.searchParams.set("state",url.searchParams.get("state")!);
      res.writeHead(302,{Location:dest.href});return res.end();
    }
    let raw="";for await (const chunk of req) raw += chunk;
    let body: Record<string,any>;try {body=JSON.parse(raw || "{}");} catch {res.writeHead(400);return res.end("{}");}
    if (url.pathname === "/auth/register") {const id=randomUUID();clients.set(id,body.redirect_uris[0]);return res.end(JSON.stringify({client_id:id,token_endpoint_auth_method:"none"}));}
    if (url.pathname === "/auth/token") {
      if (body.grant_type === "authorization_code") {
        const code=codes.get(body.code);codes.delete(body.code);
        if (!code || code.client!==body.client_id || code.redirect!==body.redirect_uri || createHash("sha256").update(body.code_verifier).digest("base64url")!==code.challenge) {res.writeHead(400);return res.end("{}");}
      }
      return res.end(JSON.stringify({access_token:`fixture.${Buffer.from(JSON.stringify({user_id:"test-purchaser"})).toString("base64url")}.fixture`,refresh_token:randomUUID(),expires_in:3600}));
    }
    if (url.pathname!=="/im") {res.writeHead(404);return res.end("{}");}
    if (req.method!=="POST") {res.writeHead(405);return res.end();}
    if (body.id===undefined) {res.writeHead(202);return res.end();}
    let result: unknown;
    if(body.method==="initialize") result={protocolVersion:"2025-03-26",capabilities:{tools:{}},serverInfo:{name:"pantry-fixture",version:"1"}};
    else if(body.method==="tools/call") {
      if (!req.headers.authorization?.startsWith("Bearer fixture.")) {res.writeHead(401);return res.end("{}");}
      const {name,arguments:args}=body.params;let data:unknown;
      if(name==="get_addresses") data={addresses:[address],pagination:{hasMore:false}};
      else if(name==="search_products") data={products:[{variations:[variant]}],nextOffset:""};
      else if(name==="update_cart") {items=args.items;data=cart();}
      else if(name==="get_cart") data=cart();
      else if(name==="get_payment_options") data={allMethods:[{id:"COD",enabled:true}],cod:{available:true,id:"COD"}};
      else if(name==="checkout") {const id=randomUUID();orders.unshift({orderId:id,status:"CONFIRMED",createdAt:new Date().toISOString(),totalAmount:items.reduce((s,i)=>s+i.quantity*40,0),deliveryAddress:address,items:items.map(i=>({name:"Test biscuits",quantity:i.quantity}))});if (loseNextCheckout) { loseNextCheckout=false; res.writeHead(502);return res.end("{}"); } data={orderId:id,status:"CONFIRMED",paymentMethod:"COD"};}
      else if(name==="get_orders") data={orders,hasMore:false};
      else if(name==="get_delivery_status") data={orderId:args.orderId,statusText:"On the way",etaText:"10 minutes",pollIntervalSec:30};
      else {res.writeHead(400);return res.end("{}");}
      const envelope={success:true,data};result={content:[{type:"text",text:JSON.stringify(envelope)}],structuredContent:envelope};
    } else result={};
    res.end(JSON.stringify({jsonrpc:"2.0",id:body.id,result}));
  });
  return new Promise<()=>Promise<void>>(resolve=>server.listen(port,()=>resolve(()=>new Promise(done=>server.close(()=>done())))));
}
