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

const belegTenant=vi.hoisted(()=>`test-ba-${crypto.randomUUID()}`);
vi.mock('@/lib/tenant',async original=>({...await original<typeof import('@/lib/tenant')>(),KREILE_TENANT_SLUG:belegTenant}));

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
    displayName: "TEST BelegAuto",
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
        'TEST BelegAuto', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
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
        ${customerId}, ${KREILE_TENANT_SLUG}, ${`H18-W-${customerId.slice(0, 8)}`}, 'TEST BelegAutokunde', 'TEST BelegAutokunde GmbH', 'business', 'Ada Werkstatt', ${`werkstatt-${customerId}@local.invalid`}, '+49 711 5550192', (SELECT street FROM private.kunde_split_street('Werkstattweg 18')), '70178', 'Stuttgart', private.kunde_land_schluessel('Deutschland'), 'rechnung', true, 14, 'manual', (SELECT first_name FROM private.kunde_split_name('Ada Werkstatt')), (SELECT last_name FROM private.kunde_split_name('Ada Werkstatt')), (SELECT salutation FROM private.kunde_split_name('Ada Werkstatt')), (SELECT house_number FROM private.kunde_split_street('Werkstattweg 18'))
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


afterAll(async()=>{await sql.end({timeout:1});if(originalSecret===undefined)delete process.env.APP_SESSION_SECRET;else process.env.APP_SESSION_SECRET=originalSecret;});

it('BA readiness reads secure persisted invoice facts through the real Action without creating a booking',async()=>{
 const {fixture,itemId,fileId}=await secureSource();
 const {getIncomingInvoiceAction}=await import('@/app/actions/eingang.actions');
 const view=await withSession(fixture,()=>getIncomingInvoiceAction({id:itemId}));
 expect(view).toMatchObject({code:'OK',view:{invoice:null,fields:{lieferantId:fixture.customerId,nummer:'TEST-BA-42',datum:'2026-11-08',faelligAm:'2026-11-22'},automation:{state:'ready',missing:[]}}});
 expect(await sql`SELECT id FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual([]);
 expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND art<>'original_gespeichert'`).toEqual([]);
 await sql`INSERT INTO public.intake_suggestion(id,tenant_id,item_id,file_id,feld,wert,sicherheit,status) VALUES(${randomUUID()}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${fileId}::uuid,'rechnung.nummer',${sql.json('TEST-BA-CONFLICT')},'sicher','offen')`;
 expect(await withSession(fixture,()=>getIncomingInvoiceAction({id:itemId}))).toMatchObject({code:'OK',view:{automation:{state:'incomplete',missing:expect.arrayContaining(['Nummer widersprüchlich erkannt'])}}});
 await expect(sql`UPDATE public.intake_file SET sha256=${'e'.repeat(64)} WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fileId}::uuid`).rejects.toThrow('INTAKE_ORIGINAL_IMMUTABLE');
 const emptyId=randomUUID();
 await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,kunde_id,zuordnung,einsatz,anliegen,anliegen_offen) VALUES(${emptyId}::uuid,${KREILE_TENANT_SLUG},${emptyId},'notiz','rein','app',${fixture.actorId}::uuid,${fixture.customerId},'hand','offen',ARRAY['rechnung'],ARRAY['rechnung'])`;
 expect(await withSession(fixture,()=>getIncomingInvoiceAction({id:emptyId}))).toMatchObject({code:'OK',view:{automation:{state:'incomplete',missing:expect.arrayContaining(['Gesichertes Original fehlt'])}}});
});

async function secureSource(areas?:string[]){
 const fixture=await createFixture(areas);
 await sql`UPDATE public.customers SET type='lieferant',zahlungsziel_tage=14,payment_preference=NULL,vat_id=NULL,billing_email=NULL,handover_preference=NULL WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fixture.customerId}`;
 const itemId=randomUUID(),fileId=randomUUID(),hash='d'.repeat(64);
 await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,kunde_id,zuordnung,einsatz,anliegen,anliegen_offen) VALUES(${itemId}::uuid,${KREILE_TENANT_SLUG},${itemId},'notiz','rein','app',${fixture.actorId}::uuid,${fixture.customerId},'hand','offen',ARRAY['rechnung'],ARRAY['rechnung'])`;
 // Isolated TEST original metadata, not a real camera/Storage/OCR success claim.
 await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status) VALUES(${fileId}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${fileId},'anhang','TEST Beleg.jpg','image/jpeg',32,${hash},${KREILE_TENANT_SLUG+'/'+hash},now(),${fixture.actorId}::uuid,1,true,false,'fertig')`;
 await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,'original_gespeichert',${fileId}::uuid,${fixture.actorId},${sql.json({fileId,sha256:hash,bytes:32})})`;
 for(const [field,value]of [['rechnung.nummer','TEST-BA-42'],['rechnung.datum','2026-11-08'],['rechnung.betrag',{netto:'100.00',ust:'19.00',brutto:'119.00'}]] as const)await sql`INSERT INTO public.intake_suggestion(id,tenant_id,item_id,file_id,feld,wert,sicherheit,status) VALUES(${randomUUID()}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${fileId}::uuid,${field},${sql.json(value)},'sicher','offen')`;
 return {fixture,itemId,fileId};
}

