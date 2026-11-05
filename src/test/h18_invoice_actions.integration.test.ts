// @vitest-environment node

import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";
import {withLocalReplayStorage} from './localReplayStorage';
import type {InvoiceSaveInput,InvoiceChangeInput} from '@/modules/eingang/public';

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.H18_EXPECTED_DATABASE_URL;
if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("H18_INVOICE_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("H18_INVOICE_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("H18_INVOICE_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "h18-invoice-actions-local-only";

type Fixture = {
  actorId: string;
  actorIssuedAt: number;
  customerId: string;
  freezeId: string;
  rateId: string;
};

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/h18-invoice-actions", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/h18-invoice-actions",
    route: "/h18-invoice-actions",
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
    { pathname: "/h18-invoice-actions", search: "" },
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
    displayName: "Rolf H18 Rechnung",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work);
}

async function createFixture(): Promise<Fixture> {
  const actorId = randomUUID();
  const customerId = randomUUID();
  const settingsId = randomUUID();
  const freezeId = randomUUID();
  const rateId = randomUUID();
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES (
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`rolf-h18-invoice-${actorId}@local.invalid`},
        'Rolf H18 Rechnung', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(ARRAY['eingang', 'auftraege', 'kunden', 'geld']::text[]) area
    `;
    await transaction`
      INSERT INTO public.company_settings (
        id, tenant_id, company_name, street, zip, city, country,
        iban, bic, bank_name, tax_id, invoice_vat_rate_basis_points,
        invoice_payment_term_days
      ) SELECT
        ${settingsId}, ${KREILE_TENANT_SLUG}, 'H18 Galvanik Kreile',
        'Pruefstrasse 18', '70173', 'Stuttgart', 'Deutschland',
        'DE02120300000000202051', 'BYLADEM1001', 'H18 Testbank',
        'DE-H18-INVOICE', 1900, 14
      WHERE NOT EXISTS (
        SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG}
      )
    `;
    await transaction`
      UPDATE public.company_settings
      SET company_name='H18 Galvanik Kreile', street='Pruefstrasse 18', zip='70173',
        city='Stuttgart', country='Deutschland', iban='DE02120300000000202051',
        bic='BYLADEM1001', bank_name='H18 Testbank', tax_id='DE-H18-INVOICE',
        invoice_vat_rate_basis_points=1900, invoice_payment_term_days=14
      WHERE tenant_id=${KREILE_TENANT_SLUG}
    `;
    await transaction`
      INSERT INTO public.customers (
        id, tenant_id, customer_number, name, company_name, type, contact_person, email, phone, street, zip_code, city, country, payment_preference, ziel_freigeschaltet, source, first_name, last_name, salutation, house_number
      ) VALUES (
        ${customerId}, ${KREILE_TENANT_SLUG}, ${`H18-R-${customerId.slice(0, 8)}`}, 'H18 Rechnungskunde', 'H18 Rechnungskunde GmbH', 'business', 'Ada Rechnung', ${`rechnung-${customerId}@local.invalid`}, '+49 711 5550188', (SELECT street FROM private.kunde_split_street('Kundenweg 18')), '70174', 'Stuttgart', private.kunde_land_schluessel('Deutschland'), 'vorkasse', false, 'manual', (SELECT first_name FROM private.kunde_split_name('Ada Rechnung')), (SELECT last_name FROM private.kunde_split_name('Ada Rechnung')), (SELECT salutation FROM private.kunde_split_name('Ada Rechnung')), (SELECT house_number FROM private.kunde_split_street('Kundenweg 18'))
      )
    `;
  });
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id = ${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("H18_INVOICE_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt, customerId, freezeId, rateId };
}

beforeAll(async () => {
  const migrations = await sql<{ version: string }[]>`
    SELECT version::text FROM supabase_migrations.schema_migrations ORDER BY version
  `;
  const repositoryMigrations = readdirSync(join(process.cwd(), "supabase", "migrations"))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .map((file) => file.slice(0, file.indexOf("_")))
    .sort();
  expect(migrations.map((row) => row.version)).toEqual(repositoryMigrations);
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSecret;
});

/** AP-EIN R02/R04/R07/R08/R12/R13: fixed model outcomes, real actions and real Replay rows. */
async function incomingFixture(){
 const actor=await createFixture(),itemId=randomUUID(),fileId=randomUUID();
 await sql`UPDATE public.customers SET type='lieferant',name='SYNTHETISCH Lieferant Rechnung',iban=NULL,zahlungsziel_tage=14,payment_preference=NULL,vat_id=NULL,billing_email=NULL,handover_preference=NULL WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${actor.customerId}`;
 const bytes=Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=','base64');
 const hash=createHash('sha256').update(bytes).digest('hex'),storagePath=KREILE_TENANT_SLUG+'/'+hash;
 await withLocalReplayStorage(async()=>{const{createAdminClient}=await import('@/lib/supabase/admin');const upload=await createAdminClient().storage.from('scans').upload(storagePath,bytes,{contentType:'image/jpeg',upsert:true});if(upload.error)throw upload.error;});
 await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,kunde_id,zuordnung,anliegen,anliegen_offen)
  VALUES(${itemId}::uuid,${KREILE_TENANT_SLUG},${itemId},'notiz','rein','app',${actor.actorId}::uuid,${actor.customerId},'hand',ARRAY['rechnung'],ARRAY['rechnung'])`;
 await sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status)
  VALUES(${fileId}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${fileId},'anhang','SYNTHETISCH-Rechnung.jpg','image/jpeg',${bytes.length},${hash},${storagePath},statement_timestamp(),${actor.actorId}::uuid,1,true,false,'fertig')`;
 await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,'original_gespeichert',${fileId}::uuid,${actor.actorId},${sql.json({fileId,sha256:hash,bytes:bytes.length})})`;
 const input:InvoiceSaveInput={itemId,fileId,version:1,clientKey:randomUUID(),fields:{lieferantId:actor.customerId,nummer:'SYNTHETISCH-'+itemId,datum:'2026-11-01',netto:'100,00',ust:'19,00',brutto:'119,00',faelligAm:'2026-11-15',iban:'DE02120300000000202051',ibanGeprueft:true},status:'offen',paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:null};
 return {actor,input};
}
describe('AP-EIN incoming invoice real UI actions -> rows/events -> same read model',()=>{
 it('3.8 Geld alone: original access stays limited to invoice attachments; new supplier uses the same customer/assignment writer',async()=>{
  const {actor,input}=await incomingFixture();
  await sql`DELETE FROM public.app_user_rights WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${actor.actorId}::uuid AND bereich<>'geld'`;
  await sql`UPDATE public.intake_item SET kanal='mail',text='SYNTHETISCH Mailinhalt bleibt geschützt',kunde_id=NULL,zuordnung='offen' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.itemId}::uuid`;
  const {getIncomingInvoiceAction,openIntakeOriginalAction,confirmIntakeOriginalAction,createCustomerForIntakeAction,getIntakeCaptureAction,prepareIntakeFileAction,finishIntakeFileAction,saveIncomingInvoiceAction}=await import('@/app/actions/eingang.actions');
  expect(await withSession(actor,()=>getIntakeCaptureAction(input.itemId))).toMatchObject({code:'FORBIDDEN'});
  const opened=await withLocalReplayStorage(()=>withSession(actor,()=>openIntakeOriginalAction({fileId:input.fileId,clientEventId:randomUUID()})));
  expect(opened).toMatchObject({code:'OK',original:{invoiceOnly:true,restricted:false,itemId:input.itemId,orderId:null,sha256:expect.any(String),url:expect.any(String)}});
  expect(await sql`SELECT geoeffnet FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.fileId}::uuid`).toEqual([{geoeffnet:true}]);
  const suggestionId=randomUUID();await sql`INSERT INTO public.intake_suggestion(id,tenant_id,item_id,file_id,feld,wert,sicherheit,status) VALUES(${suggestionId}::uuid,${KREILE_TENANT_SLUG},${input.itemId}::uuid,${input.fileId}::uuid,'rechnung.nummer',${sql.json(input.fields.nummer)},'unsicher','offen')`;
  expect(await withSession(actor,()=>confirmIntakeOriginalAction({fileId:input.fileId,clientEventId:randomUUID()}))).toMatchObject({code:'OK',count:1});
  expect(await sql`SELECT geprueft_von::text AS actor FROM public.intake_suggestion WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${suggestionId}::uuid`).toEqual([{actor:actor.actorId}]);
  const create={itemId:input.itemId,version:1,customer:{clientEventId:randomUUID(),customerType:'lieferant',companyName:'SYNTHETISCH Neuer Lieferant '+input.itemId,country:'DE'}};
  const saved=await withSession(actor,()=>createCustomerForIntakeAction(create));if(saved.code!=='OK')throw Error('INCOMING_SUPPLIER:'+JSON.stringify(saved));
  expect(await sql`SELECT type FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.customer.id}`).toEqual([{type:'lieferant'}]);
  expect(await sql`SELECT kunde_id,version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.itemId}::uuid`).toEqual([{kunde_id:saved.customer.id,version:2}]);
  expect(await withSession(actor,()=>getIncomingInvoiceAction({id:input.itemId}))).toMatchObject({code:'OK',view:{supplier:{id:saved.customer.id},item:{version:2},uncertain:0}});
  const [original]=await sql`SELECT sha256,bytes::int AS bytes FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.fileId}::uuid`,proofId=randomUUID();
  const finished=await withLocalReplayStorage(async()=>{
   expect(await withSession(actor,()=>prepareIntakeFileAction({itemId:randomUUID(),fileId:randomUUID(),name:'SYNTHETISCH-Nachweis.jpg',mime:'image/jpeg',bytes:original.bytes,sha256:original.sha256}))).toMatchObject({code:'FORBIDDEN'});
   const grant=await withSession(actor,()=>prepareIntakeFileAction({itemId:input.itemId,fileId:proofId,name:'SYNTHETISCH-Nachweis.jpg',mime:'image/jpeg',bytes:original.bytes,sha256:original.sha256}));expect(grant).toMatchObject({code:'OK',upload:null});
   return withSession(actor,()=>finishIntakeFileAction(proofId));
  });expect(finished).toMatchObject({code:'OK',capture:{text:null,orderId:null,files:expect.arrayContaining([expect.objectContaining({id:proofId})])}});
  expect(await sql`SELECT nachher->>'fileId' AS file FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid AND art='original_gespeichert' AND befehl_id=${proofId}::uuid`).toEqual([{file:proofId}]);
  const booked=await withSession(actor,()=>saveIncomingInvoiceAction({...input,version:2,fields:{...input.fields,lieferantId:saved.customer.id},status:'bezahlt',paidDate:'2026-11-01',proofFileId:proofId}));
  if(booked.code!=='OK')throw Error('INCOMING_GELD_ONLY_PROOF:'+JSON.stringify(booked));
  expect(await sql`SELECT nachweis_file_id::text,zahlstatus FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${booked.invoice.id}::uuid`).toEqual([{nachweis_file_id:proofId,zahlstatus:'bezahlt'}]);
  expect(await withSession(actor,()=>getIncomingInvoiceAction({id:booked.invoice.id}))).toMatchObject({code:'OK',view:{invoice:{nachweis_file_id:proofId,zahlstatus:'bezahlt'}}});
 },60000);
 it('R02/R08/R11 captures once, updates status on the same row, persists IBAN through the customer writer, and rereads',async()=>{
  const {actor,input}=await incomingFixture();
  const {saveIncomingInvoiceAction,getIncomingInvoiceAction,changeIncomingInvoiceStatusAction,searchInvoiceSuppliersAction}=await import('@/app/actions/eingang.actions');
  const read=await withSession(actor,()=>getIncomingInvoiceAction({id:input.itemId}));expect(read).toMatchObject({code:'OK',view:{invoice:null,item:{id:input.itemId,version:1},supplier:{id:actor.customerId}}});
  expect(await withSession(actor,()=>searchInvoiceSuppliersAction('SYNTHETISCH Lieferant Rechnung'))).toMatchObject({code:'OK',suppliers:expect.arrayContaining([expect.objectContaining({id:actor.customerId})])});
  const saved=await withSession(actor,()=>saveIncomingInvoiceAction(input));if(saved.code!=='OK')throw Error('INCOMING_R02:'+JSON.stringify(saved));
  expect(await sql`SELECT item_id::text,file_id::text,nummer,netto::text,ust::text,brutto::text,zahlstatus,version FROM public.supplier_invoice WHERE id=${saved.invoice.id}::uuid AND tenant_id=${KREILE_TENANT_SLUG}`).toEqual([{item_id:input.itemId,file_id:input.fileId,nummer:input.fields.nummer,netto:'100.00',ust:'19.00',brutto:'119.00',zahlstatus:'offen',version:1}]);
  expect(await sql`SELECT einsatz,vorgang_art,vorgang_id,kunde_id FROM public.intake_item WHERE id=${input.itemId}::uuid AND tenant_id=${KREILE_TENANT_SLUG}`).toEqual([{einsatz:'erledigt',vorgang_art:'rechnung',vorgang_id:saved.invoice.id,kunde_id:actor.customerId}]);
  expect(await sql`SELECT iban FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${actor.customerId}`).toEqual([{iban:input.fields.iban}]);
  expect(await sql`SELECT art,nachher->>'command' AS command FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid AND befehl_id=${input.clientKey}::uuid`).toEqual([{art:'einsatz',command:'rechnung.erfassen'}]);
  expect(await withSession(actor,()=>saveIncomingInvoiceAction(input))).toEqual({...saved,replayed:true});
  const changed:InvoiceChangeInput={invoiceId:saved.invoice.id,version:1,clientKey:randomUUID(),result:'bezahlt',paidDate:'2026-11-01',proofFileId:input.fileId,duplicateId:null,reason:null,fields:null};
  const paid=await withSession(actor,()=>changeIncomingInvoiceStatusAction(changed));expect(paid).toMatchObject({code:'OK',invoice:{id:saved.invoice.id,zahlstatus:'bezahlt',bezahlt_am:'2026-11-01',version:2}});
  expect(await withSession(actor,()=>changeIncomingInvoiceStatusAction(changed))).toEqual({...paid,replayed:true});
  expect(await sql`SELECT count(*)::int AS n FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid`).toEqual([{n:1}]);
  expect(await withSession(actor,()=>getIncomingInvoiceAction({id:saved.invoice.id}))).toMatchObject({code:'OK',view:{invoice:{id:saved.invoice.id,zahlstatus:'bezahlt',version:2}}});
  expect((await sql`SELECT text FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND kunde_id=${actor.customerId} AND verweis_item=${input.itemId}::uuid`).map(row=>row.text)).toEqual(expect.arrayContaining([expect.stringContaining('offen'),expect.stringContaining('bezahlt')]));
 },60000);
 it('R04/R07 unclear invoice and one Geld task are atomic; clarification completes that same task and records before/after',async()=>{
  const {actor,input}=await incomingFixture();
  const {saveIncomingInvoiceAction,clarifyIncomingInvoiceAction,getIncomingInvoiceAction,getIntakeTaskAction,completeIntakeTaskAction}=await import('@/app/actions/eingang.actions');
  const saved=await withSession(actor,()=>saveIncomingInvoiceAction({...input,status:'unklar',unclearReason:'SYNTHETISCH Betrag am Original prüfen'}));if(saved.code!=='OK')throw Error('INCOMING_R04:'+JSON.stringify(saved));
  expect(saved.invoice).toMatchObject({zahlstatus:'unklar',unklar_grund:'SYNTHETISCH Betrag am Original prüfen',aufgabe_id:expect.any(String)});
  const taskId=saved.invoice.aufgabe_id!;
  expect(await sql`SELECT art,fuer_bereich,status,bezug_typ,bezug_id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${taskId}::uuid`).toEqual([{art:'rechnung',fuer_bereich:'geld',status:'offen',bezug_typ:'eingangsrechnung',bezug_id:saved.invoice.id}]);
  expect(await withSession(actor,()=>getIntakeTaskAction({taskId}))).toMatchObject({code:'OK',canComplete:false,reference:{type:'eingangsrechnung',id:saved.invoice.id},task:{status:'offen'}});
  expect(await withSession(actor,()=>completeIntakeTaskAction({taskId,version:1,note:null}))).toMatchObject({code:'FORBIDDEN'});
  const change:InvoiceChangeInput={invoiceId:saved.invoice.id,version:1,clientKey:randomUUID(),result:'ungueltig',paidDate:null,proofFileId:null,duplicateId:null,reason:'SYNTHETISCH keine gültige Rechnung',fields:null};
  const result=await withSession(actor,()=>clarifyIncomingInvoiceAction(change));if(result.code!=='OK')throw Error('INCOMING_R07:'+JSON.stringify(result));
  expect(await sql`SELECT zahlstatus,ungueltig_grund,version FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.invoice.id}::uuid`).toEqual([{zahlstatus:'ungueltig',ungueltig_grund:change.reason,version:2}]);
  expect(await sql`SELECT status,version FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${taskId}::uuid`).toEqual([{status:'erledigt',version:2}]);
  expect(await sql`SELECT vorher->>'zahlstatus' AS before,nachher->'invoice'->>'zahlstatus' AS after FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid AND befehl_id=${change.clientKey}::uuid`).toEqual([{before:'unklar',after:'ungueltig'}]);
  expect(await withSession(actor,()=>clarifyIncomingInvoiceAction(change))).toEqual({...result,replayed:true});
  expect(await withSession(actor,()=>getIncomingInvoiceAction({id:saved.invoice.id}))).toMatchObject({code:'OK',view:{invoice:{zahlstatus:'ungueltig',version:2}}});
 },60000);
 it('R03/R10 rejects missing fields and Geld-less calls before a row, source mutation, or event; stale data also remains intact',async()=>{
  const {actor,input}=await incomingFixture();const {saveIncomingInvoiceAction,getIncomingInvoiceAction}=await import('@/app/actions/eingang.actions');
  expect(await withSession(actor,()=>saveIncomingInvoiceAction({...input,fields:{...input.fields,nummer:''}}))).toMatchObject({code:'VALIDATION_ERROR',fields:{nummer:expect.any(String)}});
  expect(await withSession(actor,()=>saveIncomingInvoiceAction({...input,version:2}))).toMatchObject({code:'CONFLICT'});
  await sql`DELETE FROM public.app_user_rights WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${actor.actorId}::uuid AND bereich='geld'`;
  expect(await withSession(actor,()=>saveIncomingInvoiceAction(input))).toMatchObject({code:'FORBIDDEN'});
  expect(await withSession(actor,()=>getIncomingInvoiceAction({id:input.itemId}))).toMatchObject({code:'FORBIDDEN'});
  expect(await sql`SELECT id FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid`).toHaveLength(0);
  expect(await sql`SELECT version,einsatz FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.itemId}::uuid`).toEqual([{version:1,einsatz:'offen'}]);
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid AND art<>'original_gespeichert'`).toHaveLength(0);
 },60000);
});

describe("H18 invoice Server Actions against the real replay database", () => {
  it("sets prices, issues and cancels through the UI actions with DB, event, view and PDF readback", async () => {
    const fixture = await createFixture();
    const intakeClientEventId = randomUUID();
    const priceClientEventId = randomUUID();
    const issueClientEventId = randomUUID();
    const cancelClientEventId = randomUUID();
    const freezeEventId = randomUUID();
    const freezeClientEventId = randomUUID();
    const freezeCorrelationId = randomUUID();
    const legacyInvoiceId = randomUUID();

    const [numberBoundary] = await sql<{
      invoice_year: number;
      existing_max: string;
      sequence_last: number | null;
    }[]>`
      WITH invoice_clock AS (
        SELECT extract(year FROM clock_timestamp() AT TIME ZONE 'Europe/Berlin')::integer AS invoice_year
      )
      SELECT invoice_clock.invoice_year,
        coalesce((
          SELECT max(substring(invoice.invoice_number FROM
            ('^R-' || invoice_clock.invoice_year::text || '-([0-9]{4,})$'))::numeric)::text
          FROM public.invoices invoice
          WHERE invoice.tenant_id=${KREILE_TENANT_SLUG}
            AND invoice.invoice_number ~
              ('^R-' || invoice_clock.invoice_year::text || '-([0-9]{4,})$')
        ), '0') AS existing_max,
        (
          SELECT sequence.last_number
          FROM private.invoice_number_sequences sequence
          WHERE sequence.tenant_id=${KREILE_TENANT_SLUG}
            AND sequence.invoice_year=invoice_clock.invoice_year
        ) AS sequence_last
      FROM invoice_clock
    `;
    if (!numberBoundary) throw new Error("H18_INVOICE_NUMBER_BOUNDARY_MISSING");
    const legacySuffix = Math.max(
      10_000,
      Number(numberBoundary.existing_max),
      numberBoundary.sequence_last ?? 0,
    ) + 100;
    if (!Number.isSafeInteger(legacySuffix) || legacySuffix > 2_147_483_646) {
      throw new Error("H18_INVOICE_NUMBER_BOUNDARY_INVALID");
    }
    await sql`
      INSERT INTO public.invoices (id, tenant_id, invoice_number, amount_total, status)
      VALUES (
        ${legacyInvoiceId}::uuid,
        ${KREILE_TENANT_SLUG},
        ${`R-${numberBoundary.invoice_year}-${legacySuffix}`},
        0,
        'draft'
      )
    `;

    const { createOrderIntakeAction } = await import("@/app/actions/eingang.actions");
    const intake = await withSession(fixture, () => createOrderIntakeAction({ geprueft: true,
      clientEventId: intakeClientEventId,
      customer: { mode: "EXISTING", customerId: fixture.customerId },
      dueDate: "2027-03-31",
      termStatus: "bestaetigt",
      intakeSource: "persoenlich",
      handoverMode: "pickup",
      paymentMode: "vorkasse",
      note: "H18 Rechnungslauf",
      items: [{
        catalogServiceId: null,
        name: "H18 Rechnungsteil",
        quantity: 2,
        material: "Stahl",
        surfaceRequested: "Verchromen",
        executionRequested: "offen",
        unit: null,
        unitPriceCents: null,
        vatRateBasisPoints: null,
      }],
    }));
    if (intake.code !== "OK") throw new Error(`H18_INVOICE_INTAKE_FAILED:${intake.code}:${intake.message}`);
    expect(intake.code).toBe("OK");
    const itemId = intake.receipt.items[0]?.id;
    if (!itemId) throw new Error("H18_INVOICE_ITEM_MISSING");

    await sql.begin(async (transaction) => {
      await transaction`
        UPDATE public.orders
        SET station='fertig', current_station='fertig', current_station_id='fertig',
            status='fertig', version=2
        WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${intake.receipt.orderId}
      `;
      await transaction`
        UPDATE public.items SET current_station_id='fertig'
        WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}
      `;
      await transaction`
        INSERT INTO private.extra_work_hourly_rates
          (id, tenant_id, hourly_rate_cents, version, created_by, effective_at)
        SELECT ${fixture.rateId}::uuid, ${KREILE_TENANT_SLUG}, 12000,
          coalesce(max(version), 0) + 1, ${fixture.actorId}::uuid, now()
        FROM private.extra_work_hourly_rates
        WHERE tenant_id=${KREILE_TENANT_SLUG}
      `;
      await transaction`
        INSERT INTO public.events (
          id, tenant_id, order_id, event_type, description, user_id, payload,
          status, station, client_event_id, event_schema_version,
          correlation_id, aggregate_version, from_station
        ) VALUES (
          ${freezeEventId}, ${KREILE_TENANT_SLUG}, ${intake.receipt.orderId},
          'ORDER_FROZEN_V1', 'H18 Auftrag fertiggestellt', ${fixture.actorId}::uuid,
          ${transaction.json({
            freezeId: fixture.freezeId,
            rateId: fixture.rateId,
            hourlyRateCents: 12000,
            totalAmountCents: 0,
            lineCount: 0,
          })},
          'success', 'fertig', ${freezeClientEventId}::uuid, 1,
          ${freezeCorrelationId}::uuid, 2, 'galvanik'
        )
      `;
      await transaction`
        INSERT INTO private.order_freezes (
          id, tenant_id, order_id, event_id, hourly_rate_id, hourly_rate_cents,
          total_amount_cents, line_count, order_version, frozen_by, frozen_at
        ) VALUES (
          ${fixture.freezeId}::uuid, ${KREILE_TENANT_SLUG}, ${intake.receipt.orderId},
          ${freezeEventId}, ${fixture.rateId}::uuid, 12000, 0, 0, 2,
          ${fixture.actorId}::uuid, now()
        )
      `;
    });

    const {
      cancelInvoiceAction,
      getInvoiceCancellationReceiptAction,
      getInvoiceReceiptAction,
      getInvoiceSummariesAction,
      issueInvoiceAction,
      setInvoiceItemPricesAction,
    } = await import("@/app/actions/invoices.actions");
    const { getLiveOrderCardAction } = await import("@/app/actions/orders.actions");

    const priced = await withSession(fixture, () => setInvoiceItemPricesAction({
      orderId: intake.receipt.orderId,
      expectedVersion: 2,
      clientEventId: priceClientEventId,
      prices: [{ itemId, unitPriceCents: 12_345 }],
    }));
    expect(priced.code).toBe("OK");
    if (priced.code !== "OK") throw new Error(`H18_INVOICE_PRICE_FAILED:${priced.code}`);
    const [priceRow] = await sql<{
      unit_price_cents: number;
      order_version: number;
      event_type: string;
      actor_id: string;
      event_version: number;
    }[]>`
      SELECT round(item.preis_netto * 100)::integer AS unit_price_cents,
        orders.version AS order_version, event.event_type,
        event.user_id::text AS actor_id, event.aggregate_version AS event_version
      FROM public.items item
      JOIN public.orders orders ON orders.id=item.order_id AND orders.tenant_id=item.tenant_id
      JOIN public.events event ON event.order_id=orders.id AND event.tenant_id=orders.tenant_id
        AND event.client_event_id=${priceClientEventId}::uuid
      WHERE item.id=${itemId} AND item.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(priceRow).toEqual({
      unit_price_cents: 12_345,
      order_version: 3,
      event_type: "ORDER_INVOICE_PRICES_SET_V1",
      actor_id: fixture.actorId,
      event_version: 3,
    });
    const pricedCard = await withSession(fixture, () => getLiveOrderCardAction({ orderId: intake.receipt.orderId }));
    expect(pricedCard.code).toBe("OK");
    if (pricedCard.code === "OK") {
      expect(pricedCard.data.card.version).toBe(3);
      expect(pricedCard.data.card.items).toContainEqual(expect.objectContaining({ id: itemId, unitPriceCents: 12_345 }));
    }

    const issued = await withSession(fixture, () => issueInvoiceAction({
      orderId: intake.receipt.orderId,
      expectedVersion: 3,
      clientEventId: issueClientEventId,
    }));
    expect(issued.code).toBe("OK");
    if (issued.code !== "OK") throw new Error(`H18_INVOICE_ISSUE_FAILED:${issued.code}`);
    expect(issued.receipt.invoiceNumber).toBe(
      `R-${numberBoundary.invoice_year}-${legacySuffix + 1}`,
    );
    const [invoiceRow] = await sql<{
      id: string;
      status: string;
      aggregate_version: number;
      pdf_sha256: string;
      pdf_content: Buffer;
      event_type: string;
      event_count: number;
    }[]>`
      SELECT invoice.id::text, invoice.status, invoice.aggregate_version,
        invoice.pdf_sha256, invoice.pdf_content, event.event_type,
        count(*) OVER ()::integer AS event_count
      FROM public.invoices invoice
      JOIN public.events event ON event.id=invoice.issue_event_id
      WHERE invoice.id=${issued.receipt.invoiceId}::uuid
        AND invoice.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(invoiceRow).toMatchObject({
      id: issued.receipt.invoiceId,
      status: "issued",
      aggregate_version: 1,
      event_type: "INVOICE_CREATED_V1",
      event_count: 1,
      pdf_sha256: issued.receipt.pdfSha256,
    });
    const issueReceipt = await withSession(fixture, () => getInvoiceReceiptAction({
      orderId: intake.receipt.orderId,
      clientEventId: issueClientEventId,
    }));
    expect(issueReceipt).toEqual({ code: "OK", data: issued.receipt });
    const issuedView = await withSession(fixture, () => getInvoiceSummariesAction());
    expect(issuedView.code).toBe("OK");
    if (issuedView.code === "OK") {
      expect(issuedView.data).toContainEqual(expect.objectContaining({ invoiceId: issued.receipt.invoiceId, status: "issued" }));
    }

    const { GET: readInvoicePdfRoute } = await import("@/app/api/invoices/[invoiceId]/pdf/route");
    const originalPdf = await withSession(fixture, () => readInvoicePdfRoute(
      new Request(`http://127.0.0.1/api/invoices/${issued.receipt.invoiceId}/pdf?disposition=inline`),
      { params: Promise.resolve({ invoiceId: issued.receipt.invoiceId }) },
    ));
    expect(originalPdf.status).toBe(200);
    const originalBytes = Buffer.from(await originalPdf.arrayBuffer());
    expect(originalBytes.equals(Buffer.from(invoiceRow!.pdf_content))).toBe(true);
    expect(createHash("sha256").update(originalBytes).digest("hex")).toBe(invoiceRow!.pdf_sha256);

    const cancelled = await withSession(fixture, () => cancelInvoiceAction({
      invoiceId: issued.receipt.invoiceId,
      expectedVersion: 1,
      reason: "H18 vollstaendiger Pruefstorno",
      clientEventId: cancelClientEventId,
    }));
    expect(cancelled.code).toBe("OK");
    if (cancelled.code !== "OK") throw new Error(`H18_INVOICE_CANCEL_FAILED:${cancelled.code}`);
    const [cancelRow] = await sql<{
      status: string;
      aggregate_version: number;
      cancel_reason: string;
      cancellation_pdf_sha256: string;
      cancellation_pdf_content: Buffer;
      event_type: string;
      event_count: number;
    }[]>`
      SELECT invoice.status, invoice.aggregate_version, invoice.cancel_reason,
        invoice.cancellation_pdf_sha256, invoice.cancellation_pdf_content,
        event.event_type, count(*) OVER ()::integer AS event_count
      FROM public.invoices invoice
      JOIN public.events event ON event.id=invoice.cancel_event_id
      WHERE invoice.id=${issued.receipt.invoiceId}::uuid
        AND invoice.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(cancelRow).toMatchObject({
      status: "cancelled",
      aggregate_version: 2,
      cancel_reason: "H18 vollstaendiger Pruefstorno",
      cancellation_pdf_sha256: cancelled.receipt.cancellationPdfSha256,
      event_type: "INVOICE_CANCELLED_V1",
      event_count: 1,
    });
    const cancelReceipt = await withSession(fixture, () => getInvoiceCancellationReceiptAction({
      invoiceId: issued.receipt.invoiceId,
      clientEventId: cancelClientEventId,
    }));
    expect(cancelReceipt).toEqual({ code: "OK", data: cancelled.receipt });
    const cancelledView = await withSession(fixture, () => getInvoiceSummariesAction());
    expect(cancelledView.code).toBe("OK");
    if (cancelledView.code === "OK") {
      expect(cancelledView.data).toContainEqual(expect.objectContaining({ invoiceId: issued.receipt.invoiceId, status: "cancelled", aggregateVersion: 2 }));
    }
    const cancellationPdf = await withSession(fixture, () => readInvoicePdfRoute(
      new Request(`http://127.0.0.1/api/invoices/${issued.receipt.invoiceId}/pdf?kind=cancellation&disposition=inline`),
      { params: Promise.resolve({ invoiceId: issued.receipt.invoiceId }) },
    ));
    expect(cancellationPdf.status).toBe(200);
    const cancellationBytes = Buffer.from(await cancellationPdf.arrayBuffer());
    expect(cancellationBytes.equals(Buffer.from(cancelRow!.cancellation_pdf_content))).toBe(true);
    expect(createHash("sha256").update(cancellationBytes).digest("hex")).toBe(cancelRow!.cancellation_pdf_sha256);
  }, 60_000);
});

