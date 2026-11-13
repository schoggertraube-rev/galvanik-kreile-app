// Actual Next/Auth/DB page. The injected tenant constant is a TEST fixture,
// not an alternate auth path. No offline reload/real24h/hardware claim.
import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {connect} from 'node:net';
const tenant=process.env.KREILE_SMOKE_TENANT,actor=process.env.KREILE_SMOKE_ACTOR;
test.skip(process.env.KREILE_OFFLINE_SMOKE!=='1','Explicit own Loopback TEST server required');
async function control(command:'online'|'offline'|'failures'|'paths'){
 if(!process.env.KREILE_SMOKE_CONTROL_PIPE)throw Error('TEST_SMOKE_CONTROL_REQUIRED');
 return await new Promise<string>((resolve,reject)=>{const socket=connect(process.env.KREILE_SMOKE_CONTROL_PIPE!);let reply='';socket.setEncoding('utf8');socket.once('connect',()=>socket.write(command));socket.on('data',part=>{reply+=part;});socket.once('end',()=>{socket.destroy();resolve(reply);});socket.once('error',error=>{socket.destroy();reject(error);});});
}
test.afterEach(async({page,context})=>{
 // Restore only this case's controlled faults before disposing the real
 // browser. In particular WebKit must not close with its native IDB getter replaced.
 await control('online');
 if(!page.isClosed())await page.evaluate(()=>{const target=window as unknown as {TESTidb?:PropertyDescriptor|null};if('TESTidb' in target){if(target.TESTidb)Object.defineProperty(window,'indexedDB',target.TESTidb);else Reflect.deleteProperty(window,'indexedDB');delete target.TESTidb;}});
 await context.unroute('http://localhost:3001/**');await context.setOffline(false);
});
test('U292 actual app stand, offline line and evicted-storage rejection',async({page,context})=>{
 await control('online');
 if(!tenant?.startsWith('TEST-ablauf-')||!actor||!process.env.APP_SESSION_SECRET)throw Error('OFFLINE_SMOKE_TEST_IDENTITY');
 const require=createRequire(path.resolve('package.json')),{signAppSession,COOKIE_NAME,CACHE_SCOPE_COOKIE,cacheScopeFromCredential,offlinePartition}=require(path.resolve('.git/kreile-s06-smoke-session.cjs'));
 const scope=offlinePartition({tenantId:tenant,userId:actor});
 const token=signAppSession({userId:actor,tenantId:tenant,role:'meister',displayName:'TEST Offline Smoke',issuedAt:Date.now(),expiresAt:Date.now()+30*60_000},process.env.APP_SESSION_SECRET);
 const external:string[]=[];
 // Controlled denial of the platform capability; IDB itself remains native.
 await page.addInitScript(()=>{if(navigator.storage)Object.defineProperty(navigator.storage,'persist',{configurable:true,value:async()=>false});});
 await context.route(/^https?:/,async route=>{const host=new URL(route.request().url()).hostname;if(!['127.0.0.1','localhost'].includes(host)){external.push(host);await route.abort();}else await route.continue();});
 // Same two cookies as setAppSession: the readable credential projection is
 // required for caching, and grants no server authority of its own.
 await context.addCookies([{name:COOKIE_NAME,value:token,url:'http://localhost:3001',httpOnly:true,sameSite:'Lax'},{name:CACHE_SCOPE_COOKIE,value:cacheScopeFromCredential(token),url:'http://localhost:3001',httpOnly:false,sameSite:'Lax'}]);
 await page.goto('/customers');
 await page.evaluate(async()=>{const url='/__TEST/offline-probe.mjs',probe=await import(/* webpackIgnore: true */ url);(window as unknown as {TESToffline:unknown}).TESToffline=probe;});
 await expect.poll(()=>page.evaluate(async value=>{const p=(window as unknown as {TESToffline:{readDeviceStandResponse:(scope:string,enabled:boolean)=>Promise<{code:string}>}}).TESToffline;return(await p.readDeviceStandResponse(value,true)).code;},scope)).toBe('OK');
 const line=page.getByRole('status',{name:'Netzwerkstatus'});await expect(line).toContainText('Dieses Gerät kann Offline-Daten selbst löschen');
 // Playwright's filtered clearCookies clears ALL cookies before restoring
 // survivors. Preserve the native read marker while testing an invalid session.
 await context.addCookies([{name:COOKIE_NAME,value:'TEST-invalid-signature',url:'http://localhost:3001',httpOnly:true,sameSite:'Lax'}]);let denied:number;
 try{denied=await page.evaluate(async original=>{const response=await fetch('/api/offline/replay',{method:'POST',credentials:'omit',headers:{'content-type':'application/json'},body:JSON.stringify(original)});return response.status;},{scope,original:{kind:'workshop',command:'item.finished',id:actor,itemId:actor,deviceCapturedAt:new Date().toISOString(),input:{orderId:actor,itemId:actor,clientEventId:actor,expectedVersion:1,finished:true}}});}
 finally{await context.addCookies([{name:COOKIE_NAME,value:token,url:'http://localhost:3001',httpOnly:true,sameSite:'Lax'}]);}
 expect(denied).toBe(401);await expect(line).not.toContainText('Offline – Stand');
 let blockedCalls=0;
 await control('offline');
 await context.route('http://localhost:3001/**',async route=>{blockedCalls++;await route.abort();});
 expect(await page.evaluate(async()=>{let failed=false;try{await fetch('/api/offline/heartbeat',{cache:'no-store'});}catch{failed=true;}return {failed,online:navigator.onLine};})).toEqual({failed:true,online:true});
 await expect(line).toContainText('Offline – Stand');await expect(line).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new Event('kreile-sync-customers')));await expect(page.getByText('Noch keine Kunden.')).toBeVisible();
 await page.getByRole('button',{name:'Auftrag, Kunde oder Nummer suchen'}).click();await page.getByPlaceholder('Suchen oder tun').fill('TEST-offline-source');
 try{await expect(page.getByText(/Kein Treffer für.*durchsucht: Auftragsbestand, Kundenstamm/)).toBeVisible();}
 catch(error){
  console.log('TEST_SEARCH_REQUEST_PATHS',await control('paths'));
  console.log('TEST_SEARCH_DEVICE_DIAGNOSTIC',await page.evaluate(async value=>{
   const p=(window as unknown as {TESToffline:{readDeviceStandResponse:(scope:string,enabled:boolean)=>Promise<{code:string}>;readDevicePortResponse:(scope:string,enabled:boolean,target:{port:string;objectId:string})=>Promise<{code:string}>;searchDeviceStand:(scope:string,enabled:boolean,query:string)=>Promise<{code:string}>}}).TESToffline;
   const reads={stand:()=>p.readDeviceStandResponse(value,true),orders:()=>p.readDevicePortResponse(value,true,{port:'orders.list',objectId:'orders'}),customers:()=>p.readDevicePortResponse(value,true,{port:'customers.list',objectId:'customers'}),search:()=>p.searchDeviceStand(value,true,'TEST-offline-source')};
   return Object.fromEntries(await Promise.all(Object.entries(reads).map(async([key,read])=>[key,await Promise.race([read().then(result=>result.code),new Promise<string>(resolve=>setTimeout(()=>resolve('DIAGNOSTIC_PENDING'),1000))])])));
  },scope));throw error;
 }
 await page.keyboard.press('Escape');expect(blockedCalls+Number(await control('failures'))).toBe(1);
 await context.setOffline(true);
 const box=await line.boundingBox(),width=page.viewportSize()?.width;if(!box||!width)throw Error('OFFLINE_SMOKE_VISIBLE_BOX');expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
 await mkdir('_review/shots/S06',{recursive:true});await page.screenshot({path:`_review/shots/S06/U292-${test.info().project.name}-offline.png`});
 const empty=await page.evaluate(async value=>{const p=(window as unknown as {TESToffline:{readPendingEntries:(scope:string)=>Promise<unknown[]>}}).TESToffline;return(await p.readPendingEntries(value)).length;},scope);expect(empty).toBe(0);
 // Browser eviction is a controlled fault with no queued originals to erase.
 await page.evaluate(async value=>{await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase('kreile-pending-originals-v1-'+value);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('TEST_EVICTION_BLOCKED'));});window.dispatchEvent(new Event('kreile-device-stand-changed'));},scope);
 await expect(line).toContainText('Offline-Speicher auf diesem Gerät nicht verfügbar - Eingaben gehen nur mit Netz');
 const rejected=await page.evaluate(async({value,key,order,item})=>{const p=(window as unknown as {TESToffline:{capturePendingItemFinished:(scope:string,enabled:boolean,input:unknown)=>Promise<{code:string}>;readPendingEntries:(scope:string)=>Promise<unknown[]>}}).TESToffline;return{code:(await p.capturePendingItemFinished(value,true,{orderId:order,itemId:item,clientEventId:key,expectedVersion:1,finished:true})).code,count:(await p.readPendingEntries(value)).length};},{value:scope,key:randomUUID(),order:randomUUID(),item:randomUUID()});expect(rejected).toEqual({code:'NETWORK_REQUIRED',count:0});
 // A controlled browser-capability fault, not a replacement IDB implementation.
 await page.evaluate(()=>{(window as unknown as {TESTidb:PropertyDescriptor|null}).TESTidb=Object.getOwnPropertyDescriptor(window,'indexedDB')??null;Object.defineProperty(window,'indexedDB',{configurable:true,get(){throw new DOMException('TEST private storage unavailable','SecurityError');}});window.dispatchEvent(new Event('kreile-device-stand-changed'));});
 await expect(line).toContainText('Offline-Speicher auf diesem Gerät nicht verfügbar - Eingaben gehen nur mit Netz');
 const unavailable=await page.evaluate(async({value,key,order,item})=>{const p=(window as unknown as {TESToffline:{capturePendingItemFinished:(scope:string,enabled:boolean,input:unknown)=>Promise<{code:string}>}}).TESToffline;return(await p.capturePendingItemFinished(value,true,{orderId:order,itemId:item,clientEventId:key,expectedVersion:1,finished:true})).code;},{value:scope,key:randomUUID(),order:randomUUID(),item:randomUUID()});expect(unavailable).toBe('NETWORK_REQUIRED');
 await page.screenshot({path:`_review/shots/S06/U292-${test.info().project.name}-unavailable.png`});
 expect(external).toEqual([]);
 await control('online');
});
