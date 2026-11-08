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

async function action(page:Page,name:string,input:unknown,filename='src/app/actions/quotes.actions.ts'){
 const production=path.resolve('.next/server/server-reference-manifest.json');
 const manifest=JSON.parse(readFileSync(existsSync(production)?production:path.resolve('.next/dev/server/server-reference-manifest.json'),'utf8')) as {node:Record<string,{workers:Record<string,{exportedName?:string;filename?:string}>}>};
 const candidates=Object.entries(manifest.node).filter(([,entry])=>Object.values(entry.workers).some(worker=>worker.filename===filename&&worker.exportedName===name));
 expect(candidates).toHaveLength(1);
 const response=await page.evaluate(async({id,input})=>{const response=await fetch('/',{method:'POST',headers:{'Next-Action':id,'Content-Type':'text/plain;charset=UTF-8',Accept:'text/x-component'},body:JSON.stringify([input])});return {status:response.status,text:await response.text()};},{id:candidates[0][0],input});
 expect(response.status).toBe(200);
 for(const line of response.text.split('\n')){try{const value=JSON.parse(line.slice(line.indexOf(':')+1));if(value&&typeof value==='object'&&'code'in value){expect(value.code,JSON.stringify(value)).toBe('OK');return value;}}catch(error){if(error instanceof SyntaxError)continue;throw error;}}
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
 const itemId=randomUUID();
 await action(page,'saveIntakeNoteAction',{itemId,textstand:randomUUID(),text:'TEST Schmidt, 4 Halter verchromen, KV in zwei Wochen. Originalteile bitte erhalten.',context:{customerId:customer},concerns:['aufgabe']},'src/app/actions/eingang.actions.ts');
 const [captured]=await sql<{version:number}[]>`SELECT version FROM public.intake_item WHERE tenant_id='galvanik-kreile' AND id=${itemId}::uuid`;
 await action(page,'selectIntakeConcernAction',{itemId,version:captured.version,clientEventId:randomUUID(),concern:'kv_anfrage'},'src/app/actions/eingang.actions.ts');
 const [chosen]=await sql<{version:number}[]>`SELECT version FROM public.intake_item WHERE tenant_id='galvanik-kreile' AND id=${itemId}::uuid`;
 const key=randomUUID();
 await action(page,'createQuoteAction',{clientEventId:key,customerId:customer,source:{itemId,version:chosen.version,message:false},dueDate:'2026-12-01',note:'TEST UI Originalteile erhalten',calculation:{hours:'4',hourlyRateCents:1000,setupCents:0,materialCents:0},positions:[{name:'TEST UI Halter',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000}]});
 const [created]=await sql<{quote_id:string}[]>`SELECT quote_id::text FROM private.quote_create_receipts WHERE tenant_id='galvanik-kreile' AND client_event_id=${key}::uuid`;
 expect(created).toBeDefined();const quoteId=created.quote_id;
 await action(page,'changeQuoteLifecycleAction',{quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,action:'sent',channel:'druck',evidence:'TEST KV am Telefonlauf ausgegeben'});
 await page.goto('/nachrichten');
 await page.getByRole('tab',{name:'Anliegen',exact:true}).click();
 await page.getByRole('button',{name:'KV öffnen',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:/KV-2026-/});await expect(dialog).toBeVisible();
 await expect(dialog.getByText('40,00 € netto')).toBeVisible();await expect(dialog.getByRole('textbox')).toHaveCount(0);
 await dialog.getByRole('button',{name:'KV per E-Mail senden',exact:true}).click();
 await expect(dialog.getByLabel('Betreff',{exact:true})).toHaveValue(/KV-2026-/);
 await dialog.getByRole('button',{name:'Betreff und Nachricht ergänzen',exact:true}).click();
 await expect(dialog.getByRole('textbox',{name:'Nachricht',exact:true})).toBeFocused();
 await dialog.getByRole('textbox',{name:'Nachricht',exact:true}).fill('TEST Mailentwurf bleibt bis zur ausdruecklichen Entscheidung erhalten');
 await dialog.getByRole('button',{name:'Zurück',exact:true}).click();
 await page.getByRole('button',{name:'Weiter bearbeiten',exact:true}).click();
 await expect(dialog.getByRole('textbox',{name:'Nachricht',exact:true})).toHaveValue('TEST Mailentwurf bleibt bis zur ausdruecklichen Entscheidung erhalten');
 await dialog.getByRole('button',{name:'Zurück',exact:true}).click();await page.getByRole('button',{name:'Verwerfen',exact:true}).click();
 await expect(dialog).toHaveCount(0);await page.evaluate(id=>window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'kv',arg:id}})),quoteId);
 await expect(dialog.getByRole('textbox')).toHaveCount(0);

 await dialog.screenshot({path:path.join(process.env.TEMP??'.','kreile-kv-ui-real-desktop.png')});
 await dialog.getByRole('button',{name:/hat am Telefon zugesagt/}).click();
 await expect(dialog.getByText('Zusage gespeichert · Ware erwartet.')).toBeVisible();
 const [stored]=await sql`SELECT q.version,q.quote_number,q.fassung,q.zugesagt_fassung,q.linked_order_id,(SELECT count(*)::int FROM public.events e WHERE e.tenant_id=q.tenant_id AND e.payload->>'quoteId'=q.id::text AND e.event_type='QUOTE_LIFECYCLE_V04' AND e.payload->>'action'='accept') AS accept_events FROM private.quotes q WHERE q.tenant_id='galvanik-kreile' AND q.id=${quoteId}::uuid`;
 expect(stored).toMatchObject({version:3,fassung:1,zugesagt_fassung:1,linked_order_id:null,accept_events:1});
 await expect(dialog.getByText(/hat am .* zugesagt\./)).toBeVisible();
 await page.setViewportSize({width:390,height:844});await dialog.screenshot({path:path.join(process.env.TEMP??'.','kreile-kv-ui-real-mobile.png')});
 await dialog.getByRole('button',{name:'Zurück',exact:true}).click();
 await page.goto('/warendurchlauf');
 const workshopQuotes=page.getByRole('region',{name:'KV-Ware',exact:true});
 await workshopQuotes.getByRole('button',{name:/Ware erwartet ·/}).click();
 await expect(workshopQuotes.getByRole('heading',{name:stored.quote_number+' · Prueffirma Alpha GmbH',exact:true})).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('path1:global-create-open',{detail:'DIRECT_INTAKE'})));
 const intake=page.getByRole('dialog',{name:'Neuer Eingang',exact:true});await expect(intake).toBeVisible();
 const situationText='TEST Situation '+randomUUID()+' bitte Original erhalten';
 await intake.getByRole('textbox',{name:'Notiz',exact:true}).fill(situationText);
 await intake.getByRole('button',{name:'Lesen',exact:true}).click({timeout:25000});
 await expect(intake.getByRole('button',{name:'Lesen',exact:true})).toBeEnabled({timeout:20000});
 const situation=intake.locator('[data-spec-id="rein.situation"]');await expect(situation).toHaveCount(0);
 await expect(intake.getByRole('textbox',{name:'Notiz',exact:true})).toBeVisible();
 await expect(intake.getByRole('button',{name:'Auftrag erfassen',exact:true})).toHaveCount(0);
 const [note]=await sql`SELECT item.id,item.version,(SELECT count(*)::int FROM public.intake_event e WHERE e.tenant_id=item.tenant_id AND e.item_id=item.id AND e.von=${actor.id}) AS actor_events FROM public.intake_item item WHERE item.tenant_id='galvanik-kreile' AND item.text=${situationText}`;
 expect(note).toBeDefined();expect(note.version).toBeGreaterThan(0);expect(note.actor_events).toBeGreaterThan(0);
 await intake.locator('input[type="file"]').setInputFiles({name:'TEST-situation-original.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')});
 await expect(situation).toBeVisible({timeout:20000});
 await expect(intake.getByRole('textbox',{name:'Notiz',exact:true})).toHaveCount(0);
 await expect(situation.getByText('Kunde noch offen')).toHaveCount(0);
 await expect(situation.getByText('0 Originale gesichert')).toHaveCount(0);
 await page.setViewportSize({width:1220,height:880});await intake.screenshot({path:path.join(process.env.TEMP??'.','kreile-kv-situation-desktop.png')});
 await page.setViewportSize({width:390,height:844});await intake.screenshot({path:path.join(process.env.TEMP??'.','kreile-kv-situation-mobile.png')});
 await situation.getByRole('button',{name:'Aufgabe anlegen',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Aufgabe',exact:true})).toBeVisible();

});

