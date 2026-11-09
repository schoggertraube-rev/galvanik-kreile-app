// @vitest-environment node

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.H18_EXPECTED_DATABASE_URL;
if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("H18_WORKSHOP_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("H18_WORKSHOP_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("H18_WORKSHOP_LOCAL_REPLAY_REQUIRED: service role must be unset");

const reminderTenant=vi.hoisted(()=>`test-cr-${crypto.randomUUID()}`);
vi.mock('@/lib/tenant',async original=>({...await original<typeof import('@/lib/tenant')>(),KREILE_TENANT_SLUG:reminderTenant}));

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "h18-workshop-actions-local-only";

type Fixture = { actorId: string; actorIssuedAt: number; customerId: string };

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/h18-workshop-actions", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/h18-workshop-actions",
    route: "/h18-workshop-actions",
    afterContext: {},
    previouslyRevalidatedTags: [],
    refreshTagsByCacheKind: new Map(),
    shouldTrackFetchMetrics: false,
    deploymentId: "test",
    buildId: "test",
    incrementalCache: {},
    cacheComponentsEnabled: false,
    runInCleanSnapshot: (fn: (...args: never[]) => unknown, ...args: never[]) => fn(...args),
    reactServerErrorsByDigest: new Map(),
  } as unknown as import("next/dist/server/app-render/work-async-storage.external").WorkStore;
  const requestStore = createRequestStoreForAPI(
    request,
    { pathname: "/h18-workshop-actions", search: "" },
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined as never,
  );
  return workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(requestStore, work));
}

async function withSession<T>(fixture: Fixture, work: () => Promise<T>): Promise<T> {
  const { COOKIE_NAME, getSecretKey, signAppSession } = await import("@/lib/server/appSession");
  const session: AppSession = {
    userId: fixture.actorId,
    tenantId: KREILE_TENANT_SLUG,
    role: "meister",
    displayName: "TEST Begleitschein",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work);
}