it('BA01/03/06 automatic mode uses the actual existing invoice Action once, preserves originals and refuses unsafe or unauthorized writes',async()=>{
 const {getIncomingInvoiceAction,saveIncomingInvoiceAction}=await import('@/app/actions/eingang.actions');
 const {fixture,itemId,fileId}=await secureSource();
 const read=await withSession(fixture,()=>getIncomingInvoiceAction({id:itemId}));if(read.code!=='OK')throw Error(read.message);
 const input={automatic:true as const,itemId,fileId,version:read.view.item.version,clientKey:randomUUID(),fields:read.view.fields,status:'offen' as const,paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:null};
 expect(await withSession(fixture,()=>saveIncomingInvoiceAction({...input,fields:{...input.fields,brutto:'0.01'}}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT id FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid`).toHaveLength(0);
 const saved=await withSession(fixture,()=>saveIncomingInvoiceAction(input));expect(saved).toMatchObject({code:'OK',invoice:{item_id:itemId,file_id:fileId,brutto:'119.00',zahlstatus:'offen'},replayed:false});if(saved.code!=='OK')throw Error(saved.message);
 expect(await sql`SELECT id FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid`).toHaveLength(1);
 expect(await sql`SELECT von FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND art='einsatz' AND befehl_id=${input.clientKey}::uuid`).toEqual([{von:fixture.actorId}]);
 expect(await withSession(fixture,()=>saveIncomingInvoiceAction(input))).toMatchObject({code:'OK',replayed:true,invoice:{id:saved.invoice.id}});
 expect(await withSession(fixture,()=>getIncomingInvoiceAction({id:itemId}))).toMatchObject({code:'OK',view:{invoice:{id:saved.invoice.id,zahlstatus:'offen'},automation:{state:'stored'},originals:[expect.objectContaining({id:fileId})]}});
 const denied=await secureSource(['eingang','kunden']);expect(await withSession(denied.fixture,()=>saveIncomingInvoiceAction({...input,itemId:denied.itemId,fileId:denied.fileId,clientKey:randomUUID()}))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT id FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${denied.itemId}::uuid`).toHaveLength(0);
 const incomplete=await secureSource();await sql`INSERT INTO public.intake_suggestion(id,tenant_id,item_id,file_id,feld,wert,sicherheit,status) VALUES(${randomUUID()}::uuid,${KREILE_TENANT_SLUG},${incomplete.itemId}::uuid,${incomplete.fileId}::uuid,'rechnung.betrag',${sql.json({netto:'100.00',ust:'19.00',brutto:'1.00'})},'sicher','offen')`;
 expect(await withSession(incomplete.fixture,()=>saveIncomingInvoiceAction({...input,itemId:incomplete.itemId,fileId:incomplete.fileId,clientKey:randomUUID(),fields:{...input.fields,lieferantId:incomplete.fixture.customerId}}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT id FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${incomplete.itemId}::uuid`).toHaveLength(0);
});

it('BA02 actual undo and rebook preserve one canonical invoice and both historical receipts while reopening the source',async()=>{
 const {fixture,itemId,fileId}=await secureSource(),{getIncomingInvoiceAction,saveIncomingInvoiceAction,changeIncomingInvoiceStatusAction}=await import('@/app/actions/eingang.actions');
 const initial=await withSession(fixture,()=>getIncomingInvoiceAction({id:itemId}));if(initial.code!=='OK')throw Error(initial.message);
 const saved=await withSession(fixture,()=>saveIncomingInvoiceAction({itemId,fileId,version:initial.view.item.version,clientKey:randomUUID(),automatic:true,fields:initial.view.fields,status:'offen',paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:null}));if(saved.code!=='OK')throw Error(saved.message);
 const undo={command:'undo',invoiceId:saved.invoice.id,version:saved.invoice.version,clientKey:randomUUID(),result:'ungueltig',paidDate:null,proofFileId:null,duplicateId:null,reason:'TEST Betrag falsch erkannt',fields:null};
 const undone=await withSession(fixture,()=>changeIncomingInvoiceStatusAction(undo));expect(undone).toMatchObject({code:'OK',invoice:{id:saved.invoice.id,zahlstatus:'ungueltig',brutto:'119.00',version:2}});
 expect(await withSession(fixture,()=>changeIncomingInvoiceStatusAction(undo))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT einsatz,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`).toEqual([{einsatz:'offen',anliegen_offen:['rechnung']}]);
 expect(await withSession(fixture,()=>getIncomingInvoiceAction({id:itemId}))).toMatchObject({code:'OK',view:{canRebook:true,canUndo:false,invoice:{id:saved.invoice.id,zahlstatus:'ungueltig'},originals:[expect.objectContaining({id:fileId})]}});
 const rebook={command:'rebook',invoiceId:saved.invoice.id,version:2,clientKey:randomUUID(),result:'offen',paidDate:null,proofFileId:null,duplicateId:null,reason:null,fields:{...initial.view.fields,netto:'200.00',ust:'38.00',brutto:'238.00'}};
 expect(await withSession(fixture,()=>changeIncomingInvoiceStatusAction(rebook))).toMatchObject({code:'OK',invoice:{id:saved.invoice.id,zahlstatus:'offen',brutto:'238.00',version:3}});
 expect(await withSession(fixture,()=>changeIncomingInvoiceStatusAction(rebook))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT id FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid`).toHaveLength(1);
 expect(await sql`SELECT nachher->>'command' AS command,vorher->>'brutto' AS before,nachher->'invoice'->>'brutto' AS after,von FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND befehl_id=ANY(${[undo.clientKey,rebook.clientKey]}::uuid[]) ORDER BY zeit,id`).toEqual([{command:'rechnung.rueckgaengig',before:'119.00',after:'119.00',von:fixture.actorId},{command:'rechnung.neu_ablegen',before:'119.00',after:'238.00',von:fixture.actorId}]);
 expect(await withSession(fixture,()=>getIncomingInvoiceAction({id:itemId}))).toMatchObject({code:'OK',view:{canUndo:true,canRebook:false,invoice:{id:saved.invoice.id,zahlstatus:'offen',brutto:'238.00'}}});
 expect(await sql`SELECT einsatz,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`).toEqual([{einsatz:'erledigt',anliegen_offen:[]}]);
});

it('BA04 duplicate source links its secured original to the same invoice and opens both original owners without a second booking',async()=>{
 const {getIncomingInvoiceAction,saveIncomingInvoiceAction}=await import('@/app/actions/eingang.actions');
 const first=await secureSource();const initial=await withSession(first.fixture,()=>getIncomingInvoiceAction({id:first.itemId}));if(initial.code!=='OK')throw Error(initial.message);
 const booked=await withSession(first.fixture,()=>saveIncomingInvoiceAction({itemId:first.itemId,fileId:first.fileId,version:1,clientKey:randomUUID(),automatic:true,fields:initial.view.fields,status:'offen',paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:null}));if(booked.code!=='OK')throw Error(booked.message);
 const second=await secureSource();await sql`UPDATE public.intake_item SET kunde_id=${first.fixture.customerId} WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${second.itemId}::uuid`;
 const duplicate=await withSession(second.fixture,()=>getIncomingInvoiceAction({id:second.itemId}));expect(duplicate).toMatchObject({code:'OK',view:{duplicate:{id:booked.invoice.id},automation:{state:'duplicate'}}});if(duplicate.code!=='OK')throw Error(duplicate.message);
 const input={attachOriginal:true,itemId:second.itemId,fileId:second.fileId,version:duplicate.view.item.version,clientKey:randomUUID(),fields:duplicate.view.fields,status:'doppelt',paidDate:null,proofFileId:null,duplicateId:booked.invoice.id,duplicateReason:null,unclearReason:null};
 expect(await withSession(second.fixture,()=>saveIncomingInvoiceAction(input))).toMatchObject({code:'OK',invoice:{id:booked.invoice.id,zahlstatus:'offen',brutto:'119.00',version:2}});
 expect(await withSession(second.fixture,()=>saveIncomingInvoiceAction(input))).toMatchObject({code:'OK',replayed:true,invoice:{id:booked.invoice.id}});
 expect(await sql`SELECT id FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=ANY(${[first.itemId,second.itemId]}::uuid[])`).toHaveLength(1);
 expect(await sql`SELECT von,nachher->'originalIds' AS originals FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${second.itemId}::uuid AND nachher->>'command'='rechnung.original_zugeordnet'`).toEqual([{von:second.fixture.actorId,originals:[second.fileId]}]);
 expect(await sql`SELECT id::text,item_id::text FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=ANY(${[first.fileId,second.fileId]}::uuid[]) ORDER BY id`).toEqual([{id:first.fileId,item_id:first.itemId},{id:second.fileId,item_id:second.itemId}].sort((a,b)=>a.id.localeCompare(b.id)));
 for(const id of [booked.invoice.id,second.itemId])expect(await withSession(second.fixture,()=>getIncomingInvoiceAction({id}))).toMatchObject({code:'OK',view:{invoice:{id:booked.invoice.id,zahlstatus:'offen'},originals:expect.arrayContaining([expect.objectContaining({id:first.fileId,itemId:first.itemId}),expect.objectContaining({id:second.fileId,itemId:second.itemId})])}});
 expect(await sql`SELECT einsatz,vorgang_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${second.itemId}::uuid`).toEqual([{einsatz:'erledigt',vorgang_id:booked.invoice.id}]);
 const fallback=await secureSource();await sql`UPDATE public.intake_item SET kunde_id=${first.fixture.customerId} WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fallback.itemId}::uuid`;await sql`UPDATE public.intake_suggestion SET status='verworfen' WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${fallback.itemId}::uuid AND feld='rechnung.nummer'`;
 const fallbackView=await withSession(fallback.fixture,()=>getIncomingInvoiceAction({id:fallback.itemId}));expect(fallbackView).toMatchObject({code:'OK',view:{fields:{nummer:''},duplicate:{id:booked.invoice.id}}});if(fallbackView.code!=='OK')throw Error(fallbackView.message);
 expect(await withSession(fallback.fixture,()=>saveIncomingInvoiceAction({...input,itemId:fallback.itemId,fileId:fallback.fileId,version:fallbackView.view.item.version,clientKey:randomUUID(),fields:fallbackView.view.fields}))).toMatchObject({code:'OK',invoice:{id:booked.invoice.id,version:3}});
 expect(await sql`SELECT id FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND lieferant_id=${first.fixture.customerId}`).toHaveLength(1);

});

it('BA05 reads the direct invoice action label from secure source evidence, never a guessed number',async()=>{
 const {fixture,itemId}=await secureSource(['eingang','kunden','geld','mails']);const {getIntakeMessagesAction}=await import('@/app/actions/eingang.actions');
 const read=await withSession(fixture,()=>getIntakeMessagesAction('offen'));expect(read).toMatchObject({code:'OK',messages:expect.arrayContaining([expect.objectContaining({id:itemId,invoiceNumber:'TEST-BA-42'})])});if(read.code!=='OK')throw Error(read.message);
 expect(await sql`SELECT id FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid`).toHaveLength(0);
});