// P55/RT03: synthetic XML is stored through the real action and never sent to OCR.
describe('P55 structured electronic invoice originals',()=>{
 const ubl=`<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"><cbc:ID>SYNTH-UBL-1</cbc:ID><cbc:IssueDate>2026-11-04</cbc:IssueDate><cbc:DueDate>2026-11-18</cbc:DueDate><cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode><cac:TaxTotal><cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount></cac:TaxTotal><cac:LegalMonetaryTotal><cbc:TaxExclusiveAmount currencyID="EUR">100.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">119.00</cbc:TaxInclusiveAmount></cac:LegalMonetaryTotal></Invoice>`;
 const cii=`<?xml version="1.0" encoding="UTF-8"?><rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"><rsm:ExchangedDocument><ram:ID>SYNTH-CII-1</ram:ID><ram:IssueDateTime><udt:DateTimeString format="102">20261104</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument><rsm:SupplyChainTradeTransaction><ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode><ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">20261118</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms><ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:TaxBasisTotalAmount>100.00</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">19.00</ram:TaxTotalAmount><ram:GrandTotalAmount>119.00</ram:GrandTotalAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation></ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>`;
 it.each([['UBL',ubl,'SYNTH-UBL-1'],['CII',cii,'SYNTH-CII-1']])('%s uses XML fields and never OCR',async(_format,xml,number)=>withLocalReplayStorage(async()=>{
  const fixture=await createFixture();const azure=await import('@/lib/server/azureDocumentIntelligence');const ocr=vi.spyOn(azure,'analyzeWithAzureDocumentIntelligence');
  try{
   const {prepareIntakeFileAction,finishIntakeFileAction,getIncomingInvoiceAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
   const {uploadIntakeOriginal}=await import('@/modules/eingang/public');const bytes=Buffer.from(xml,'utf8');
   const input={itemId:randomUUID(),fileId:randomUUID(),name:'synthetisch-xrechnung.xml',mime:'application/xml',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
   const grant=await withSession(fixture,()=>prepareIntakeFileAction(input));if(grant.code!=='OK')throw Error('XML_GRANT:'+grant.message);
   if(grant.upload)expect((await uploadIntakeOriginal(grant.upload,new File([Uint8Array.from(bytes).buffer],input.name,{type:input.mime}))).ok).toBe(true);
   const saved=await withSession(fixture,()=>finishIntakeFileAction(input.fileId));expect(saved).toMatchObject({code:'OK',capture:{recognition:{kind:'rechnung'},files:[{id:input.fileId,status:'fertig'}]}});
   expect(await withSession(fixture,()=>getIntakeCaptureAction(input.itemId))).toMatchObject({code:'OK',capture:{recognition:{kind:'rechnung'},concerns:['rechnung']}});
   expect(ocr).not.toHaveBeenCalled();
   expect(await sql`SELECT erkennung_status FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.fileId}::uuid`).toEqual([{erkennung_status:'fertig'}]);
   expect(await withSession(fixture,()=>getIncomingInvoiceAction({id:input.itemId}))).toMatchObject({code:'OK',view:{fields:{nummer:number,datum:'2026-11-04',faelligAm:'2026-11-18',netto:'100.00',ust:'19.00',brutto:'119.00'}}});
   expect(await sql`SELECT art FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid AND art='erkannt'`).toHaveLength(1);
  }finally{ocr.mockRestore();}
 }),60000);
});

describe('P55 missing supplier on the real invoice path',()=>{
 it('keeps a real task, blocks payment, creates supplier in existing form command and resolves through versioned invoice writer',async()=>{
  const {actor,input}=await incomingFixture();
  await sql`UPDATE public.intake_item SET kunde_id=NULL,zuordnung='offen' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.itemId}::uuid`;
  const {saveIncomingInvoiceAction,changeIncomingInvoiceStatusAction,clarifyIncomingInvoiceAction,createCustomerForIntakeAction,getIncomingInvoiceAction}=await import('@/app/actions/eingang.actions');
  const missing={...input,fields:{...input.fields,lieferantId:''}};
  const saved=await withSession(actor,()=>saveIncomingInvoiceAction(missing));if(saved.code!=='OK')throw Error('P55_MISSING:'+JSON.stringify(saved));
  expect(saved.invoice).toMatchObject({lieferant_id:null,zahlstatus:'unklar',unklar_grund:'Lieferant fehlt',aufgabe_id:expect.any(String)});
  expect(await sql`SELECT titel,status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.invoice.aufgabe_id}::uuid`).toEqual([{titel:'Lieferant ergänzen',status:'offen'}]);
  const payment:InvoiceChangeInput={invoiceId:saved.invoice.id,version:1,clientKey:randomUUID(),result:'bezahlt',paidDate:'2026-11-01',proofFileId:null,duplicateId:null,reason:null,fields:null};
  expect(await withSession(actor,()=>changeIncomingInvoiceStatusAction(payment))).toMatchObject({code:'VALIDATION_ERROR'});
  const view=await withSession(actor,()=>getIncomingInvoiceAction({id:input.itemId}));if(view.code!=='OK')throw Error('P55_READ:'+JSON.stringify(view));
  const created=await withSession(actor,()=>createCustomerForIntakeAction({itemId:input.itemId,version:view.view.item.version,customer:{clientEventId:randomUUID(),customerType:'lieferant',companyName:'SYNTHETISCH P55 '+input.itemId,country:'DE'}}));
  if(created.code!=='OK')throw Error('P55_SUPPLIER:'+JSON.stringify(created));
  expect(await sql`SELECT lieferant_id FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.invoice.id}::uuid`).toEqual([{lieferant_id:null}]);
  const change:InvoiceChangeInput={invoiceId:saved.invoice.id,version:1,clientKey:randomUUID(),result:'offen',paidDate:null,proofFileId:null,duplicateId:null,reason:null,fields:{...missing.fields,lieferantId:created.customer.id}};
  const resolved=await withSession(actor,()=>clarifyIncomingInvoiceAction(change));if(resolved.code!=='OK')throw Error('P55_RESOLVE:'+JSON.stringify(resolved));
  expect(resolved.invoice).toMatchObject({lieferant_id:created.customer.id,zahlstatus:'offen',version:2});
  expect(await sql`SELECT kunde_id,vorgang_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.itemId}::uuid`).toEqual([{kunde_id:created.customer.id,vorgang_id:saved.invoice.id}]);
  expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.invoice.aufgabe_id}::uuid`).toEqual([{status:'erledigt'}]);
  expect(await sql`SELECT nachher->>'command' AS command FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid AND befehl_id=${change.clientKey}::uuid`).toEqual([{command:'rechnung.klaeren'}]);
  expect(await withSession(actor,()=>getIncomingInvoiceAction({id:saved.invoice.id}))).toMatchObject({code:'OK',view:{supplier:{id:created.customer.id},invoice:{lieferant_id:created.customer.id,zahlstatus:'offen'}}});
 },60000);
});
