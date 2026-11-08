import {test,expect,type Page} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {createPinLoginHandle} from '../src/lib/server/pinLoginHandle';
import {prepareGeneratedSeed,type FlowCase} from './generated/_harness';
import {generatedFlowRuntime} from './generated/_model';

const database=process.env.DATABASE_URL??'';
if(new URL(database).hostname!=='127.0.0.1'||process.env.KREILE_GENERATED_REPLAY!=='1')throw Error('QUOTE_UI_TEST_REQUIRES_ISOLATED_REPLAY');
const sql=postgres(database,{max:1});
test.afterAll(async()=>sql.end());

async function action(page:Page,name:string,input:unknown){
 const production=path.resolve('.next/server/server-reference-manifest.json');
 const manifest=JSON.parse(readFileSync(existsSync(production)?production:path.resolve('.next/dev/server/server-reference-manifest.json'),'utf8')) as {node:Record<string,{workers:Record<string,{exportedName?:string;filename?:string}>}>};
 const candidates=Object.entries(manifest.node).filter(([,entry])=>Object.values(entry.workers).some(worker=>worker.filename==='src/app/actions/quotes.actions.ts'&&worker.exportedName===name));
 expect(candidates).toHaveLength(1);
 const response=await page.evaluate(async({id,input})=>{const response=await fetch('/',{method:'POST',headers:{'Next-Action':id,'Content-Type':'text/plain;charset=UTF-8',Accept:'text/x-component'},body:JSON.stringify([input])});return {status:response.status,text:await response.text()};},{id:candidates[0][0],input});
 expect(response.status).toBe(200);
 for(const line of response.text.split('\n')){try{const value=JSON.parse(line.slice(line.indexOf(':')+1));if(value&&typeof value==='object'&&'code'in value){expect(value.code,JSON.stringify(value)).toBe('OK');return;}}catch(error){if(error instanceof SyntaxError)continue;throw error;}}
 throw Error('QUOTE_UI_ACTION_RESULT_MISSING');
}

test('fixed quote overlay: real read, one telephone acceptance, DB/event/readback and no premature order',async({page})=>{
 await prepareGeneratedSeed({id:'KV-UI-TELEFON',gegeben:{login:'login_meister',datenlagen:['kunde_vollstaendig_firma'],aufruf:{seite:'nachrichten',weg:'oeffne'}}} as FlowCase);
 await page.setViewportSize({width:1220,height:880});
 await page.goto('/start');
 const actor=generatedFlowRuntime.logins.login_meister;
 await page.getByTestId('pin-user-card-'+createPinLoginHandle(actor.id)).click();
 const keypad=page.locator('[data-spec-id="login.anmelden"]');
 const navigation=page.waitForURL(url=>url.pathname!=='/start');
 for(const digit of actor.pin)await keypad.getByRole('button',{name:digit,exact:true}).click();
 await navigation;await page.goto('/orders');
 const customer=generatedFlowRuntime.datenlagen.kunde_vollstaendig_firma.id;
 const key=randomUUID();
 await action(page,'createQuoteAction',{clientEventId:key,customerId:customer,dueDate:'2026-12-01',note:'TEST UI Originalteile erhalten',calculation:{hours:'4',hourlyRateCents:1000,setupCents:0,materialCents:0},positions:[{name:'TEST UI Halter',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000}]});
 const [created]=await sql<{quote_id:string}[]>`SELECT quote_id::text FROM private.quote_create_receipts WHERE tenant_id='galvanik-kreile' AND client_event_id=${key}::uuid`;
 expect(created).toBeDefined();const quoteId=created.quote_id;
 await action(page,'changeQuoteLifecycleAction',{quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,action:'sent',channel:'druck',evidence:'TEST KV am Telefonlauf ausgegeben'});
 await page.evaluate(id=>window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'kv',arg:id}})),quoteId);
 const dialog=page.getByRole('dialog',{name:/KV-2026-/});await expect(dialog).toBeVisible();
 await expect(dialog.getByText('40,00 € netto')).toBeVisible();await expect(dialog.getByRole('textbox')).toHaveCount(0);
 await dialog.screenshot({path:path.join(process.env.TEMP??'.','kreile-kv-ui-real-desktop.png')});
 await dialog.getByRole('button',{name:/hat am Telefon zugesagt/}).click();
 await expect(dialog.getByText('Zusage gespeichert · Ware erwartet.')).toBeVisible();
 const [stored]=await sql`SELECT q.version,q.fassung,q.zugesagt_fassung,q.linked_order_id,(SELECT count(*)::int FROM public.events e WHERE e.tenant_id=q.tenant_id AND e.payload->>'quoteId'=q.id::text AND e.event_type='QUOTE_LIFECYCLE_V04' AND e.payload->>'action'='accept') AS accept_events FROM private.quotes q WHERE q.tenant_id='galvanik-kreile' AND q.id=${quoteId}::uuid`;
 expect(stored).toMatchObject({version:3,fassung:1,zugesagt_fassung:1,linked_order_id:null,accept_events:1});
 await expect(dialog.getByText(/hat am .* zugesagt\./)).toBeVisible();
 await page.setViewportSize({width:390,height:844});await dialog.screenshot({path:path.join(process.env.TEMP??'.','kreile-kv-ui-real-mobile.png')});
});
