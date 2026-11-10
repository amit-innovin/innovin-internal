import {test,expect,signInEmployee,uniqueEmail} from "./fixtures";
test("top-button destinations retain a compact mobile workspace instead of wrapping desktop navigation",async({page,isMobile})=>{
 test.skip(!isMobile,"Mobile shell regression");await signInEmployee(page,uniqueEmail("mobile-shell"),"/");
 await page.getByRole("link",{name:"Attendance & Leave",exact:true}).click();
 for(const path of ["/attendance?tab=leave","/settings","/wifi","/help","/events"]){
  await page.waitForLoadState("networkidle");await page.goto(path);const bar=page.locator(".studio-nav");await expect(bar).toBeVisible();
  expect((await bar.boundingBox())!.height,"mobile toolbar stays one row").toBeLessThanOrEqual(80);
  await expect(page.getByRole("navigation",{name:"Workspace navigation",exact:true})).not.toBeVisible();
  await expect(page.getByRole("link",{name:"Innovin Internal home",exact:true})).toBeVisible();
  await page.locator(".reference-more summary").click();await expect(page.getByRole("navigation",{name:"More workspace tools"})).toBeVisible();
  await page.getByRole("navigation",{name:"More workspace tools"}).getByRole("link",{name:"Speak Up",exact:true}).click();await expect(page).toHaveURL(/\/grievances$/);
  await page.waitForLoadState("networkidle");await page.goto(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.screenshot({path:test.info().outputPath("mobile-route-shell.png"),fullPage:true,animations:"disabled"});
});
