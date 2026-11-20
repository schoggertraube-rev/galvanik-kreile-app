// @vitest-environment node
// TEST infrastructure only: real browser HTTP request + real own Loopback DB
// locks. No App/Auth claim, no reset/TRUNCATE/row writes or replacement service.
import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import postgres from 'postgres';
import {chromium,type Browser,type Page} from 'playwright';
import {lockFixtureResetTables,settleFixtureReads} from '../../../e2e/generated/_fixtureReset';

it('waits for a real outstanding read to release its DB lock before the unchanged NOWAIT fixture lock',async()=>{
 const url=process.env.DATABASE_URL;
 if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL)throw Error('TEST_OWN_REPLAY_URL_REQUIRED');
 const target=new URL(url);
 // Existing CI Replay54322 and the explicitly matched own working Replay54342.
 if(target.hostname!=='127.0.0.1'||!['54322','54342'].includes(target.port)||target.pathname!=='/postgres'||target.username!=='postgres')throw Error('TEST_OWN_REPLAY_LOOPBACK_REQUIRED');
 const sql=postgres(url,{max:2,prepare:false});
 let release!:()=>void,entered!:()=>void,readFailed!:(error:unknown)=>void;
 let failSafe:ReturnType<typeof setTimeout>|undefined;
 const gate=new Promise<void>(resolve=>{release=resolve;}),reading=new Promise<void>((resolve,reject)=>{entered=resolve;readFailed=reject;});
 const server=createServer((request,response)=>{
  if(request.url==='/TEST/read'){
   void sql.begin(async tx=>{await tx.unsafe('LOCK TABLE public.events IN ACCESS SHARE MODE');failSafe=setTimeout(release,5000);entered();await gate;})
    .then(()=>response.writeHead(200,{'content-type':'text/plain'}).end('TEST read committed'),error=>{readFailed(error);response.writeHead(500).end('TEST read failed');});
   return;
  }
  response.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end('<!doctype html><title>TEST fixture drain</title><script>fetch("/TEST/read").then(r=>r.text()).then(text=>document.body.textContent=text)</script><body>TEST read pending</body>');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK_LISTENER_REQUIRED');
 let browser:Browser|undefined,page:Page|undefined;
 // A regressed lock guard still cannot leave this read held indefinitely.
 try{
  browser=await chromium.launch({headless:true});page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+address.port+'/TEST');await reading;
  await expect(sql.begin(tx=>lockFixtureResetTables(tx,[{schema:'public',name:'events'}]))).rejects.toMatchObject({code:'55P03'});
  const drained=settleFixtureReads(page);
  const resume=setTimeout(release,50);
  try{
   await drained;
   await sql.begin(tx=>lockFixtureResetTables(tx,[{schema:'public',name:'events'}]));
   expect(await page.locator('body').textContent()).toBe('TEST read committed');
  }finally{clearTimeout(resume);}
 }finally{
  release();if(failSafe)clearTimeout(failSafe);await page?.close();await browser?.close();
  await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await sql.end();
 }
},60000);
