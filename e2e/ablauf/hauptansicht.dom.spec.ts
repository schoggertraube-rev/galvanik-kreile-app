import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {runWithExpectedRed} from '../generated/_expectedRed';

const fixture=JSON.parse(readFileSync('.git/kreile-s14a-dom-fixture.json','utf8')) as {
 tenant:string;actors:Record<string,{actorId:string;actorIssuedAt:number;role:string}>;
 orderId:string;customerId:string;quoteId:string;
};
if(fixture.tenant!==process.env.KREILE_SMOKE_TENANT||!fixture.tenant.startsWith('TEST-ablauf-'))throw Error('S14A_FIXTURE_PROVENANCE');
const recording=process.env.KREILE_S14A_RECORD_BASIS==='1';
if(recording&&process.env.CI)throw Error('S14A_CI_CANNOT_RECORD_BASIS');
const basisPath='e2e/ablauf/_hauptansicht_basis.json';
const basis:Record<string,string[]>=recording?{}:JSON.parse(readFileSync(basisPath,'utf8'));
const red:Record<string,{paket:string;grund:string;erwarteterWert?:string;tatsaechlicherWertEnthaelt?:string}>=JSON.parse(readFileSync('e2e/ablauf/_erwartet_rot.json','utf8'));
const recorded:Record<string,string[]>={};
const areas=[
 {id:'auftrag',route:'/orders',target:'auftrag',key:'orderId'},
 {id:'kunde',route:'/customers',target:'kunde',key:'customerId'},
 {id:'kv',route:'/orders',target:'kv',key:'quoteId'},
 {id:'eingang',route:'/rein'}, {id:'nachrichten',route:'/nachrichten'},
 {id:'ausgang',route:'/orders?station=fertig'}, {id:'geld',route:'/buchhaltung/rechnungen'},
 {id:'tag',route:'/'}, {id:'werkstatt',route:'/warendurchlauf'},
] as const;

function erwarteteHauptansicht(ids: string[], role: string, area: string) {
 if(role==='werkstatt'){
  const plus=ids.indexOf('navigation.plus');
  if(plus<0)throw Error('S14A_U0_WERKSTATT_BASIS');
  const position=area==='tag'?ids.length:plus+1;
  return [...ids.slice(0,position),'navigation.tag','navigation.werkstatt','navigation.planung','navigation.auftraege',...ids.slice(position)];
 }
 const nav=ids.filter(id=>id.startsWith('navigation.')&&id!=='navigation.plus'&&id!=='navigation.kunden'&&id!=='navigation.nachrichten');
 const werkstatt=nav.indexOf('navigation.werkstatt');
 const start=ids.indexOf('navigation.tag');
 if(werkstatt<0||start<0)throw Error('S14A_U0_NAVIGATION_BASIS');
 nav.splice(werkstatt+1,0,'navigation.planung','navigation.nachrichten');
 const inhalt=ids.slice(start).filter(id=>!id.startsWith('navigation.'));
 // Diese beiden Ansichten setzen den sichtbaren Inhalt vor die Seitenleiste.
 return area==='tag'||area==='nachrichten'
  ? [...ids.slice(0,start),...inhalt,...nav]
  : [...ids.slice(0,start),...nav,...inhalt];
}

test.afterAll(()=>{
 if(recording){
  if(Object.keys(recorded).length!==27)throw Error('S14A_INCOMPLETE_BASIS');
  writeFileSync(basisPath,JSON.stringify(recorded,null,2)+'\n');
 }
});
for(const role of ['meister','werkstatt','admin'])for(const area of areas){
 const id=`DOM-${role}-${area.id}`;
 test(id,async({page,context})=>runWithExpectedRed(id,red[id],async()=>{
  const actor=fixture.actors[role];
  if(!actor||!process.env.APP_SESSION_SECRET)throw Error('S14A_REAL_ACTOR_REQUIRED');
  const require=createRequire(path.resolve('package.json'));
  const {signAppSession,COOKIE_NAME,CACHE_SCOPE_COOKIE,cacheScopeFromCredential}=require(path.resolve('.git/kreile-s06-smoke-session.cjs'));
  const token=signAppSession({userId:actor.actorId,tenantId:fixture.tenant,role:actor.role,displayName:'TEST Mail Import',issuedAt:actor.actorIssuedAt,expiresAt:Date.now()+30*60_000},process.env.APP_SESSION_SECRET);
  await context.addCookies([{name:COOKIE_NAME,value:token,url:'http://localhost:3001',httpOnly:true,sameSite:'Lax'},{name:CACHE_SCOPE_COOKIE,value:cacheScopeFromCredential(token),url:'http://localhost:3001',sameSite:'Lax'}]);
  const errors:string[]=[];
  page.on('pageerror',error=>{
   errors.push(error.message);
   console.error('S14A_PAGE_ERROR_DIAGNOSTIC',JSON.stringify({id,name:error.name,message:error.message,stack:error.stack}));
  });
  page.on('response',response=>{if(response.status()>=500)errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);});
  const response=await page.goto(area.route);
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('data-auth-status','authenticated');
  await page.waitForLoadState('networkidle');
  if('target' in area){
   if(area.target==='kunde'){
    await page.locator(`[data-customer-id="${fixture.customerId}"]`).getByRole('button').first().click();
   }else{
    // An unhandled event has no effect. Wait for the existing hydrated
    // navigation listener; stop after its first actual, handled opening.
    await expect.poll(()=>page.evaluate(({target,arg})=>!window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:target,arg}})),{target:area.target,arg:fixture[area.key]})).toBe(true);
   }
   await expect(page.getByRole('dialog').last()).toBeVisible();
   await page.waitForLoadState('networkidle');
   // A loading scaffold is not the area's main view. Wait for the existing
   // domain reader's rendered result before recording any DOM baseline.
   if(area.target==='auftrag')await page.locator('[data-spec-id="auftrag"]').waitFor({state:'attached'});
   if(area.target==='kunde')await page.getByRole('dialog',{name:/^Kundenkarte .+/}).waitFor({state:'visible'});
   if(area.target==='kv')await page.waitForFunction(()=>{
    const dialog=[...document.querySelectorAll('[role="dialog"]')].at(-1);
    return dialog!==undefined&&dialog.getAttribute('aria-label')!=='KV wird geladen …';
   });
  }
  if(area.id==='eingang')await page.locator('[data-spec-id="rein"]').waitFor({state:'visible'});
  await page.waitForLoadState('networkidle');
  const visible=page.locator('[data-spec-id]:visible');
  const ids=await visible.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-spec-id')!));
  expect(errors).toEqual([]);
  // A missing basis entry is a hard failure, never an empty fallback.
  if(recording)recorded[id]=ids;
  else {expect(Object.hasOwn(basis,id)).toBe(true);expect(ids).toEqual(erwarteteHauptansicht(basis[id],role,area.id));}
 }));
}