for(const storedGoods of [false,true,'operational'] as const) test('quote goods '+(storedGoods==='operational'?'operational':storedGoods?'stored':'direct')+': actual photos and one atomic telephone conversion with server quantity price',async({page})=>{
 await prepareGeneratedSeed({id:'KV-UI-GOODS',gegeben:{login:'login_meister',datenlagen:['kunde_vollstaendig_firma'],aufruf:{seite:'nachrichten',weg:'oeffne'}}} as FlowCase);
 await page.setViewportSize({width:1220,height:880});await page.goto('/start');
 const actor=generatedFlowRuntime.logins.login_meister;
 await page.getByTestId('pin-user-card-'+createPinLoginHandle(actor.id)).click();
 const keypad=page.locator('[data-spec-id="login.anmelden"]'),navigation=page.waitForURL(url=>url.pathname!=='/start');
 for(const digit of actor.pin)await keypad.getByRole('button',{name:digit,exact:true}).click();await navigation;await page.goto('/orders');
 const customer=generatedFlowRuntime.datenlagen.kunde_vollstaendig_firma.id;
 await action(page,'updateCustomerAction',{customerId:customer,clientEventId:randomUUID(),handoverPreference:'pickup',paymentPreference:'bar'},'src/app/actions/customers.actions.ts');
 const createId=randomUUID();
 await action(page,'createQuoteAction',{clientEventId:createId,customerId:customer,dueDate:'2026-12-01',note:'TEST UI atomare Telefonannahme',calculation:{hours:'4',hourlyRateCents:1000,setupCents:1200,materialCents:900},positions:[{name:'TEST UI Halter',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:1525}]});
 const [created]=await sql<{quote_id:string}[]>`SELECT quote_id::text FROM private.quote_create_receipts WHERE tenant_id='galvanik-kreile' AND client_event_id=${createId}::uuid`;
 const quoteId=created.quote_id;
 await action(page,'changeQuoteLifecycleAction',{quoteId,clientEventId:randomUUID(),expectedVersion:1,edition:1,action:'sent',channel:'druck',evidence:'TEST KV tatsaechlich ausgedruckt'});
 await page.evaluate(id=>window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'kv',arg:id}})),quoteId);
 const card=page.getByRole('dialog',{name:/KV-2026-/});
 await card.getByRole('button',{name:'Prueffirma Alpha GmbH',exact:true}).click();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('path1:global-create-open',{detail:'DIRECT_INTAKE'})));
 const capture=page.getByRole('dialog',{name:'Neuer Eingang',exact:true});await expect(capture).toBeVisible();
 await expect(capture.locator('[data-spec-id="rein.kontext-entfernen"]')).toBeVisible();
 await capture.getByRole('textbox',{name:'Notiz',exact:true}).fill('DHL Absender Prueffirma Alpha GmbH · TEST 3 Halter angekommen');
 await capture.getByRole('button',{name:'Lesen',exact:true}).click();
 const quoteChoice=capture.getByRole('group',{name:'Passende Vorgänge'});
 await expect(quoteChoice.getByText('Offener KV dieses Kunden · Zusage fehlt')).toBeVisible({timeout:15000});
 await quoteChoice.getByRole('button',{name:'Paket kommt an',exact:true}).click();
 await expect(capture).toHaveCount(0);

 const receipt=page.getByRole('dialog',{name:/Ware zu KV-2026-.* prüfen/});await expect(receipt).toBeVisible();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
 await receipt.locator('label').filter({hasText:'Paketetikett fotografieren'}).click();
 await expect(receipt.getByRole('img',{name:'QR-Code für Fotos mit Tablet/Handy',exact:true})).toBeVisible();
 const handoff=await receipt.getByRole('link',{name:'Fotos für den PC öffnen',exact:true}).getAttribute('href');
 expect(handoff).toBeTruthy();
 const receiver=await page.context().newPage();await receiver.setViewportSize({width:390,height:844});await receiver.goto(handoff!);
 const camera=receiver.getByRole('dialog',{name:'Neuer Eingang',exact:true});await expect(camera).toBeVisible();
 await expect(camera.getByText('Foto-Anfrage konnte nicht geöffnet werden. Code: INTAKE_HANDOVER_ACCEPT_FAILED.')).toHaveCount(0);
 await expect(camera.getByText('0 an den PC gesendet',{exact:true})).toBeVisible();
 await camera.locator('input[type="file"]').setInputFiles([{name:'TEST-Handy-Etikett.png',mimeType:'image/png',buffer:png},{name:'TEST-Handy-Inhalt.png',mimeType:'image/png',buffer:png}]);
 await expect(receipt.getByText('2 Fotos am Eingang',{exact:true})).toBeVisible({timeout:20000});
 await receipt.getByRole('button',{name:'Fotos übernehmen',exact:true}).click();await receiver.close();
 await expect(receipt.getByRole('img',{name:'QR-Code für Fotos mit Tablet/Handy',exact:true})).toHaveCount(0);
 const original=receipt.locator('input[type="file"]').nth(0),content=receipt.locator('input[type="file"]').nth(1);
 await original.setInputFiles({name:'TEST-Etikett.png',mimeType:'image/png',buffer:png});
 await expect(receipt.getByRole('img',{name:'Paketetikett',exact:true})).toBeVisible({timeout:20000});
 await content.setInputFiles({name:'TEST-Inhalt.png',mimeType:'image/png',buffer:png});
 await expect(receipt.getByRole('img',{name:'Inhaltsfoto',exact:true})).toBeVisible({timeout:20000});
 await receipt.getByLabel('Angekommen · TEST UI Halter (KV: 4)',{exact:true}).fill('3');
 await receipt.getByLabel('Lager vor Galvanik · Regal / Kiste',{exact:true}).fill('TEST Regal Telefon');
 if(!storedGoods){await receipt.getByRole('checkbox',{name:/hat am Telefon zugesagt/}).check();
 await receipt.getByLabel('Wortlaut der Zusage',{exact:true}).fill('TEST Kunde bestaetigt am Telefon die aktuelle Fassung');}
 await expect(receipt.getByText('48,75 € netto',{exact:true})).toBeVisible({timeout:15000});
 await expect(receipt.getByText('3 × TEST UI Halter · verchromen',{exact:true})).toBeVisible();
 await receipt.locator('.kr-dialog-inhalt').evaluate(element=>{element.scrollTop=0;});
 await receipt.screenshot({path:path.join(process.env.TEMP??'.','kreile-kv-goods-desktop.png')});
 await page.setViewportSize({width:390,height:844});await receipt.screenshot({path:path.join(process.env.TEMP??'.','kreile-kv-goods-mobile.png')});
 if(storedGoods){
  await receipt.getByRole('button',{name:'Ware gesperrt ablegen',exact:true}).click();
  await expect(receipt).toHaveCount(0,{timeout:20000});await page.goto('/warendurchlauf');
  const tiles=page.getByRole('region',{name:'KV-Ware',exact:true});await tiles.getByRole('button',{name:/Gesperrt ·/}).click();
  const tile=tiles.locator('section.kr-kachel').filter({hasText:'TEST Regal Telefon'}).filter({hasText:'Zusage fehlt'});
  await expect(tile).toHaveCount(1);await tile.getByRole('button',{name:'KV öffnen',exact:true}).click();
  if(storedGoods==='operational'){
   await page.context().clearCookies();await page.goto('/start');const worker=generatedFlowRuntime.logins.login_werkstatt;
   await page.getByTestId('pin-user-card-'+createPinLoginHandle(worker.id)).click();
   const workerKeys=page.locator('[data-spec-id="login.anmelden"]'),workerNavigation=page.waitForURL(url=>url.pathname!=='/start');
   for(const digit of worker.pin)await workerKeys.getByRole('button',{name:digit,exact:true}).click();await workerNavigation;
   await page.goto('/warendurchlauf');
   const workerTiles=page.getByRole('region',{name:'KV-Ware',exact:true});await workerTiles.getByRole('button',{name:/Gesperrt ·/}).click();
   await workerTiles.locator('section.kr-kachel').filter({hasText:'TEST Regal Telefon'}).filter({hasText:'Zusage fehlt'}).getByRole('button',{name:'KV öffnen',exact:true}).click();
  }
  const storedCard=page.getByRole('dialog',{name:/KV-2026-/});
  if(storedGoods==='operational'){
   await expect(storedCard.getByText('61,00 € netto',{exact:true})).toHaveCount(0);
   await expect(storedCard.getByRole('button',{name:/Fassung 2 anlegen/})).toHaveCount(0);
   await expect(storedCard.getByRole('button',{name:'KV per E-Mail senden',exact:true})).toHaveCount(0);
  }
  await storedCard.getByRole('button',{name:/hat am Telefon zugesagt/}).click();
  await expect(storedCard.getByText(/ist Auftrag A-2026-.* geworden/)).toBeVisible({timeout:20000});
  await storedCard.getByRole('button',{name:'Auftrag öffnen',exact:true}).click();
 }else{await receipt.getByRole('button',{name:/Auftrag aus KV-2026-.* anlegen/}).click();await expect(receipt).toHaveCount(0,{timeout:20000});}

 const [stored]=await sql`SELECT q.quote_number,q.linked_order_id,q.zugesagt_fassung,r.auftrag_id,r.lagerort,o.ware,o.geprueft,(SELECT sum(quantity)::float8 FROM public.items i WHERE i.tenant_id=o.tenant_id AND i.order_id=o.id) AS quantity,(SELECT count(*)::int FROM public.intake_file f WHERE f.tenant_id=r.tenant_id AND f.item_id=r.item_id) AS files FROM private.quotes q JOIN public.goods_receipt r ON r.tenant_id=q.tenant_id AND r.kv_id=q.id JOIN public.orders o ON o.tenant_id=q.tenant_id AND o.id=q.linked_order_id WHERE q.tenant_id='galvanik-kreile' AND q.id=${quoteId}::uuid`;
 expect(stored).toMatchObject({zugesagt_fassung:1,auftrag_id:stored.linked_order_id,lagerort:'TEST Regal Telefon',ware:'da',geprueft:true,quantity:3,files:4});
 const [device]=await sql`SELECT d.status,cardinality(d.angenommen_auf) AS devices,(SELECT count(*)::int FROM public.intake_file f WHERE f.tenant_id=d.tenant_id AND f.item_id=d.item_id AND f.art='foto') AS photos FROM public.device_request d JOIN public.goods_receipt r ON r.tenant_id=d.tenant_id AND r.item_id=d.item_id WHERE d.tenant_id='galvanik-kreile' AND r.auftrag_id=${stored.linked_order_id}`;
 expect(device).toMatchObject({status:'beendet',devices:1});expect(device.photos).toBeGreaterThanOrEqual(2);
 if(storedGoods)await expect(page.locator('[aria-label="KV-Ware"]').getByRole('heading',{name:stored.quote_number+' · Prueffirma Alpha GmbH',exact:true})).toHaveCount(0);


 expect((await sql`SELECT count(*)::int n FROM public.events WHERE tenant_id='galvanik-kreile' AND payload->>'quoteId'=${quoteId} AND event_type='QUOTE_LIFECYCLE_V04' AND payload->>'action'='accept'`)[0].n).toBe(1);
 await expect(page.getByRole('dialog',{name:/Auftragskarte A-2026-/})).toBeVisible({timeout:10000});
 const orderRead=await action(page,'getLiveOrderCardAction',{orderId:stored.linked_order_id},'src/app/actions/orders.actions.ts');
 if(storedGoods==='operational'){expect(orderRead?.data.card.commercialQuote).toBeUndefined();expect((await sql`SELECT user_id::text FROM public.events WHERE tenant_id='galvanik-kreile' AND payload->>'quoteId'=${quoteId} AND event_type='QUOTE_LIFECYCLE_V04' AND payload->>'action'='accept'`)[0].user_id).toBe(generatedFlowRuntime.logins.login_werkstatt.id);}else expect(orderRead?.data.card.commercialQuote).toMatchObject({quoteId,totalNetCents:4875,positions:[{quantity:3,lineTotalCents:4875}]});
 await expect(page.getByText('TEST-Etikett.png',{exact:true})).toBeVisible();
 await expect(page.getByText('TEST-Inhalt.png',{exact:true})).toBeVisible();
 await page.evaluate(id=>window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'kv',arg:id}})),quoteId);
 const progressCard=page.getByRole('dialog',{name:/KV-2026-/});
 await expect(progressCard.getByRole('region',{name:'Stand auf einen Blick'})).toBeVisible();
 const start=progressCard.getByRole('button',{name:/A-2026-.* in die Galvanik nehmen/});
 await expect(start).toBeVisible();await start.dblclick();
 await expect(progressCard.getByRole('listitem').filter({hasText:'In der Galvanik'})).toBeVisible({timeout:15000});
 const [moved]=await sql`SELECT o.station,o.version,(SELECT count(*)::int FROM public.events e WHERE e.tenant_id=o.tenant_id AND e.order_id=o.id AND e.event_type='ORDER_STATION_MOVED_V1') AS moves FROM public.orders o WHERE o.tenant_id='galvanik-kreile' AND o.id=${stored.linked_order_id}`;
 expect(moved).toMatchObject({station:'galvanik',moves:1});
 expect(moved.version).toBeGreaterThan(1);
 await expect(progressCard.getByRole('button',{name:/in die Galvanik nehmen/})).toHaveCount(0);
});


