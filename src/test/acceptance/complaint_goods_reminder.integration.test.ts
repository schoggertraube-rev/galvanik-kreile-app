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

it.each([false,true,'confirm'] as const)('sends a reminder through the real Action, DB receipt and shared view (responseLost=%s)',async(responseLost)=>{
 const fixture=await createFixture(),sender=await createFixture(['kunden']);
 await sql`INSERT INTO public.email_templates(tenant_id,template_key,name,subject_template,body_html_template,body_text_template,variables) VALUES(${KREILE_TENANT_SLUG},${KREILE_TENANT_SLUG+':nacharbeit_begleitschein'},'TEST Nacharbeit Begleitschein','TEST Nacharbeit {Auftragsnummer}','<p>TEST {Kunde} · {RK-Nummer}</p>','TEST {Kunde} · {RK-Nummer}', '["Kunde","Auftragsnummer","RK-Nummer"]'::jsonb) ON CONFLICT(template_key) DO NOTHING`;
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
   if(target.hostname==='graph.microsoft.com'&&target.pathname.endsWith('/sendMail')){sends++;if(responseLost&&sends===1)throw Error('TEST complaint reminder accepted, response lost');return new Response(null,{status:202});}
   if(target.hostname==='graph.microsoft.com'&&target.pathname.includes('/mailFolders/sentitems/messages')){const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=(SELECT customer_id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${work.receipt.orderId})`;return Response.json({value:responseLost==='confirm'?[]:[{id:'TEST-complaint-sent',internetMessageId:'<TEST-complaint-sent@example.invalid>',from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:input.clientKey}]}]});}
   return native(url,options);
  });
  if(responseLost==='confirm'){
   const clock='test_complaint_clock_'+randomUUID().replaceAll('-','');
   await sql.unsafe(`CREATE FUNCTION private.${clock}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_MAIL_PREPARED_V1' AND NEW.correlation_id='${input.clientKey}'::uuid THEN NEW.created_at=statement_timestamp()-interval '11 minutes'; END IF; RETURN NEW; END $$`);
   await sql.unsafe(`CREATE TRIGGER ${clock} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${clock}()`);
   try{expect(await withSession(sender,()=>sendeNacharbeitBegleitscheinAction(input))).toMatchObject({code:'UNAVAILABLE'});}
   finally{await sql.unsafe(`DROP TRIGGER ${clock} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${clock}()`);}
   expect(await withSession(sender,()=>sendeNacharbeitBegleitscheinAction(input))).toMatchObject({code:'CONFLICT',resend:{requestId:input.clientKey,label:expect.stringContaining('erneut senden')}});
  }else if(responseLost)expect(await withSession(sender,()=>sendeNacharbeitBegleitscheinAction(input))).toMatchObject({code:'UNAVAILABLE'});
  const sent=await withSession(sender,()=>sendeNacharbeitBegleitscheinAction(responseLost==='confirm'?{...input,confirmedResend:true}:responseLost?{...input,clientKey:randomUUID()}:input));expect(sent).toMatchObject({code:'OK'});
  const [stored]=await sql`SELECT thread.status,thread.order_id,message.summary,message.body FROM public.communication_threads thread JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id WHERE thread.tenant_id=${KREILE_TENANT_SLUG} AND thread.source=${'MS_GRAPH_OUT:'+input.clientKey}`;
  expect(stored).toMatchObject({status:'sent',order_id:work.receipt.orderId,summary:'Reklamation '+complaint.complaintId+' · Begleitschein',body:input.body});
  expect(await withSession(sender,()=>getByOrder(source.orderId))).toMatchObject({code:'OK',complaints:[expect.objectContaining({id:complaint.complaintId,stand:'massnahme_nacharbeit',goodsReminderSentAt:expect.any(String)})]});
  expect(await withSession(sender,()=>sendeNacharbeitBegleitscheinAction(input))).toMatchObject({code:'OK',data:{replayed:true}});expect(sends).toBe(responseLost==='confirm'?2:1);
  expect(await withSession(sender,()=>sendeNacharbeitBegleitscheinAction({...input,body:input.body+' TEST changed'}))).not.toMatchObject({code:'OK'});
  expect(sends).toBe(responseLost==='confirm'?2:1);
 }finally{vi.restoreAllMocks();for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});
