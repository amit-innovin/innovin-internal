import {NextRequest,NextResponse} from "next/server";
import {USER_COOKIE,verifyUserSession} from "@/lib/auth";
import {currentActor} from "@/lib/admin";
import {store,id} from "@/lib/store";
import {pantryRef} from "@/lib/submitter";
import {todayIST,istHour} from "@/lib/time";
import {orderCutoffHour} from "@/lib/config";
import {officePantryAllowed} from "@/lib/workspace";
import {pantryPurchasing} from "@/lib/pantry/service";
import {purchasingError} from "@/lib/pantry/access";
import {PantryChangedError} from "@/lib/pantry/shop";
import {PantryRequestLockedError} from "@/lib/order-state";
import {readJSON,badRequest,clientIp,str} from "@/lib/http";
import {enforce} from "@/lib/guard";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const user=verifyUserSession(req.cookies.get(USER_COOKIE)?.value);if(!user)return NextResponse.json({error:"Sign in to browse the office pantry"},{status:401});
 try {
  const [shop,orders,allowed,actor]=await Promise.all([pantryPurchasing.shop().catch(()=>({products:[],revision:"unavailable",ready:false,unavailable:true})),store.listOrdersByRef(pantryRef(user.email),120),officePantryAllowed(user.email),currentActor()]);
  return NextResponse.json({...shop,email:user.email,today:todayIST(),open:istHour()<orderCutoffHour(),cutoffHour:orderCutoffHour(),officeAllowed:allowed,canManage:actor?.role==="owner"||actor?.role==="admin",orders:orders.map(({submitterRef:_,...r})=>r)},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return purchasingError(error);}
}
export async function POST(req:NextRequest){
 const user=verifyUserSession(req.cookies.get(USER_COOKIE)?.value);if(!user)return NextResponse.json({error:"Sign in to submit a pantry request"},{status:401});
 if(req.headers.get("origin")!==req.nextUrl.origin)return NextResponse.json({error:"Open the pantry in this app"},{status:403});
 const limited=enforce([["writeIp",clientIp(req)],["writeIp",`shop:${user.email}`]]);if(limited)return limited;
 if(istHour()>=orderCutoffHour())return NextResponse.json({error:"Requests are closed for today"},{status:403});
 const body=await readJSON(req);if(!body)return badRequest();
 if(!Array.isArray(body.items)||!Array.isArray(body.expectedIds)||body.expectedIds.length>50||body.expectedIds.some(v=>typeof v!=="string"||v.length>180))return badRequest("Reload your current request before saving");
 if(body.items.length&&!await officePantryAllowed(user.email))return NextResponse.json({error:"Check in to the office before requesting products"},{status:403});
 try{
  const products=body.items.length?await pantryPurchasing.selection(body.items,str(body.revision)):[];
  const now=new Date().toISOString(),date=todayIST(),ref=pantryRef(user.email);
  const rows=products.map(product=>({id:id(),date,itemId:`instamart:${encodeURIComponent(product.spinId)}:${encodeURIComponent(product.skuId)}`,preference:"anything",instructions:str(body.instructions).trim().slice(0,500),submitterRef:ref,orderedBy:user.email,createdAt:now,product}));
  await store.setDayOrders(date,ref,rows,body.expectedIds as string[]);
  return NextResponse.json({ok:true});
 }catch(error){if(error instanceof PantryChangedError||error instanceof PantryRequestLockedError)return NextResponse.json({error:error.message},{status:409});return purchasingError(error);}
}