async function createFixture(areas:string[]=['eingang', 'auftraege', 'kunden', 'geld', 'kassieren', 'entscheiden']): Promise<Fixture> {
  const actorId = randomUUID();
  const customerId = randomUUID();
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES (
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`rolf-h18-workshop-${actorId}@local.invalid`},
        'TEST Begleitschein', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(${areas}::text[]) area
    `;
    await transaction`
      INSERT INTO public.customers (
        id, tenant_id, customer_number, name, company_name, type, contact_person, email, phone, street, zip_code, city, country, payment_preference, ziel_freigeschaltet, ziel_tage, source, first_name, last_name, salutation, house_number
      ) VALUES (
        ${customerId}, ${KREILE_TENANT_SLUG}, ${`H18-W-${customerId.slice(0, 8)}`}, 'TEST Begleitscheinkunde', 'TEST Begleitscheinkunde GmbH', 'business', 'Ada Werkstatt', ${`werkstatt-${customerId}@local.invalid`}, '+49 711 5550192', (SELECT street FROM private.kunde_split_street('Werkstattweg 18')), '70178', 'Stuttgart', private.kunde_land_schluessel('Deutschland'), 'rechnung', true, 14, 'manual', (SELECT first_name FROM private.kunde_split_name('Ada Werkstatt')), (SELECT last_name FROM private.kunde_split_name('Ada Werkstatt')), (SELECT salutation FROM private.kunde_split_name('Ada Werkstatt')), (SELECT house_number FROM private.kunde_split_street('Werkstattweg 18'))
      )
    `;
  });
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id=${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("H18_WORKSHOP_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt, customerId };
}

async function createOrder(fixture: Fixture, label: string, paymentMode: "vorkasse" | "rechnung") {
  const { createOrderIntakeAction } = await import("@/app/actions/eingang.actions");
  const result = await withSession(fixture, () => createOrderIntakeAction({ geprueft: true,
    clientEventId: randomUUID(),
    customer: { mode: "EXISTING", customerId: fixture.customerId },
    dueDate: "2027-05-15",
    termStatus: "bestaetigt",
    intakeSource: "persoenlich",
    handoverMode: "pickup",
    paymentMode,
    note: `H18 Werkstatt ${label}`,
    items: [{
      catalogServiceId: null,
      name: `H18 Werkstattteil ${label}`,
      quantity: 1,
      material: "Stahl",
      surfaceRequested: "Verchromen",
      executionRequested: "offen",
      unit: null,
      unitPriceCents: null,
      vatRateBasisPoints: null,
    }],
  }));
  if (result.code !== "OK") throw new Error(`H18_WORKSHOP_INTAKE_FAILED:${result.code}:${result.message}`);
  return result.receipt;
}

async function createReworkComplaint(
  fixture: Fixture,
  order: { orderId: string; items: Array<{ id: string }> },
): Promise<{ complaintId: string; version: number }> {
  const sourceItem = order.items[0];
  if (!sourceItem) throw new Error("H18_REWORK_SOURCE_ITEM_MISSING");
  const complaintId = randomUUID();
  await sql`
    INSERT INTO public.complaints (
      id, tenant_id, order_id, customer_id, item_id, reason, description, status,
      nummer, client_key, teile, mangel, fotos, ware_zurueck, stand, version,
      erstellt_von, erstellt_am
    ) VALUES (
      ${complaintId}, ${KREILE_TENANT_SLUG}, ${order.orderId}, ${fixture.customerId}, ${sourceItem.id},
      'TEST Reklamation', 'TEST Nacharbeit', 'open',
      ${`RK-H18-${complaintId.slice(0, 8)}`}, ${randomUUID()}::uuid,
      ${sql.json([{ position_id: sourceItem.id, menge: 1 }])}::jsonb,
      'H18 Mangel', '[]'::jsonb, 'ja', 'aufgenommen', 1,
      ${fixture.actorId}::uuid, statement_timestamp() AT TIME ZONE 'UTC'
    )
  `;
  return { complaintId, version: 1 };
}


afterAll(async()=>{vi.restoreAllMocks();await sql.end({timeout:1});if(originalSecret===undefined)delete process.env.APP_SESSION_SECRET;else process.env.APP_SESSION_SECRET=originalSecret;});

it('sends a reminder through the real Action, DB receipt and shared view; only Microsoft is a TEST boundary',async()=>{
 const fixture=await createFixture(),sender=await createFixture(['kunden']);
 await sql`INSERT INTO public.email_templates(tenant_id,template_key,name,subject_template,body_html_template,body_text_template,variables) VALUES(${KREILE_TENANT_SLUG},${KREILE_TENANT_SLUG+':nacharbeit_begleitschein'},'TEST Nacharbeit Begleitschein','TEST Nacharbeit {Auftragsnummer}','<p>TEST {Kunde} · {RK-Nummer}</p>','TEST {Kunde} · {RK-Nummer}', '["Kunde","Auftragsnummer","RK-Nummer"]'::jsonb)`;
 const source=await createOrder(fixture,'TEST-REMINDER','rechnung');
 const complaint=await createReworkComplaint(fixture,source);
 const {nacharbeitAnlegenAction,sendeNacharbeitBegleitscheinAction,getByOrder,getComplaintDialogAction}=await import('@/app/actions/complaints.actions');
 const work=await withSession(fixture,()=>nacharbeitAnlegenAction({reklamationId:complaint.complaintId,version:1,bewertung:'berechtigt',massnahme:'nacharbeit',liefertermin:'2027-05-18'}));
 if(work.code!=='OK')throw Error('TEST_REWORK:'+work.code+':'+work.message);
 await sql`UPDATE public.orders SET ware_seit='2026-10-12T08:00:00Z'::timestamptz WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${work.receipt.orderId}`;
 const dialog=await withSession(sender,()=>getComplaintDialogAction({reminderOrderId:work.receipt.orderId}));
 expect(dialog).toMatchObject({code:'OK',data:{complaint:{id:complaint.complaintId,stand:'massnahme_nacharbeit'},resultMail:{subject:expect.stringContaining(work.receipt.orderNumber)}}});
 if(dialog.code!=='OK'||!('data'in dialog)||!dialog.data.resultMail||!dialog.data.complaint?.version)throw Error('TEST_REMINDER_DIALOG');
 const input={complaintId:complaint.complaintId,version:dialog.data.complaint.version,orderId:work.receipt.orderId,clientKey:randomUUID(),subject:dialog.data.resultMail.subject,body:dialog.data.resultMail.body};
 const keys=['MS_GRAPH_TENANT_ID','MS_GRAPH_CLIENT_ID','MS_GRAPH_CLIENT_SECRET','MS_GRAPH_MAILBOX'] as const;
 const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 const native=globalThis.fetch;let sends=0;
 try{
  for(const key of keys)process.env[key]='';
  expect(await withSession(sender,()=>sendeNacharbeitBegleitscheinAction(input))).not.toMatchObject({code:'OK'});
  expect((await withSession(sender,()=>getByOrder(source.orderId)))).toMatchObject({code:'OK',complaints:[expect.not.objectContaining({goodsReminderSentAt:expect.any(String)})]});
  process.env.MS_GRAPH_TENANT_ID='TEST-tenant';process.env.MS_GRAPH_CLIENT_ID='TEST-client';process.env.MS_GRAPH_CLIENT_SECRET='TEST-provider-fixture';process.env.MS_GRAPH_MAILBOX='TEST-mailbox@example.invalid';
  vi.spyOn(globalThis,'fetch').mockImplementation(async(url,options)=>{
   const target=new URL(typeof url==='string'?url:url instanceof URL?url.href:url.url);
   if(target.hostname==='login.microsoftonline.com')return new Response(JSON.stringify({access_token:'TEST-provider-token-not-a-real-secret',expires_in:3600}),{status:200,headers:{'content-type':'application/json'}});
   if(target.hostname==='graph.microsoft.com'&&target.pathname.endsWith('/sendMail')){sends++;return new Response(null,{status:202});}
   return native(url,options);
  });
  const sent=await withSession(sender,()=>sendeNacharbeitBegleitscheinAction(input));expect(sent).toMatchObject({code:'OK'});
  const [stored]=await sql`SELECT thread.status,thread.order_id,message.summary,message.body FROM public.communication_threads thread JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id WHERE thread.tenant_id=${KREILE_TENANT_SLUG} AND thread.source=${'MS_GRAPH_OUT:'+input.clientKey}`;
  expect(stored).toMatchObject({status:'sent',order_id:work.receipt.orderId,summary:'Reklamation '+complaint.complaintId+' · Begleitschein',body:input.body});
  expect(await withSession(sender,()=>getByOrder(source.orderId))).toMatchObject({code:'OK',complaints:[expect.objectContaining({id:complaint.complaintId,stand:'massnahme_nacharbeit',goodsReminderSentAt:expect.any(String)})]});
  expect(await withSession(sender,()=>sendeNacharbeitBegleitscheinAction(input))).toMatchObject({code:'OK',data:{replayed:true}});expect(sends).toBe(1);
  expect(await withSession(sender,()=>sendeNacharbeitBegleitscheinAction({...input,body:input.body+' TEST changed'}))).not.toMatchObject({code:'OK'});
  expect(sends).toBe(1);
 }finally{vi.restoreAllMocks();for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});


it('RM01 real source reply Action persists mail, event and waiting view exactly once',async()=>{
 const fixture=await createFixture(['eingang','mails','kunden']);
 const itemId=randomUUID(),fileId=randomUUID(),hash='a'.repeat(64),graphId='TEST-RM01-'+itemId;
 await sql`INSERT INTO public.email_templates(tenant_id,template_key,name,subject_template,body_html_template,body_text_template,variables) VALUES(${KREILE_TENANT_SLUG},${KREILE_TENANT_SLUG+':reklamation_fotos_anfordern'},'TEST Fotos','TEST Fotos {Kunde}','<p>TEST Fotos</p>','TEST Bitte Fotos senden, {Kunde}', '["Kunde"]'::jsonb)`;
 await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,kunde_id,zuordnung,einsatz,text,anliegen,anliegen_offen,absender_adresse,graph_message_id,empfangen_am) VALUES(${itemId}::uuid,${KREILE_TENANT_SLUG},${itemId},'mail','rein','mailabruf',${fixture.actorId}::uuid,${fixture.customerId},'hand','offen','TEST Flecken',ARRAY['reklamation'],ARRAY['reklamation'],'TEST-sender@example.invalid',${graphId},statement_timestamp())`;
 await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${fileId}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${fileId},'mime','TEST RM01.eml','message/rfc822',32,${hash},${KREILE_TENANT_SLUG+'/'+hash},now(),${fixture.actorId}::uuid,1,true,false,'fertig')`;
 for(const [art,payload]of [['original_gespeichert',{fileId,sha256:hash,bytes:32}],['einsatz',{action:'mail_import_complete',fileIds:[fileId]}]] as const)await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,${art},${randomUUID()}::uuid,${fixture.actorId},${sql.json(payload)})`;
 const {sendCustomerMailAction}=await import('@/app/actions/communications.actions');
 const {readIntakeMessages}=await import('@/modules/eingang/server-public');
 const input={targetType:'CUSTOMER' as const,targetId:fixture.customerId,clientRequestId:randomUUID(),subject:'',body:'',complaintPhotoRequest:{itemId,version:1}};
 for(const rights of [['eingang','kunden'],['eingang','mails']] ){
  const denied=await createFixture(rights);
  expect(await withSession(denied,()=>sendCustomerMailAction(input))).toMatchObject({code:'FORBIDDEN'});
 }
 expect(await sql`SELECT id FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientRequestId}`).toEqual([]);

 const keys=['MS_GRAPH_TENANT_ID','MS_GRAPH_CLIENT_ID','MS_GRAPH_CLIENT_SECRET','MS_GRAPH_MAILBOX'] as const;
 const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));const native=globalThis.fetch;let sends=0;
 try{
  for(const key of keys)process.env[key]='';
  expect(await withSession(fixture,()=>sendCustomerMailAction(input))).not.toMatchObject({code:'OK'});
  expect((await sql`SELECT version FROM public.intake_item WHERE id=${itemId}::uuid`)[0].version).toBe(1);
  process.env.MS_GRAPH_TENANT_ID='TEST-tenant';process.env.MS_GRAPH_CLIENT_ID='TEST-client';process.env.MS_GRAPH_CLIENT_SECRET='TEST-provider-fixture';process.env.MS_GRAPH_MAILBOX='TEST-mailbox@example.invalid';
  vi.spyOn(globalThis,'fetch').mockImplementation(async(url,options)=>{
   const target=new URL(typeof url==='string'?url:url instanceof URL?url.href:url.url);
   if(target.hostname==='login.microsoftonline.com')return new Response(JSON.stringify({access_token:'TEST-provider-token-not-a-real-secret',expires_in:3600}),{status:200,headers:{'content-type':'application/json'}});
   if(target.hostname==='graph.microsoft.com'&&target.pathname.endsWith('/reply')){expect(decodeURIComponent(target.pathname)).toContain(graphId);sends++;expect(await withSession(fixture,()=>sendCustomerMailAction({...input,clientRequestId:randomUUID()}))).not.toMatchObject({code:'OK'});return new Response(null,{status:202});}
   return native(url,options);
  });
  const sent=await withSession(fixture,()=>sendCustomerMailAction(input));expect(sent).toMatchObject({code:'OK'});
  const [stored]=await sql`SELECT thread.id,thread.status,message.body FROM public.communication_threads thread JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id WHERE thread.tenant_id=${KREILE_TENANT_SLUG} AND thread.source=${'MS_GRAPH_OUT:'+input.clientRequestId}`;
  expect(stored).toMatchObject({status:'sent',body:'TEST Bitte Fotos senden, TEST Begleitscheinkunde'});
  const [source]=await sql`SELECT version,einsatz,anliegen_offen FROM public.intake_item WHERE id=${itemId}::uuid`;
  expect(source).toMatchObject({version:2,einsatz:'offen',anliegen_offen:['reklamation']});
  expect(await sql`SELECT von FROM public.intake_event WHERE item_id=${itemId}::uuid AND nachher->>'action'='reklamation.fotos_angefordert'`).toEqual([{von:fixture.actorId}]);
  expect(await sql`SELECT user_id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientRequestId}::uuid AND event_type='INTAKE_COMPLAINT_PHOTO_REQUESTED_V1'`).toEqual([{user_id:fixture.actorId}]);
  expect(await withSession(fixture,()=>readIntakeMessages('offen',itemId))).toMatchObject({code:'OK',messages:[expect.objectContaining({id:itemId,photoRequest:{threadId:stored.id,at:expect.any(String)}})]});
  expect(await withSession(fixture,()=>sendCustomerMailAction(input))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(await withSession(fixture,()=>sendCustomerMailAction({...input,clientRequestId:randomUUID(),complaintPhotoRequest:{itemId,version:2}}))).not.toMatchObject({code:'OK'});
  // Isolated TEST originals establish the reader contract; no real Storage/Graph import is claimed.
  const replyId=randomUUID(),mimeId=randomUUID(),photos=[randomUUID(),randomUUID()],replyHash='b'.repeat(64),internetId='<TEST-rekla-'+itemId+'@example.invalid>';
  await sql`UPDATE public.intake_item SET internet_message_id=${internetId} WHERE id=${itemId}::uuid`;
  await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,kunde_id,zuordnung,einsatz,text,anliegen,anliegen_offen,absender_adresse,graph_message_id,empfangen_am) VALUES(${replyId}::uuid,${KREILE_TENANT_SLUG},${replyId},'mail','rein','mailabruf',${fixture.actorId}::uuid,${fixture.customerId},'hand','offen','TEST anbei zwei Fotos',ARRAY['reklamation'],ARRAY['reklamation'],'TEST-sender@example.invalid',${'TEST-reply-'+replyId},statement_timestamp())`;
  for(const [index,id]of [mimeId,...photos].entries()){
   const hash=index?String(index).repeat(64):replyHash;
   await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${id}::uuid,${KREILE_TENANT_SLUG},${replyId}::uuid,${id},${index?'foto':'mime'},${index?'TEST Foto.jpg':'TEST Antwort.eml'},${index?'image/jpeg':'message/rfc822'},32,${hash},${KREILE_TENANT_SLUG+'/'+hash},now(),${fixture.actorId}::uuid,${index+1},true,false,'fertig')`;
   await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${replyId}::uuid,'original_gespeichert',${id}::uuid,${fixture.actorId},${sql.json({fileId:id,sha256:hash,bytes:32})})`;
  }
  await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${replyId}::uuid,'angelegt',${randomUUID()}::uuid,${fixture.actorId},${sql.json({kanal:'mail',replyChain:{source:'original_mime',status:'present',originalSha256:replyHash,inReplyTo:[internetId],references:[]}})})`;
  await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${replyId}::uuid,'einsatz',${randomUUID()}::uuid,${fixture.actorId},${sql.json({action:'mail_import_complete',fileIds:[mimeId,...photos],originalCount:2,filteredAttachments:0})})`;
  const readRelations=()=>withSession(fixture,async()=>{
   const {resolveAuthorization}=await import('@/lib/server/authorization');const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST real session');
   const {withPrivilegedTenantTransaction}=await import('@/lib/server/privilegedDb');const {readComplaintPhotoReplyRelations}=await import('@/modules/eingang/server-public');
   return withPrivilegedTenantTransaction(auth.data,tx=>readComplaintPhotoReplyRelations(tx,auth.data,[itemId]));
  });
  expect(await readRelations()).toEqual([expect.objectContaining({rootId:itemId,replyId,customerId:fixture.customerId,orderId:null,photoIds:photos})]);
  await sql`UPDATE public.intake_item SET kunde_id=NULL WHERE id=${replyId}::uuid`;
  expect(await readRelations()).toEqual([]);
  await sql`UPDATE public.intake_item SET kunde_id=${fixture.customerId} WHERE id=${replyId}::uuid`;
  await sql`UPDATE public.intake_event SET nachher=jsonb_set(nachher,'{replyChain,originalSha256}',to_jsonb(${'c'.repeat(64)}::text)) WHERE item_id=${replyId}::uuid AND art='angelegt'`;
  expect(await readRelations()).toEqual([]);
  expect(sends).toBe(1);
 }finally{vi.restoreAllMocks();for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});


it.each([false,true])('RM07 reminder preserves confirmed delivery after goods arrive (reconcile=%s)',async reconcile=>{
 const fixture=await createFixture(),sender=await createFixture(['kunden']);const source=await createOrder(fixture,'TEST-RM07-REMINDER','rechnung');const complaint=await createReworkComplaint(fixture,source);
 const {nacharbeitAnlegenAction,sendeNacharbeitBegleitscheinAction,getByOrder,getComplaintDialogAction}=await import('@/app/actions/complaints.actions');
 const work=await withSession(fixture,()=>nacharbeitAnlegenAction({reklamationId:complaint.complaintId,version:1,bewertung:'berechtigt',massnahme:'nacharbeit',liefertermin:'2027-05-18'}));if(work.code!=='OK')throw Error(work.message);
 const input={complaintId:complaint.complaintId,version:2,orderId:work.receipt.orderId,clientKey:randomUUID(),subject:'TEST Begleitschein',body:'TEST Bitte Ware senden'};
 const keys=['MS_GRAPH_TENANT_ID','MS_GRAPH_CLIENT_ID','MS_GRAPH_CLIENT_SECRET','MS_GRAPH_MAILBOX'] as const,before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));let sends=0;
 // A synthetic concurrent arrival changes the source fact, without changing the complaint version.
 const arrived=()=>sql`UPDATE public.orders SET ware='da',ware_seit=statement_timestamp() WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${work.receipt.orderId}`;
 try{
  process.env.MS_GRAPH_TENANT_ID='TEST-tenant';process.env.MS_GRAPH_CLIENT_ID='TEST-client';process.env.MS_GRAPH_CLIENT_SECRET='TEST-provider-fixture';process.env.MS_GRAPH_MAILBOX='TEST-mailbox@example.invalid';
  const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fixture.customerId}`;
  vi.spyOn(globalThis,'fetch').mockImplementation(async url=>{const target=new URL(typeof url==='string'?url:url instanceof URL?url.href:url.url);if(target.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-provider-token-not-a-real-secret',expires_in:3600});if(target.pathname.endsWith('/sendMail')){sends++;if(!reconcile)await arrived();return new Response(null,{status:reconcile?503:202});}if(target.pathname.endsWith('/mailFolders/sentitems/messages'))return Response.json({value:[{id:'TEST-confirmed-reminder',internetMessageId:'<TEST-reminder@example.invalid>',internetMessageHeaders:[{name:'x-kreile-send-id',value:input.clientKey}],from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString()}]});throw Error('TEST unexpected graph route');});
  const initial=await withSession(sender,()=>sendeNacharbeitBegleitscheinAction(input));if(reconcile){expect(initial).toMatchObject({code:'UNAVAILABLE',delivery:'checking'});await arrived();await sql`UPDATE public.communication_threads SET created_at=now()-interval '6 minutes' WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientKey}`;}
  const [prepared]=await sql<{request:{key:string;version:number;subject:string;body:string}}[]>`SELECT jsonb_build_object('key',event.payload->>'sendKey','version',(event.payload->'complaint'->>'version')::int,'subject',event.payload->'message'->>'subject','body',event.payload->'message'->>'body') AS request FROM public.events event JOIN public.communication_threads thread ON thread.tenant_id=event.tenant_id AND thread.id::text=event.payload->>'threadId' WHERE event.tenant_id=${KREILE_TENANT_SLUG} AND event.event_type='COMMUNICATION_SEND_PREPARED_V1' AND event.correlation_id=${input.clientKey}::uuid`;
  const retry={...input,clientKey:prepared.request.key,version:prepared.request.version,subject:prepared.request.subject,body:prepared.request.body};
  let resumed=retry;if(reconcile){const reopened=await withSession(sender,()=>getComplaintDialogAction({reminderOrderId:work.receipt.orderId}));expect(reopened).toMatchObject({code:'OK',data:{mailRecovery:{kind:'reminder',request:input,retryAt:expect.any(String)}}});if(reopened.code!=='OK'||!('data'in reopened)||!reopened.data.mailRecovery?.request?.orderId)throw Error('TEST reminder recovery');resumed={...reopened.data.mailRecovery.request,orderId:reopened.data.mailRecovery.request.orderId};}
  const result=reconcile?await withSession(sender,()=>sendeNacharbeitBegleitscheinAction(resumed)):initial;expect(result).toMatchObject({code:'OK',data:{sourceChanged:true}});expect(sends).toBe(1);
  const view=await withSession(sender,()=>getByOrder(source.orderId));expect(view).toMatchObject({code:'OK',complaints:expect.arrayContaining([expect.objectContaining({id:complaint.complaintId,version:2,stand:'massnahme_nacharbeit'})])});if(view.code==='OK')expect(view.complaints.find(row=>row.id===complaint.complaintId)).not.toHaveProperty('goodsReminderSentAt');
  expect(await sql`SELECT ware FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${work.receipt.orderId}`).toEqual([{ware:'da'}]);
  expect(await sql`SELECT message.body FROM public.communication_messages message JOIN public.communication_threads thread ON thread.tenant_id=message.tenant_id AND thread.id=message.thread_id WHERE thread.tenant_id=${KREILE_TENANT_SLUG} AND thread.source=${'MS_GRAPH_OUT:'+input.clientKey} AND thread.status='sent'`).toEqual([{body:input.body}]);
  expect(await withSession(sender,()=>sendeNacharbeitBegleitscheinAction(retry))).toMatchObject({code:'OK',data:{sourceChanged:true,replayed:true}});expect(sends).toBe(1);
 }finally{vi.restoreAllMocks();for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});