test('quote copy: existing writer creates one new card and preserves its real source',async({page})=>{
 await prepareGeneratedSeed({id:'KV-UI-COPY',gegeben:{login:'login_meister',datenlagen:['kunde_vollstaendig_firma'],aufruf:{seite:'nachrichten',weg:'oeffne'}}} as FlowCase);
 await page.setViewportSize({width:1220,height:880});await page.goto('/start');
 const actor=generatedFlowRuntime.logins.login_meister;
 await page.getByTestId('pin-user-card-'+createPinLoginHandle(actor.id)).click();
 const keypad=page.locator('[data-spec-id="login.anmelden"]'),navigation=page.waitForURL(url=>url.pathname!=='/start');
 for(const digit of actor.pin)await keypad.getByRole('button',{name:digit,exact:true}).click();await navigation;await page.goto('/orders');
 const customer=generatedFlowRuntime.datenlagen.kunde_vollstaendig_firma.id,createId=randomUUID();
 await action(page,'createQuoteAction',{clientEventId:createId,customerId:customer,dueDate:'2026-12-01',note:'TEST Kopiervorlage',calculation:{hours:'4',hourlyRateCents:1000,setupCents:1200,materialCents:900},positions:[{name:'TEST Kopierte Halter',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:1525}]});
 const [source]=await sql`SELECT q.id::text,q.quote_number,q.version FROM private.quotes q JOIN private.quote_create_receipts r ON r.quote_id=q.id AND r.tenant_id=q.tenant_id WHERE r.tenant_id='galvanik-kreile' AND r.client_event_id=${createId}::uuid`;
 await page.evaluate(id=>window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'kv',arg:id}})),source.id);
 const card=page.getByRole('dialog',{name:/KV-2026-/});await expect(card).toBeVisible();
 await card.getByRole('button',{name:'Diesen KV als Vorlage',exact:true}).click();
 await expect(card.getByLabel('Neuer Fertigtermin')).toHaveValue('');
 await card.getByLabel('Neuer Fertigtermin').fill('2026-12-16');
 await card.getByRole('button',{name:'Neuen KV aus Vorlage anlegen',exact:true}).dblclick();
 await expect(card.getByText('16.12.2026',{exact:true})).toBeVisible();
 const copies=await sql`SELECT id::text,quote_number,due_date::text,total_net_cents FROM private.quotes WHERE tenant_id='galvanik-kreile' AND note LIKE ${'%Kopie von '+source.quote_number+'%'} ORDER BY created_at DESC`;
 expect(copies).toHaveLength(1);expect(copies[0].due_date).toBe('2026-12-16');expect(Number(copies[0].total_net_cents)).toBe(6100);
 await expect(card).toHaveAccessibleName(copies[0].quote_number+' · Prueffirma Alpha GmbH');
 expect((await sql`SELECT version FROM private.quotes WHERE tenant_id='galvanik-kreile' AND id=${source.id}::uuid`)[0].version).toBe(source.version);
 const reread=await action(page,'readQuoteAction',{quoteId:copies[0].id});expect(reread.quote.positions[0]).toMatchObject({name:'TEST Kopierte Halter',quantity:4,lineTotalCents:6100});
 await card.screenshot({path:path.join(process.env.TEMP??'.','kreile-kv-copy-real.png')});
});


