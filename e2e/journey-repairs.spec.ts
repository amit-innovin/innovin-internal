import { test,expect,signInEmployee,adminLogin,uniqueEmail } from "./fixtures";

test("quick step logging persists across reload instead of only changing a draft",async({page})=>{
  await signInEmployee(page,uniqueEmail("steps-repair"),"/steps");
  await page.getByRole("button",{name:/500.*(?:Quick Walk|Steps)/}).first().click();
  await expect(page.getByText("Today's steps saved",{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.locator('input[type="number"]').first()).toHaveValue("500");
});
test("formal leave and exact recorded calendar dates are addressable destinations",async({page})=>{
  await signInEmployee(page,uniqueEmail("leave-repair"),"/attendance?tab=leave");
  await expect(page.getByRole("heading",{name:"Request time away"})).toBeVisible();
  await page.goto("/attendance?tab=calendar&date=2026-11-05");
  await expect(page.getByText("November 2026",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:/^5 Nov /})).toHaveAttribute("aria-pressed","true");
});
test("mobile board URL and notification open the announcement itself",async({page,isMobile})=>{
  test.skip(!isMobile,"The broken destination was the mobile wallet");
  await adminLogin(page,"publish");
  await page.getByRole("textbox",{name:"Title",exact:true}).fill("Journey announcement");
  await page.getByRole("button",{name:"Post announcement",exact:true}).click();
  await page.waitForLoadState("networkidle");
  await signInEmployee(page,uniqueEmail("board-repair"),"/");
  await page.getByRole("button",{name:/^Notifications/}).click();
  await page.getByRole("link").filter({hasText:"Journey announcement"}).first().click();
  await expect(page).toHaveURL(/view=board/);
  await expect(page.locator('[id^="announcement-"]').filter({hasText:"Journey announcement"})).toBeVisible();
  await page.waitForLoadState("networkidle");await page.reload();
  await expect(page.getByRole("heading",{name:"Notice Board",exact:true})).toBeVisible();
});

test("event organizers can correct and cancel their event without losing existing RSVPs",async({page,browser,isMobile})=>{
  const {uniqueText}=await import("./fixtures");const title=uniqueText("Organized event"),changed=`${title} corrected`;
  await signInEmployee(page,uniqueEmail("organizer"),"/");if(isMobile)await page.getByRole("button",{name:"Expand Events",exact:true}).click();
  await page.getByRole("button",{name:"Add event",exact:true}).click();
  const dialog=page.getByRole("dialog");await dialog.getByLabel("Event title").fill(title);await dialog.getByLabel("Date & time (IST)").fill("2026-12-30T17:00");
  await dialog.getByRole("button",{name:"Publish event",exact:true}).click();await expect(dialog).toHaveCount(0);
  const ctx=await browser.newContext(),reader=await ctx.newPage();await signInEmployee(reader,uniqueEmail("attendee"),"/events");
  await reader.locator("li").filter({hasText:title}).getByRole("button",{name:"Join",exact:true}).click();
  await page.getByRole("button",{name:`Edit ${title}`,exact:true}).click();await dialog.getByLabel("Event title").fill(changed);await dialog.getByRole("button",{name:"Save changes",exact:true}).click();
  await expect(dialog).toHaveCount(0);await reader.reload();
  const card=reader.locator("li").filter({hasText:changed});await expect(card.getByRole("button",{name:"Cancel RSVP",exact:true})).toBeVisible();await expect(card).toContainText("1 going");
  const event=(await(await reader.request.get("/api/events")).json()).find((e:{title:string})=>e.title===changed);
  expect((await reader.request.patch("/api/events",{data:{action:"update",id:event.id,expectedUpdatedAt:event.updatedAt,title:"Not mine",category:"social",startsAt:"2026-12-30T17:00"}})).status()).toBe(403);
  expect((await page.request.patch("/api/events",{data:{action:"update",id:event.id,expectedUpdatedAt:event.createdAt,title:"Stale",category:"social",startsAt:"2026-12-30T17:00"}})).status()).toBe(409);
  await page.getByRole("button",{name:`Edit ${changed}`,exact:true}).click();page.once("dialog",d=>d.accept());await dialog.getByRole("button",{name:"Cancel event",exact:true}).click();
  await expect(dialog).toHaveCount(0);await reader.reload();await expect(card.getByRole("button",{name:"Cancelled",exact:true})).toBeDisabled();
  expect((await reader.request.patch("/api/events",{data:{eventId:event.id,going:true}})).status()).toBe(409);
  expect((await(await reader.request.get("/api/notifications")).json()).items).toEqual(expect.arrayContaining([expect.objectContaining({title:`Cancelled: ${changed}`})]));
  await ctx.close();
});

test("same-route event notifications load the target omitted from the initial list",async({page})=>{
  const base={body:"Details",category:"company",startsAt:"2026-12-30T12:00:00.000Z",location:"Studio",createdAt:"2026-10-27T00:00:00.000Z",going:0,mine:false,canManage:false};
  const first={...base,id:"first-event",title:"Initial event"},target={...base,id:"older-target",title:"Notification target event"};let targetReads=0;
  await page.route("**/api/events*",async route=>{const url=new URL(route.request().url());const focused=url.searchParams.get("event");if(focused)targetReads++;await route.fulfill({json:focused?[target]:[first]});});
  await page.route("**/api/notifications",async route=>{await route.fulfill({json:route.request().method()==="POST"?{ok:true}:{items:[{id:"event-target",kind:"event",title:"Open target event",body:"Updated event",at:new Date().toISOString(),href:"/events?event=older-target#event-older-target"}],unread:1}});});
  await signInEmployee(page,uniqueEmail("event-link"),"/events");await expect(page.getByRole("heading",{name:"Initial event",exact:true})).toBeVisible();
  await page.getByRole("button",{name:/^Notifications/}).click();await page.getByRole("link").filter({hasText:"Open target event"}).click();
  await expect(page.getByRole("heading",{name:"Notification target event",exact:true})).toBeVisible();expect(targetReads).toBeGreaterThan(0);
  await page.goBack();await expect(page.getByRole("heading",{name:"Notification target event",exact:true})).toHaveCount(0);
  await page.goForward();await expect(page.getByRole("heading",{name:"Notification target event",exact:true})).toBeVisible();
});

test("the pass shows recorded attendance counts and links each day to its record",async({page,isMobile})=>{
  const {signInOffice}=await import("./fixtures");await signInOffice(page,uniqueEmail("pass-record"));
  const {today}=await(await page.request.get("/api/workspace")).json();
  await page.reload();
  if(isMobile){
    await page.getByRole("button",{name:"Flip workspace pass",exact:true}).click();
    const back=page.locator('.phone-id-back[aria-hidden="false"]');await expect(back.getByRole("button",{name:/In office/})).toHaveCount(1);
  }else{
    await page.getByRole("button",{name:"Flip ID card",exact:true}).click();
    const back=page.locator('.face-back[aria-hidden="false"]');await expect(back.locator(".chip-office .cb-chip-count")).toHaveText("1");await expect(back.locator(".chip-sick .cb-chip-count")).toHaveText("0");
    await back.getByRole("link",{name:`View attendance for ${today}`,exact:true}).click();await expect(page).toHaveURL(new RegExp(`tab=calendar&date=${today}`));
  }
});

test("removing a public board post requires a deliberate confirmation",async({page,isMobile})=>{
  const {uniqueText}=await import("./fixtures");await signInEmployee(page,"admin@innovinlabs.com","/");if(isMobile)await page.getByRole("button",{name:"Office Notice Board",exact:true}).click();
  await page.getByRole("button",{name:"Post Note",exact:true}).click();const text=uniqueText("Removal confirmation");await page.getByLabel("Your board note").fill(text);await page.getByRole("button",{name:"Pin to board",exact:true}).click();
  const card=page.getByRole("article").filter({hasText:text});await expect(card).toBeVisible();page.once("dialog",d=>d.dismiss());await card.getByRole("button",{name:"Remove board note",exact:true}).click();await expect(card).toBeVisible();
  page.once("dialog",d=>d.accept());await card.getByRole("button",{name:"Remove board note",exact:true}).click();await expect(card).toHaveCount(0);
});

test("saving fitness history cannot swallow the separate Save balances action",async({page})=>{
  const email=uniqueEmail(`independent-admin-saves-${Date.now()}`);await signInEmployee(page,email,"/");
  const {name}=await(await page.request.get("/api/auth/me")).json();await adminLogin(page,"people");
  await page.getByRole("searchbox",{name:"Search people",exact:true}).fill(name);await page.getByRole("button",{name:`Edit balances for ${name}`,exact:true}).click();
  let release!:()=>void,arrived!:()=>void;const held=new Promise<void>(r=>release=r),started=new Promise<void>(r=>arrived=r);
  await page.route("**/api/people",async route=>{if(route.request().method()==="PATCH"&&route.request().postDataJSON()?.stepsOffset!==undefined){arrived();await held;}await route.continue();});
  await page.getByLabel(`Fitness history: prior 10k+ days for ${name}`).fill("12");await page.getByLabel(`Fitness history: prior 10k+ days for ${name}`).press("Tab");await started;
  const save=page.getByRole("button",{name:"Save balances",exact:true});await expect(save).toBeEnabled();await save.click();await expect(page.getByText("Leave balances saved",{exact:true})).toBeVisible();
  release();await expect(page.getByText("Fitness history saved separately",{exact:true})).toBeVisible();
  await page.reload();await page.getByRole("searchbox",{name:"Search people",exact:true}).fill(name);await page.getByRole("button",{name:`Edit balances for ${name}`,exact:true}).click();
  await expect(page.getByLabel(`Fitness history: prior 10k+ days for ${name}`)).toHaveValue("12");
});


test("a populated board scrolls without squeezing text out of its note cards",async({page,isMobile})=>{
  const {uniqueText}=await import("./fixtures");const title=uniqueText("Read the complete note");await signInEmployee(page,uniqueEmail("board-reading"),"/");
  for(let i=0;i<4;i++)expect((await page.request.post("/api/notices",{data:{kind:"quote",body:uniqueText("A readable team note with enough detail to explain the whole idea. ".repeat(5)),title,color:"blue",anonymous:false}})).ok()).toBe(true);
  await page.reload();if(isMobile)await page.getByRole("button",{name:"Office Notice Board",exact:true}).click();
  const board=page.getByRole("region",{name:"Office Notice Board",exact:true});await expect(board.getByRole("article").filter({hasText:title})).toHaveCount(4);
  for(const card of await board.getByRole("article").all())expect(await card.evaluate(el=>el.scrollHeight<=el.clientHeight+1),"note content remains inside its card").toBe(true);
  if(!isMobile){expect((await board.boundingBox())!.height).toBeLessThanOrEqual(360);expect(await board.locator(".notice-board-canvas").evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);}
});
