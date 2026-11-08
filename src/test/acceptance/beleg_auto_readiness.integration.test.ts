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