test('quote preparation: real source hints and writer stay linked through the existing form',async({page})=>{
 await prepareGeneratedSeed({id:'KV-UI-PREPARE',gegeben:{login:'login_meister',datenlagen:['kunde_vollstaendig_firma'],aufruf:{seite:'nachrichten',weg:'oeffne'}}} as FlowCase);
 await page.goto('/start');const actor=generatedFlowRuntime.logins.login_meister;
 await page.getByTestId('pin-user-card-'+createPinLoginHandle(actor.id)).click();
 const keypad=page.locator('[data-spec-id="login.anmelden"]'),navigation=page.waitForURL(url=>url.pathname!=='/start');
 for(const digit of actor.pin)await keypad.getByRole('button',{name:digit,exact:true}).click();await navigation;await page.goto('/orders');
 const itemId=randomUUID(),customer=generatedFlowRuntime.datenlagen.kunde_vollstaendig_firma.id;
 const text='4 Stück Halter verchromen, KV; Die alten Halter bitte erhalten.';
 await action(page,'saveIntakeNoteAction',{itemId,textstand:randomUUID(),text,context:{customerId:customer},concerns:['aufgabe']},'src/app/actions/eingang.actions.ts');
 const [source]=await sql`SELECT version FROM public.intake_item WHERE tenant_id='galvanik-kreile' AND id=${itemId}::uuid`;
 await action(page,'selectIntakeConcernAction',{itemId,version:source.version,clientEventId:randomUUID(),concern:'kv_anfrage'},'src/app/actions/eingang.actions.ts');
 await page.evaluate(sourceItemId=>window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'kv-vorbereiten',sourceItemId}})),itemId);
 const form=page.locator('form').filter({has:page.getByRole('button',{name:'KV sichern',exact:true})});
 await expect(form.getByLabel('Hinweis zum KV')).toHaveValue(text);
 await expect(form.getByLabel('Menge',{exact:true})).toHaveValue('4');
 await expect(form.getByLabel('Preis netto (€)',{exact:true})).toHaveValue('');
 await form.getByLabel('Preis netto (€)',{exact:true}).fill('10');
 await form.getByLabel('Gewünschter Termin',{exact:true}).fill('2026-12-18');
 await form.getByRole('button',{name:'KV sichern',exact:true}).dblclick();
 const card=page.getByRole('dialog',{name:/KV-2026-/});await expect(card).toBeVisible();
 const quotes=await sql`SELECT id::text,linked_order_id FROM private.quotes WHERE tenant_id='galvanik-kreile' AND quelle_intake_item_id=${itemId}::uuid`;
 expect(quotes).toHaveLength(1);expect(quotes[0].linked_order_id).toBeNull();
 const read=await action(page,'readQuoteAction',{quoteId:quotes[0].id});
 expect(read.quote.lifecycle).toMatchObject({sourceItemId:itemId,specialRequests:'Die alten Halter bitte erhalten.'});
 expect(read.quote.positions[0]).toMatchObject({quantity:4,unitPriceCents:1000});
 await expect(card.getByText('Die alten Halter bitte erhalten.',{exact:true})).toBeVisible();
});
