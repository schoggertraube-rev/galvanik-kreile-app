// @vitest-environment node

import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { withLocalReplayStorage } from "./localReplayStorage";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });
// AP-EIN packet: fixed provider response only at the existing Azure boundary in isolated Replay tests.
vi.mock("@/lib/server/azureDocumentIntelligence", () => ({ analyzeWithAzureDocumentIntelligence: vi.fn(async () => ({ code: "OK", data: { suggestions: [] } })) }));
vi.mock("@/lib/server/microsoftGraph", () => ({ sendMicrosoftGraphMail: vi.fn(async () => ({ code: "OK", data: {} })), readMicrosoftGraphConfigurationStatus: vi.fn(()=>({code:"READY"})) }));

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.H18_EXPECTED_DATABASE_URL;
if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("H18_CUSTOMER_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("H18_CUSTOMER_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("H18_CUSTOMER_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const ownedAddressFixtureIds: string[] = [];
let ownedConfirmationCompanyId:string|null=null;
let restoredConfirmationCompany:{id:string;name:string|null}|null=null;
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "h18-customer-actions-local-only";

type Fixture = { actorId: string; actorIssuedAt: number; role: "meister"|"werkstatt" };

async function withRequest<T>(cookie: string, work: () => Promise<T>, beforeClose?:(result:T)=>Promise<void>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const { AfterContext } = await import("next/dist/server/after/after-context");
  const pending:Promise<unknown>[]=[],closed:Array<()=>void>=[],backgroundErrors:unknown[]=[];
  const afterContext=new AfterContext({waitUntil:promise=>{pending.push(Promise.resolve(promise));},onClose:callback=>{closed.push(callback);},onTaskError:error=>{backgroundErrors.push(error);}});
  const request = new NextRequest("http://127.0.0.1/h18-customer-actions", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/h18-customer-actions",
    route: "/h18-customer-actions",
    afterContext,
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
    { pathname: "/h18-customer-actions", search: "" },
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined as never,
  );
  try{
    const result=await workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(requestStore, work));
    await beforeClose?.(result);
    return result;
  }finally{
    for(const close of closed)close();
    await Promise.all(pending);
    if(backgroundErrors.length)throw new AggregateError(backgroundErrors,'H18_AFTER_RESPONSE_FAILED');
  }
}

async function withSession<T>(fixture: Fixture, work: () => Promise<T>,beforeClose?:(result:T)=>Promise<void>): Promise<T> {
  const { COOKIE_NAME, getSecretKey, signAppSession } = await import("@/lib/server/appSession");
  const session: AppSession = {
    userId: fixture.actorId,
    tenantId: KREILE_TENANT_SLUG,
    role: fixture.role,
    displayName: "Rolf H18 Kunde",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work,beforeClose);
}

async function createFixture(role: "meister"|"werkstatt"="meister", areas: string[]=["auftraege","kunden","geld","eingang"]): Promise<Fixture> {
  const actorId = randomUUID();
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES (
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`rolf-h18-customer-${actorId}@local.invalid`},
        'Rolf H18 Kunde', ${role}, true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(${areas}::text[]) area
    `;
  });
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id=${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("H18_CUSTOMER_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt, role };
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
  // annahme.vorlage_stufe1 needs an actual configured sender. Preserve other suites' fixtures.
  const companies=await sql<{id:string;company_name:string|null}[]>`SELECT id::text,company_name FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG}`;
  if(companies.length>1)throw Error('H18_CONFIRMATION_COMPANY_FIXTURE_AMBIGUOUS');
  if(!companies.length){
    const [created]=await sql<{id:string}[]>`INSERT INTO public.company_settings(tenant_id,company_name) VALUES(${KREILE_TENANT_SLUG},'SYNTHETISCH H18 Absender') RETURNING id::text`;
    ownedConfirmationCompanyId=created.id;
  }else if(!companies[0].company_name?.trim()){
    restoredConfirmationCompany={id:companies[0].id,name:companies[0].company_name};
    await sql`UPDATE public.company_settings SET company_name='SYNTHETISCH H18 Absender' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id::text=${companies[0].id}`;
  }
  // This isolated fixture must not depend on another suite's address-directory seed.
  const firstAddress = await sql<{id:string}[]>`INSERT INTO public.address_directory(country,zip_code,city,district,street)
    SELECT 'DE','70176','Stuttgart',NULL,'Kundenweg'
    WHERE NOT EXISTS(SELECT 1 FROM public.address_directory WHERE country='DE' AND zip_code='70176' AND city='Stuttgart' AND street='Kundenweg') RETURNING id::text`;
  ownedAddressFixtureIds.push(...firstAddress.map(row=>row.id));
  const secondAddress = await sql<{id:string}[]>`INSERT INTO public.address_directory(country,zip_code,city,district,street)
    SELECT 'DE','70177','Stuttgart',NULL,'Bearbeitungsweg'
    WHERE NOT EXISTS(SELECT 1 FROM public.address_directory WHERE country='DE' AND zip_code='70177' AND city='Stuttgart' AND street='Bearbeitungsweg') RETURNING id::text`;
  ownedAddressFixtureIds.push(...secondAddress.map(row=>row.id));
});

afterAll(async () => {
  // Keep the byte-bound APK1 suite's empty reference-directory precondition intact.
  // Only rows inserted by this guarded local Replay test are removed.
  if(ownedAddressFixtureIds.length)await sql`DELETE FROM public.address_directory WHERE id::text=ANY(${ownedAddressFixtureIds}::text[])`;
  if(ownedConfirmationCompanyId)await sql`DELETE FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG} AND id::text=${ownedConfirmationCompanyId}`;
  if(restoredConfirmationCompany)await sql`UPDATE public.company_settings SET company_name=${restoredConfirmationCompany.name} WHERE tenant_id=${KREILE_TENANT_SLUG} AND id::text=${restoredConfirmationCompany.id}`;
  await sql.end({ timeout: 1 });
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSecret;
});

describe("H18 customer Server Actions against the real replay database", () => {
  it("creates and edits the customer through UI actions with DB, event and view readback", async () => {
    const fixture = await createFixture();
    const createClientEventId = randomUUID();
    const updateClientEventId = randomUUID();
    const noteClientEventId = randomUUID();
    const {
      createCustomerAction,
      getCustomerSummaryAction,
      updateCustomerAction,
    } = await import("@/app/actions/customers.actions");

    const created = await withSession(fixture, () => createCustomerAction({
      city: "Stuttgart",
      clientEventId: createClientEventId,
      companyName: "H18 Kundenanlage GmbH",
      salutation:"ohne",firstName:"Ada",lastName:"Kundin",
      customerType: "business",
      email: "h18-kundenanlage@example.invalid",
      notes: "H18 Erstnotiz",
      paymentPreference: "vorkasse",
      phone: "+49 711 5550190",
      street: "Kundenweg",houseNumber:"18",
      zipCode: "70176",
      country: "DE",
      vatId: "DE123456789",
    }));
    if (created.code !== "OK") throw new Error(`H18_CUSTOMER_CREATE_FAILED:${created.code}:${created.message}`);
    expect(created.code).toBe("OK");
    const [createdRow] = await sql<{
      id: string;
      name: string;
      payment_preference: string;
      event_type: string;
      actor_id: string;
    }[]>`
      SELECT customer.id, customer.name, customer.payment_preference,
        event.event_type, event.user_id::text AS actor_id
      FROM public.customers customer
      JOIN public.events event ON event.tenant_id=customer.tenant_id
        AND event.client_event_id=${createClientEventId}::uuid
      WHERE customer.id=${created.receipt.customerId} AND customer.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(createdRow).toEqual({
      id: created.receipt.customerId,
      name: "H18 Kundenanlage GmbH",
      payment_preference: "vorkasse",
      event_type: "CUSTOMER_CREATED_V1",
      actor_id: fixture.actorId,
    });
    const createdView = await withSession(fixture, () => getCustomerSummaryAction({ customerId: created.receipt.customerId }));
    expect(createdView).toMatchObject({
      code: "OK",
      data: { id: created.receipt.customerId, name: "H18 Kundenanlage GmbH", paymentPreference: "vorkasse" },
    });

    const updated = await withSession(fixture, () => updateCustomerAction({
      clientEventId: updateClientEventId,
      customerId: created.receipt.customerId,
      companyName: "H18 Kunde bearbeitet GmbH",
      salutation:"ohne",firstName:"Ada",lastName:"Bearbeitet",
      email: "h18-bearbeitet@example.invalid",
      phone: "+49 711 5550191",
      street: "Bearbeitungsweg",houseNumber:"19",
      zipCode: "70177",
      city: "Stuttgart",
      country: "DE",
      paymentPreference: "bar",
      vatId: "DE987654321",
    }));
    expect(updated.code).toBe("OK");
    if (updated.code !== "OK") throw new Error(`H18_CUSTOMER_UPDATE_FAILED:${updated.code}:${updated.message}`);
    const [updatedRow] = await sql<{
      name: string;
      first_name:string;last_name:string;
      payment_preference: string;
      event_type: string;
    }[]>`
      SELECT customer.name, customer.first_name, customer.last_name, customer.payment_preference, event.event_type
      FROM public.customers customer
      JOIN public.events event ON event.tenant_id=customer.tenant_id
        AND event.client_event_id=${updateClientEventId}::uuid
      WHERE customer.id=${created.receipt.customerId} AND customer.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(updatedRow).toEqual({
      name: "H18 Kunde bearbeitet GmbH",
      first_name:"Ada",last_name:"Bearbeitet",
      payment_preference: "bar",
      event_type: "CUSTOMER_UPDATED_V1",
    });
    const updatedView = await withSession(fixture, () => getCustomerSummaryAction({ customerId: created.receipt.customerId }));
    expect(updatedView).toMatchObject({
      code: "OK",
      data: { name: "H18 Kunde bearbeitet GmbH", salutation:"ohne",firstName:"Ada",lastName:"Bearbeitet", paymentPreference: "bar" },
    });

    const note = await withSession(fixture, () => updateCustomerAction({
      clientEventId: noteClientEventId,
      customerId: created.receipt.customerId,
      notes: "H18 Notiz bearbeitet",
    }));
    expect(note.code).toBe("OK");
    if (note.code !== "OK") throw new Error(`H18_CUSTOMER_NOTE_FAILED:${note.code}:${note.message}`);
    const [noteRow] = await sql<{ notes: string; event_type: string }[]>`
      SELECT customer.notes, event.event_type
      FROM public.customers customer
      JOIN public.events event ON event.tenant_id=customer.tenant_id
        AND event.client_event_id=${noteClientEventId}::uuid
      WHERE customer.id=${created.receipt.customerId} AND customer.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(noteRow).toEqual({ notes: "H18 Notiz bearbeitet", event_type: "CUSTOMER_UPDATED_V1" });
    const noteView = await withSession(fixture, () => getCustomerSummaryAction({ customerId: created.receipt.customerId }));
    expect(noteView).toMatchObject({ code: "OK", data: { notes: "H18 Notiz bearbeitet" } });
  });
});

// Owner-authored case: BAUPLAN 21d0347a, screens[rein].abnahme[11].
// Typed note, both detected concerns deselected: original remains, concerns empty, usage info.
describe("AP-EIN 3.0 note command: unchanged owner case through real Action -> DB -> read",()=>{
 it("rein.abnahme[11]: deselected concerns do not survive the save",async()=>{
  const fixture=await createFixture("werkstatt",["eingang","kunden"]);
  const {saveIntakeNoteAction,getIntakeCaptureAction,recognizeIntakeNoteAction}=await import("@/app/actions/eingang.actions");
  const text="Teile bitte nur matt";
  const reading=await withSession(fixture,()=>recognizeIntakeNoteAction(text));
  // RT04: "nur" constrains processing; it is exactly one hint, never an internal task.
  expect(reading).toMatchObject({code:"OK"});
  expect(reading.code==="OK"?reading.data.concerns:null).toEqual([{id:"hinweis",label:"Hinweis zur Bearbeitung"}]);
  const input={itemId:randomUUID(),textstand:randomUUID(),text,concerns:[]};
  const saved=await withSession(fixture,()=>saveIntakeNoteAction(input));
  expect(saved).toMatchObject({code:"OK",capture:{id:input.itemId,text,usage:"info",concerns:[]}});
  const rows=await sql`SELECT kanal,richtung,text,anliegen,anliegen_abgewaehlt,einsatz FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.itemId}::uuid`;
  expect(rows).toEqual([{kanal:"notiz",richtung:"intern",text,anliegen:[],anliegen_abgewaehlt:["hinweis"],einsatz:"info"}]);
  const events=await sql`SELECT art,nachher->>'text' AS text FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid ORDER BY art`;
  expect(events).toEqual([{art:"angelegt",text:null},{art:"original_gespeichert",text}]);
  const repeated=await withSession(fixture,()=>saveIntakeNoteAction(input));
  expect(repeated).toEqual(saved);
  const count=await sql`SELECT count(*)::integer AS count FROM public.intake_event WHERE item_id=${input.itemId}::uuid`;
  expect(count[0].count).toBe(2);
  const fresh=await withSession(fixture,()=>getIntakeCaptureAction(input.itemId));
  expect(fresh).toEqual(saved);
  // RT04-10: a later read/recognition of the identical text must not revive a declined proposal.
  const again=await withSession(fixture,()=>saveIntakeNoteAction({itemId:input.itemId,textstand:randomUUID(),text}));
  expect(again).toMatchObject({code:"OK",capture:{concerns:[],dismissedConcerns:["hinweis"]}});
  expect(await sql`SELECT anliegen,anliegen_abgewaehlt FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.itemId}::uuid`)
    .toEqual([{anliegen:[],anliegen_abgewaehlt:["hinweis"]}]);
 });
});

// Owner-authored F05: spreadsheet original is preserved; no OCR success claimed.
describe("AP-EIN F05: real Actions, local Storage, DB and fresh read",()=>{
 it("F05: unreadable original is secured and repeat-safe",async()=>{
  return withLocalReplayStorage(async()=>{
  const fixture=await createFixture();
  const {prepareIntakeFileAction,finishIntakeFileAction,getIntakeCaptureAction}=await import("@/app/actions/eingang.actions");
  const bytes=Buffer.from("Isolated generated-flow fixture: unsupported spreadsheet upload\n","utf8");
  const input={itemId:randomUUID(),fileId:randomUUID(),name:"pruef_datei.xlsx",mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
  const grant=await withSession(fixture,()=>prepareIntakeFileAction(input));
  expect(grant.code).toBe("OK");
  if(grant.code!=="OK")throw Error("EIN2_FILE_GRANT_REQUIRED");
  const {uploadIntakeOriginal}=await import("@/modules/eingang/public");
  if(grant.upload){
  const uploaded=await uploadIntakeOriginal(grant.upload,new File([Uint8Array.from(bytes).buffer],input.name,{type:input.mime}));
  expect(uploaded.ok).toBe(true);
  }
  const finished=await withSession(fixture,()=>finishIntakeFileAction(input.fileId));
  expect(finished).toMatchObject({code:"OK",capture:{id:input.itemId,assignment:"offen",files:[{id:input.fileId,name:input.name,readable:false,status:"fehler"}]}});
  const rows=await sql`SELECT item_id::text,dateiname,sha256,speicherpfad,lesbar,erkennung_status FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.fileId}::uuid`;
  expect(rows).toEqual([{item_id:input.itemId,dateiname:input.name,sha256:input.sha256,speicherpfad:KREILE_TENANT_SLUG+"/"+input.sha256,lesbar:false,erkennung_status:"fehler"}]);
  const events=await sql`SELECT art FROM public.intake_event WHERE item_id=${input.itemId}::uuid ORDER BY art`;
  expect(events.map(row=>row.art)).toEqual(["angelegt","einsatz","erkannt","original_gespeichert"]);
  expect(await sql`SELECT nachher->>'action' AS action FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid AND art='einsatz'`).toEqual([{action:'erkennung_gestartet'}]);
  // Decision 17: the authenticated transport exposes IDs/timestamps only; contents use the same read port.
  const { GET } = await import("@/app/api/device-file-changes/route");
  const query = new URLSearchParams({ since: new Date(Date.now()-60_000).toISOString() });
  const response = await withSession(fixture,()=>GET(new Request("http://replay.local/api/device-file-changes?"+query)));
  expect(response.status).toBe(200);
  const changes = await response.json() as Array<{ id:string; fileId:string; itemId:string; at:string }>;
  const ownChanges=changes.filter(change=>change.itemId===input.itemId);
  expect(ownChanges).toHaveLength(2);
  for(const change of ownChanges){
    expect(Object.keys(change).sort()).toEqual(["at","fileId","id","itemId"]);
    expect(change.fileId).toBe(input.fileId);
    expect(Number.isFinite(Date.parse(change.at))).toBe(true);
  }
  const last=changes.at(-1)!;
  const after=new URLSearchParams({since:last.at,after:last.id});
  const empty=await withSession(fixture,()=>GET(new Request("http://replay.local/api/device-file-changes?"+after)));
  expect(await empty.json()).toEqual([]);
  expect(await withSession(fixture,()=>finishIntakeFileAction(input.fileId))).toEqual(finished);
  expect(await withSession(fixture,()=>getIntakeCaptureAction(input.itemId))).toEqual(finished);
  });
 });
});

// Owner-authored screens[rein].abnahme[12]: same-login phone, two originals, finish, live PC read.
describe("AP-EIN werkbank.buchen: inline customer in the canonical transaction",()=>{
 // Owner E36 + werkbank.interaktion[interessent] and buchen.idempotenz, no new expectations.
 it('E36 saves one prospect, original and new-key draft atomically and recovers the lost reply when booking',async()=>{
  const actor=await createFixture(),clientKey=randomUUID(),companyName='SYNTHETISCH Interessent '+randomUUID();
  const {EMPTY_CUSTOMER_FORM}=await import('@/modules/customers/public');
  const {saveIntakeProspectAction,erfasseAuftragAusEingangAction,getIntakeDraftsAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
  const customer={customerType:'business' as const,companyName,phone:'+49 711 5550190'};
  const item={key:randomUUID(),catalogServiceId:'FREE_TEXT',name:'SYNTHETISCH Vorgemerktes Teil',quantity:'2',unit:'stueck',surfaceRequested:'verzinken',surfaceTouched:false,executionRequested:'offen',material:'',unitPriceCents:null,vatRateBasisPoints:null};
  const input={clientKey,customer,text:'SYNTHETISCH Gesprächsangaben',draft:{version:1,clientKey,customerMode:'NEW',customerFields:{...EMPTY_CUSTOMER_FORM,...customer},customerName:'',customerId:'',query:customer.phone,text:'SYNTHETISCH Gesprächsangaben',items:[item],kind:'auftrag',date:'',confirmed:'',term:'',handover:'',payment:'',source:'',note:'SYNTHETISCH Rücksprache',geprueft:false,documents:[],recognitionMarkers:[],recognitionConfirmed:false,lastRecognizedText:'',intakeWishDateOrigin:'empty',intakeHandoverOrigin:null,intakePaymentOrigin:null,intakeOrigin:null,intakeTermChoice:null}};
  const failed=await withSession(actor,()=>saveIntakeProspectAction({...input,activeDraft:{id:randomUUID(),version:0}}));
  expect(failed.code).toBe('CONFLICT');
  expect(await sql`SELECT id FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND company_name=${companyName}`).toHaveLength(0);
  const saved=await withSession(actor,()=>saveIntakeProspectAction(input));
  if(saved.code!=='OK')throw Error('PROSPECT_SAVE_FAILED:'+saved.code+':'+saved.message);
  expect(await sql`SELECT kanal,richtung,einsatz,kunde_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.intakeItemId}::uuid`).toEqual([{kanal:'notiz',richtung:'intern',einsatz:'info',kunde_id:saved.customerId}]);
  expect(await withSession(actor,()=>getIntakeCaptureAction(saved.intakeItemId))).toMatchObject({code:'OK',capture:{customerId:saved.customerId,orderId:null,usage:'info',text:expect.stringContaining(item.name)}});
  const drafts=await withSession(actor,()=>getIntakeDraftsAction());
  if(drafts.code!=='OK')throw Error('PROSPECT_DRAFT_READ_FAILED');
  const draft=drafts.drafts.find(row=>row.id===saved.draftId);
  expect(draft).toMatchObject({art:'eingang',payload:{customerMode:'EXISTING',customerId:saved.customerId,text:input.text,items:[item],documents:[saved.intakeItemId]}});
  expect(draft?.payload.clientKey).not.toBe(clientKey);
  expect(await withSession(actor,()=>saveIntakeProspectAction(input))).toMatchObject({...saved,replayed:true});
  expect(await sql`SELECT id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${saved.customerId}`).toHaveLength(0);
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${saved.intakeItemId}::uuid AND art='zugeordnet' AND nachher->>'befehlsart'='interessent'`).toHaveLength(1);
  // The prospect response was lost: the UI still sends NEW and its original command key.
  const booking={geprueft:true,clientKey,text:input.text,customer:{mode:'NEW' as const,...customer,salutation:'ohne' as const,lastName:'Prüferin',email:'prospect@example.invalid',street:'Kundenweg',houseNumber:'9',zipCode:'70176',city:'Stuttgart',country:'DE',paymentPreference:'vorkasse'},dueDate:'2026-11-19',termStatus:'bestaetigt' as const,intakeSource:'persoenlich' as const,handoverMode:'pickup' as const,paymentMode:'vorkasse' as const,items:[{catalogServiceId:null,name:item.name,quantity:2,unit:'stueck',surfaceRequested:'verzinken',executionRequested:'offen' as const,material:null,unitPriceCents:null,vatRateBasisPoints:null}]};
  const booked=await withSession(actor,()=>erfasseAuftragAusEingangAction(booking));
  if(booked.code!=='OK')throw Error('PROSPECT_RECOVERY_BOOK_FAILED:'+booked.code+':'+booked.message);
  expect(await sql`SELECT customer_id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${booked.orderId}`).toEqual([{customer_id:saved.customerId}]);
  expect(await sql`SELECT id FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND company_name=${companyName}`).toHaveLength(1);
  expect(await sql`SELECT vorgang_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.intakeItemId}::uuid`).toEqual([{vorgang_id:booked.orderId}]);
  expect(await sql`SELECT id FROM private.intake_drafts WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.draftId}::uuid`).toHaveLength(0);
  expect(await withSession(actor,()=>erfasseAuftragAusEingangAction(booking))).toMatchObject({code:'OK',orderId:booked.orderId,replayed:true});
  const {getOrderIntakeReceiptAction}=await import('@/app/warendurchlauf/actions');
  expect(await withSession(actor,()=>getOrderIntakeReceiptAction({orderId:booked.orderId,clientEventId:clientKey}))).toMatchObject({ok:true,data:{customerId:saved.customerId}});
 });
 it("creates one customer, order, original and event, rereads and replays the same request",async()=>{
  const actor=await createFixture(),clientKey=randomUUID(),companyName="SYNTHETISCH Inline "+randomUUID();
  const {erfasseAuftragAusEingangAction,getIntakeCaptureAction}=await import("@/app/actions/eingang.actions");
  const input={geprueft:true,clientKey,wishDate:null,termOrigin:"vorschlag" as const,processingWeeks:2 as const,text:"SYNTHETISCH Inline-Original",customer:{mode:"NEW" as const,customerType:"business" as const,companyName,
   salutation:"ohne" as const,firstName:"Ada",lastName:"Prüferin",email:"inline@example.invalid",phone:"+49 711 5550190",street:"Kundenweg",houseNumber:"7",zipCode:"70176",city:"Stuttgart",country:"DE",paymentPreference:"vorkasse"},
   dueDate:"2026-11-19",termStatus:"bestaetigt" as const,intakeSource:"persoenlich" as const,handoverMode:"pickup" as const,paymentMode:"vorkasse" as const,
   items:[{catalogServiceId:null,name:"SYNTHETISCH Inline-Teil",quantity:2,material:null,surfaceRequested:"verzinken",executionRequested:"offen" as const,unit:"stueck",unitPriceCents:1200,vatRateBasisPoints:1900 as const}]};
  expect((await withSession(actor,()=>erfasseAuftragAusEingangAction({...input,items:[{...input.items[0]!,quantity:0}]}))).code).toBe("VALIDATION_ERROR");
  expect((await sql`SELECT id FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND company_name=${companyName}`)).toHaveLength(0);
  // Owner AB02 / annahme: durable outbox first, Graph only after the response closes.
  const booked=await withLocalReplayStorage(()=>withSession(actor,()=>erfasseAuftragAusEingangAction(input),async result=>{
    expect(result).toMatchObject({code:'OK',confirmationMessage:'Auftragsbestätigung wird gesendet'});
    if(result.code!=='OK')throw Error('INLINE_BOOKING_RESPONSE_REQUIRED');
    expect(await sql`SELECT status FROM public.outbox_mails WHERE tenant_id=${KREILE_TENANT_SLUG} AND objekt=${result.orderId}`).toEqual([{status:'wartet'}]);
    expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${result.intakeItemId} AND art='gesendet'`).toHaveLength(0);
  }));
  expect(booked.code).toBe("OK");if(booked.code!=="OK")throw Error("INLINE_BOOKING_FAILED:"+booked.message);
  const [row]=await sql`SELECT c.id AS customer_id,c.company_name,c.house_number,o.id AS order_id,source.vorgang_id,o.wunschtermin,o.termin_herkunft,o.processing_weeks,
   (SELECT count(*)::int FROM public.events e WHERE e.tenant_id=o.tenant_id AND e.order_id=o.id AND e.event_type='ORDER_INTAKE_CREATED_V1') AS events
   FROM public.orders o JOIN public.customers c ON c.tenant_id=o.tenant_id AND c.id=o.customer_id
   JOIN public.intake_item source ON source.tenant_id=o.tenant_id AND source.vorgang_id=o.id
   WHERE o.tenant_id=${KREILE_TENANT_SLUG} AND o.id=${booked.orderId}`;
  expect(row).toMatchObject({company_name:companyName,house_number:"7",order_id:booked.orderId,vorgang_id:booked.orderId,wunschtermin:null,termin_herkunft:"vorschlag",processing_weeks:2,events:1});
  // screens[eingang].abnahme[11] / A-71: entered unit price persists and reads back.
  expect(await sql`SELECT round(preis_netto*100)::int AS cents,vat_rate_basis_points AS vat FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${booked.orderId}`).toEqual([{cents:1200,vat:1900}]);
  const {getOrderIntakeReceiptAction}=await import('@/app/warendurchlauf/actions');
  expect(await withSession(actor,()=>getOrderIntakeReceiptAction({orderId:booked.orderId,clientEventId:clientKey}))).toMatchObject({ok:true,data:{items:[{unitPriceCents:1200,vatRateBasisPoints:1900}]}});
  // Owner C06/C08: the existing canonical card reader supplies copy fields;
  // financial data is removed on the server for the same real action without geld.
  const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
  const source=await withSession(actor,()=>getLiveOrderCardAction({orderId:booked.orderId}));
  expect(source).toMatchObject({code:'OK',data:{card:{customerId:row?.customer_id,intakeSource:'persoenlich',items:[{
    name:input.items[0]!.name,quantity:2,unit:'Stück',executionRequested:'offen',unitPriceCents:1200,vatRateBasisPoints:1900,
  }]}}});
  const withoutMoney=await createFixture('werkstatt',['auftraege','eingang','kunden']);
  expect(await withSession(withoutMoney,()=>getLiveOrderCardAction({orderId:booked.orderId})))
    .toMatchObject({code:'OK',data:{card:{intakeSource:'persoenlich',items:[{unitPriceCents:null,vatRateBasisPoints:null}]}}});
  expect(await sql`SELECT round(preis_netto*100)::int AS cents,vat_rate_basis_points AS vat FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${booked.orderId}`).toEqual([{cents:1200,vat:1900}]);
  expect(await withSession(actor,()=>erfasseAuftragAusEingangAction(input))).toMatchObject({code:"OK",orderId:booked.orderId,replayed:true});
  expect(await sql`SELECT status FROM public.outbox_mails WHERE tenant_id=${KREILE_TENANT_SLUG} AND objekt=${booked.orderId}`).toEqual([{status:'gesendet'}]);
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${booked.intakeItemId} AND art='gesendet'`).toHaveLength(1);
  expect(await withSession(actor,()=>getIntakeCaptureAction(booked.intakeItemId))).toMatchObject({code:"OK",capture:{orderId:booked.orderId}});
  expect((await sql`SELECT id FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND company_name=${companyName}`)).toHaveLength(1);
 });
 it("writes only missing customer fields when booking the existing customer",async()=>{
  const actor=await createFixture();const {createCustomerAction}=await import("@/app/actions/customers.actions");
  const customer=await withSession(actor,()=>createCustomerAction({clientEventId:randomUUID(),customerType:"business",companyName:"SYNTHETISCH Ergänzen "+randomUUID(),phone:"+49 711 5550190"}));
  if(customer.code!=="OK")throw Error("INLINE_PROSPECT_REQUIRED:"+customer.message);
  const {erfasseAuftragAusEingangAction}=await import("@/app/actions/eingang.actions");
  const input={geprueft:true,clientKey:randomUUID(),text:null,customer:{mode:"EXISTING" as const,customerId:customer.receipt.customerId,changes:{lastName:"Prüferin",email:"supplement@example.invalid",street:"Kundenweg",houseNumber:"8",zipCode:"70176",city:"Stuttgart",country:"DE",paymentPreference:"vorkasse"}},
   dueDate:"2026-11-19",termStatus:"bestaetigt" as const,intakeSource:"persoenlich" as const,handoverMode:"pickup" as const,paymentMode:"vorkasse" as const,
   items:[{catalogServiceId:null,name:"SYNTHETISCH Ergänzungs-Teil",quantity:1,material:null,surfaceRequested:"verzinken",executionRequested:"offen" as const,unit:"stueck",unitPriceCents:null,vatRateBasisPoints:null}]};
  const incomplete=await withSession(actor,()=>erfasseAuftragAusEingangAction({...input,customer:{...input.customer,changes:{lastName:"Prüferin"}}}));
  expect(incomplete.code).toBe("VALIDATION_ERROR");
  expect((await sql`SELECT last_name FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customer.receipt.customerId}`)[0]?.last_name).toBeNull();
  const result=await withSession(actor,()=>erfasseAuftragAusEingangAction(input));
  expect(result.code).toBe("OK");if(result.code!=="OK")throw Error("INLINE_SUPPLEMENT_FAILED:"+result.message);
  expect((await sql`SELECT phone,email,house_number FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customer.receipt.customerId}`)[0]).toEqual({phone:"+49 711 5550190",email:"supplement@example.invalid",house_number:"8"});
  expect(await withSession(actor,()=>erfasseAuftragAusEingangAction(input))).toMatchObject({code:"OK",orderId:result.orderId,replayed:true});
  const {getOrderIntakeReceiptAction}=await import("@/app/warendurchlauf/actions");
  expect(await withSession(actor,()=>getOrderIntakeReceiptAction({orderId:result.orderId,clientEventId:input.clientKey}))).toMatchObject({ok:true,data:{customerId:customer.receipt.customerId}});
 });
});

describe("E28: a handover change keeps the one existing customer condition",()=>{
 it("books shipping with advance payment and rereads the original pickup/bar customer unchanged",async()=>{
  const actor=await createFixture();
  const {createCustomerAction,getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
  const created=await withSession(actor,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'SYNTHETISCH Übergabe '+randomUUID(),
    salutation:'ohne',firstName:'Ada',lastName:'Abholung',phone:'+49 711 5550190',email:'handover@example.invalid',street:'Kundenweg',houseNumber:'8',zipCode:'70176',city:'Stuttgart',country:'DE',paymentPreference:'bar',handoverPreference:'pickup'}));
  if(created.code!=='OK')throw Error('E28_CUSTOMER_REQUIRED:'+created.message);
  const {erfasseAuftragAusEingangAction}=await import('@/app/actions/eingang.actions');
  const {getOrderIntakeReceiptAction}=await import('@/app/warendurchlauf/actions');
  const input={geprueft:true,clientKey:randomUUID(),text:null,customer:{mode:'EXISTING' as const,customerId:created.customer.id},
    dueDate:'2026-11-20',termStatus:'bestaetigt' as const,intakeSource:'persoenlich' as const,handoverMode:'shipping' as const,paymentMode:'vorkasse' as const,
    items:[{catalogServiceId:null,name:'SYNTHETISCH Versand-Teil',quantity:1,material:null,surfaceRequested:'verzinken',executionRequested:'offen' as const,unit:'stueck',unitPriceCents:null,vatRateBasisPoints:null}]};
  const booked=await withSession(actor,()=>erfasseAuftragAusEingangAction(input));
  if(booked.code!=='OK')throw Error('E28_BOOKING_REQUIRED:'+booked.message);
  expect(await sql`SELECT customer.payment_preference,customer.handover_preference,orders.handover_mode,orders.payment_mode
    FROM public.orders orders JOIN public.customers customer ON customer.tenant_id=orders.tenant_id AND customer.id=orders.customer_id
    WHERE orders.tenant_id=${KREILE_TENANT_SLUG} AND orders.id=${booked.orderId}`)
    .toEqual([{payment_preference:'bar',handover_preference:'pickup',handover_mode:'shipping',payment_mode:'vorkasse'}]);
  expect(await withSession(actor,()=>getOrderIntakeReceiptAction({orderId:booked.orderId,clientEventId:input.clientKey})))
    .toMatchObject({ok:true,data:{customerId:created.customer.id,handoverMode:'shipping',paymentMode:'vorkasse'}});
  expect(await withSession(actor,()=>getCustomerSummaryAction({customerId:created.customer.id})))
    .toMatchObject({code:'OK',data:{paymentPreference:'bar',handoverPreference:'pickup'}});
  expect(await withSession(actor,()=>erfasseAuftragAusEingangAction(input))).toMatchObject({code:'OK',orderId:booked.orderId,replayed:true});
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${booked.orderId} AND event_type='ORDER_INTAKE_CREATED_V1'`).toHaveLength(1);
 });
});

describe("P55 E40: phone and photograph provenance",()=>{
 it("U241: an explicit kind choice persists once, rereads the same original and cannot bypass invoice review",async()=>withLocalReplayStorage(async()=>{
  const actor=await createFixture('werkstatt',['eingang']);
  const {prepareIntakeFileAction,finishIntakeFileAction,getIntakeCaptureAction,chooseIntakeCaptureKindAction}=await import('@/app/actions/eingang.actions');
  const {analyzeWithAzureDocumentIntelligence}=await import('@/lib/server/azureDocumentIntelligence');
  vi.mocked(analyzeWithAzureDocumentIntelligence).mockResolvedValueOnce({code:'OK',data:{suggestions:[]}});
  const {uploadIntakeOriginal}=await import('@/modules/eingang/public');
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLp8AAAAASUVORK5CYII=','base64');
  const file={itemId:randomUUID(),fileId:randomUUID(),name:'synthetisch-u241.png',mime:'image/png',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),captureOrigin:'dokument' as const};
  const grant=await withSession(actor,()=>prepareIntakeFileAction(file));if(grant.code!=='OK')throw Error('U241_GRANT:'+grant.message);
  if(grant.upload)expect((await uploadIntakeOriginal(grant.upload,new File([Uint8Array.from(bytes).buffer],file.name,{type:file.mime}))).ok).toBe(true);
  const original=await withSession(actor,()=>finishIntakeFileAction(file.fileId));if(original.code!=='OK')throw Error('U241_ORIGINAL:'+original.message);
  const input={itemId:file.itemId,version:original.capture.version,clientEventId:randomUUID(),kind:'anfrage' as const};
  const chosen=await withSession(actor,()=>chooseIntakeCaptureKindAction(input));if(chosen.code!=='OK')throw Error('U241_KIND:'+chosen.message);
  expect(chosen.capture.recognition).toEqual({kind:'anfrage',source:'hand',text:''});
  expect(await withSession(actor,()=>chooseIntakeCaptureKindAction(input))).toMatchObject({code:'OK',capture:{version:chosen.capture.version}});
  expect(await sql`SELECT wert,status,entschieden_von FROM public.intake_suggestion WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${file.itemId}::uuid AND feld='art'`).toEqual([{wert:'anfrage',status:'uebernommen',entschieden_von:actor.actorId}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${file.itemId}::uuid AND befehl_id=${input.clientEventId}::uuid`).toEqual([{n:1}]);
  const other=await createFixture('werkstatt',['eingang']);
  expect(await withSession(other,()=>chooseIntakeCaptureKindAction({...input,version:chosen.capture.version,clientEventId:randomUUID(),kind:'dokument'}))).toMatchObject({code:'FORBIDDEN'});
  const invoice=await withSession(actor,()=>chooseIntakeCaptureKindAction({itemId:file.itemId,version:chosen.capture.version,clientEventId:randomUUID(),kind:'rechnung'}));if(invoice.code!=='OK')throw Error('U241_INVOICE:'+invoice.message);
  expect(await withSession(actor,()=>getIntakeCaptureAction(file.itemId))).toMatchObject({code:'OK',capture:{recognition:{kind:'rechnung',source:'hand',text:''},concerns:['rechnung']}});
  expect(await withSession(actor,()=>chooseIntakeCaptureKindAction({itemId:file.itemId,version:invoice.capture.version,clientEventId:randomUUID(),kind:'notiz'}))).toMatchObject({code:'CONFLICT'});
  expect(await sql`SELECT sha256 FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${file.fileId}::uuid`).toEqual([{sha256:file.sha256}]);
 }));
 it("P63: an unreadable label rereads the two actual expected orders through the tenant-bound view",async()=>withLocalReplayStorage(async()=>{
  const actor=await createFixture();
  const {createCustomerAction}=await import('@/app/actions/customers.actions');
  const created=await withSession(actor,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'SYNTHETISCH P63 '+randomUUID(),salutation:'ohne',firstName:'Ada',lastName:'Prüfung',phone:'+49 711 5550190',email:'p63@example.invalid',street:'Kundenweg',houseNumber:'1',zipCode:'70176',city:'Stuttgart',country:'DE',paymentPreference:'vorkasse'}));
  if(created.code!=='OK')throw Error('P63_EXPECTED_CUSTOMER:'+created.message);
  const {erfasseAuftragAusEingangAction,prepareIntakeFileAction,finishIntakeFileAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
  const orderIds:string[]=[];
  for(let index=0;index<2;index++){
   const booked=await withSession(actor,()=>erfasseAuftragAusEingangAction({geprueft:false,clientKey:randomUUID(),text:null,telefonNotiz:'SYNTHETISCH P63',customer:{mode:'EXISTING',customerId:created.customer.id},dueDate:'2026-11-20',termStatus:'bestaetigt',intakeSource:'anfrage_telefon',handoverMode:'pickup',paymentMode:'vorkasse',items:[{catalogServiceId:null,name:'SYNTHETISCH P63 Teil '+index,quantity:1,material:null,surfaceRequested:'verzinken',executionRequested:'offen',unit:'stueck',unitPriceCents:null,vatRateBasisPoints:null}]}));
   if(booked.code!=='OK')throw Error('P63_EXPECTED_ORDER:'+booked.message);orderIds.push(booked.orderId);
  }
  // Other H18 cases keep their orders. These two deliberately oldest fixtures must be first, not the only tenant orders.
  await sql`UPDATE public.orders SET ware='erwartet',ware_seit='2000-01-01T00:00:00Z'::timestamptz WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=ANY(${orderIds}::text[])`;
  const {analyzeWithAzureDocumentIntelligence}=await import('@/lib/server/azureDocumentIntelligence');
  vi.mocked(analyzeWithAzureDocumentIntelligence).mockResolvedValueOnce({code:'OK',data:{suggestions:[]}});
  const {uploadIntakeOriginal}=await import('@/modules/eingang/public');
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLp8AAAAASUVORK5CYII=','base64');
  const input={itemId:randomUUID(),fileId:randomUUID(),name:'synthetisch-p63-unklar.png',mime:'image/png',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),captureOrigin:'dokument' as const};
  const grant=await withSession(actor,()=>prepareIntakeFileAction(input));if(grant.code!=='OK')throw Error('P63_EXPECTED_GRANT:'+grant.message);
  if(grant.upload)expect((await uploadIntakeOriginal(grant.upload,new File([Uint8Array.from(bytes).buffer],input.name,{type:input.mime}))).ok).toBe(true);
  expect(await withSession(actor,()=>finishIntakeFileAction(input.fileId))).toMatchObject({code:'OK',capture:{recognition:{kind:'unklar'}}});
  const read=await withSession(actor,()=>getIntakeCaptureAction(input.itemId));if(read.code!=='OK')throw Error('P63_EXPECTED_READ:'+read.message);
  expect(read.capture.expectedOrders?.slice(0,2).map(order=>order.id).sort()).toEqual(orderIds.sort());
 }));
 it("P63: secures one original, persists the recognized text and rereads its actual kind without duplicating events",async()=>withLocalReplayStorage(async()=>{
  const actor=await createFixture();
  const {analyzeWithAzureDocumentIntelligence}=await import('@/lib/server/azureDocumentIntelligence');
  const content='SYNTHETISCH · Rechnung · Rechnungsnummer TEST-P63';
  vi.mocked(analyzeWithAzureDocumentIntelligence).mockResolvedValueOnce({code:'OK',data:{suggestions:[{field:'DOCUMENT_TEXT',label:'Dokumenttext',value:content,confidence:0,source:{page:1,polygon:[]}}]}});
  const {prepareIntakeFileAction,finishIntakeFileAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
  const {uploadIntakeOriginal}=await import('@/modules/eingang/public');
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLp8AAAAASUVORK5CYII=','base64');
  const input={itemId:randomUUID(),fileId:randomUUID(),name:'synthetisch-p63.png',mime:'image/png',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),captureOrigin:'dokument' as const};
  const grant=await withSession(actor,()=>prepareIntakeFileAction(input));if(grant.code!=='OK')throw Error('P63_FILE_GRANT:'+grant.message);
  if(grant.upload)expect((await uploadIntakeOriginal(grant.upload,new File([Uint8Array.from(bytes).buffer],input.name,{type:input.mime}))).ok).toBe(true);
  expect(await withSession(actor,()=>finishIntakeFileAction(input.fileId))).toMatchObject({code:'OK',capture:{recognition:{kind:'rechnung',text:content}}});
  expect(await sql`SELECT feld,wert FROM public.intake_suggestion WHERE tenant_id=${KREILE_TENANT_SLUG} AND file_id=${input.fileId}::uuid`).toEqual([{feld:'DOCUMENT_TEXT',wert:content}]);
  expect(await sql`SELECT anliegen,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.itemId}::uuid`).toEqual([{anliegen:['rechnung'],anliegen_offen:['rechnung']}]);
  expect(await withSession(actor,()=>getIntakeCaptureAction(input.itemId))).toMatchObject({code:'OK',capture:{recognition:{kind:'rechnung',text:content},files:[{id:input.fileId,status:'fertig'}]}});
  expect(await withSession(actor,()=>finishIntakeFileAction(input.fileId))).toMatchObject({code:'OK'});
  expect(await sql`SELECT art,count(*)::int AS count FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid AND art IN ('original_gespeichert','erkannt') GROUP BY art ORDER BY art`)
   .toEqual([{art:'erkannt',count:1},{art:'original_gespeichert',count:1}]);
 }));
 it("stores a phone note only for telephone intake and rereads it without duplication",async()=>{
  const actor=await createFixture('meister',['auftraege','kunden','geld','eingang','mails']);
  const {createCustomerAction}=await import('@/app/actions/customers.actions');
  const created=await withSession(actor,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'SYNTHETISCH Telefon '+randomUUID(),
   salutation:'ohne',firstName:'Ada',lastName:'Prüfung',phone:'+49 711 5550190',email:'phone@example.invalid',street:'Kundenweg',houseNumber:'8',zipCode:'70176',city:'Stuttgart',country:'DE',paymentPreference:'vorkasse'}));
  if(created.code!=='OK')throw Error('E40_CUSTOMER_REQUIRED:'+created.message);
  const {erfasseAuftragAusEingangAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
  const common={clientKey:randomUUID(),text:null,telefonNotiz:'SYNTHETISCH Telefonnotiz',customer:{mode:'EXISTING' as const,customerId:created.customer.id},
   dueDate:'2026-11-20',termStatus:'bestaetigt' as const,handoverMode:'pickup' as const,paymentMode:'vorkasse' as const,
   items:[{catalogServiceId:null,name:'SYNTHETISCH Telefon-Teil',quantity:1,material:null,surfaceRequested:'verzinken',executionRequested:'offen' as const,unit:'stueck',unitPriceCents:null,vatRateBasisPoints:null}]};
  const input={...common,intakeSource:'anfrage_telefon' as const,geprueft:false};
  const booked=await withSession(actor,()=>erfasseAuftragAusEingangAction(input));
  if(booked.code!=='OK')throw Error('E40_PHONE_BOOKING:'+booked.message);
  expect(await sql`SELECT kanal,text,vorgang_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${booked.intakeItemId}::uuid`)
   .toEqual([{kanal:'telefon',text:common.telefonNotiz,vorgang_id:booked.orderId}]);
  expect(await withSession(actor,()=>getIntakeCaptureAction(booked.intakeItemId))).toMatchObject({code:'OK',capture:{text:common.telefonNotiz,orderId:booked.orderId}});
  const {getIntakeMessagesAction}=await import('@/app/actions/eingang.actions');
  const messages=await withSession(actor,()=>getIntakeMessagesAction('erledigt'));
  if(messages.code!=='OK')throw Error('E40_MESSAGE_READ:'+messages.message);
  expect(messages.messages.find(message=>message.id===booked.intakeItemId)).toMatchObject({channel:'telefon',text:common.telefonNotiz,orderId:booked.orderId});
  expect(await withSession(actor,()=>erfasseAuftragAusEingangAction(input))).toMatchObject({code:'OK',orderId:booked.orderId,replayed:true});
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${booked.intakeItemId}::uuid AND art='original_gespeichert'`).toHaveLength(1);
  const {saveIntakeNoteAction}=await import('@/app/actions/eingang.actions');
  const source=await withSession(actor,()=>saveIntakeNoteAction({itemId:randomUUID(),textstand:randomUUID(),text:'SYNTHETISCH Originaltext'}));
  if(source.code!=='OK')throw Error('E40_SOURCE_REQUIRED:'+source.message);
  const attached={...input,clientKey:randomUUID(),sourceCaptures:[{id:source.capture.id,version:source.capture.version}]};
  const bookedWithSource=await withSession(actor,()=>erfasseAuftragAusEingangAction(attached));
  if(bookedWithSource.code!=='OK')throw Error('E40_SOURCE_BOOKING:'+bookedWithSource.message);
  expect(await withSession(actor,()=>erfasseAuftragAusEingangAction(attached))).toMatchObject({code:'OK',orderId:bookedWithSource.orderId,replayed:true});
  expect(await sql`SELECT kanal,text FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND vorgang_id=${bookedWithSource.orderId} ORDER BY kanal`)
   .toEqual([{kanal:'notiz',text:'SYNTHETISCH Originaltext'},{kanal:'telefon',text:common.telefonNotiz}]);
  const nonPhone=await withSession(actor,()=>erfasseAuftragAusEingangAction({...common,clientKey:randomUUID(),intakeSource:'persoenlich',geprueft:true}));
  if(nonPhone.code!=='OK')throw Error('E40_GOODS_BOOKING:'+nonPhone.message);
  expect(await sql`SELECT kanal,text FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${nonPhone.intakeItemId}::uuid`)
   .toEqual([{kanal:'notiz',text:null}]);
 });
 it("persists explicit goods-photo provenance through the real upload and fresh read",async()=>withLocalReplayStorage(async()=>{
  const actor=await createFixture();
  const {analyzeWithAzureDocumentIntelligence}=await import('@/lib/server/azureDocumentIntelligence');
  vi.mocked(analyzeWithAzureDocumentIntelligence).mockClear();
  const {prepareIntakeFileAction,finishIntakeFileAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
  const {uploadIntakeOriginal}=await import('@/modules/eingang/public');
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLp8AAAAASUVORK5CYII=','base64');
  const input={itemId:randomUUID(),fileId:randomUUID(),name:'synthetisch.png',mime:'image/png',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),captureOrigin:'warenfoto' as const};
  const grant=await withSession(actor,()=>prepareIntakeFileAction(input));if(grant.code!=='OK')throw Error('E40_PHOTO_GRANT:'+grant.message);
  if(grant.upload)expect((await uploadIntakeOriginal(grant.upload,new File([Uint8Array.from(bytes).buffer],input.name,{type:input.mime}))).ok).toBe(true);
  expect(await withSession(actor,()=>finishIntakeFileAction(input.fileId))).toMatchObject({code:'OK'});
  expect(analyzeWithAzureDocumentIntelligence).not.toHaveBeenCalled();
  expect(await sql`SELECT aufnahme_herkunft FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.fileId}::uuid`).toEqual([{aufnahme_herkunft:'warenfoto'}]);
  expect(await withSession(actor,()=>getIntakeCaptureAction(input.itemId))).toMatchObject({code:'OK',capture:{files:[{id:input.fileId,captureOrigin:'warenfoto',readable:false,status:'fertig'}]}});
 }));
});

describe("P56 C02: last customer handover",()=>{
 it("reads the last real order through the existing customer search without changing customer preferences",async()=>{
  const actor=await createFixture();const suffix=randomUUID();
  const {createCustomerAction}=await import('@/app/actions/customers.actions');
  const created=await withSession(actor,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'SYNTHETISCH Übergabe '+suffix,
   salutation:'ohne',firstName:'Ada',lastName:'Prüfung',phone:'+49 711 5550190',email:'last-handover@example.invalid',street:'Kundenweg',houseNumber:'8',zipCode:'70176',city:'Stuttgart',country:'DE',paymentPreference:'vorkasse'}));
  if(created.code!=='OK')throw Error('C02_CUSTOMER_REQUIRED:'+created.message);
  const {erfasseAuftragAusEingangAction}=await import('@/app/actions/eingang.actions');
  const input={geprueft:true,clientKey:randomUUID(),text:null,customer:{mode:'EXISTING' as const,customerId:created.customer.id},dueDate:'2026-11-20',termStatus:'bestaetigt' as const,intakeSource:'persoenlich' as const,handoverMode:'shipping' as const,paymentMode:'vorkasse' as const,
   items:[{catalogServiceId:null,name:'SYNTHETISCH Versand',quantity:1,material:null,surfaceRequested:'verzinken',executionRequested:'offen' as const,unit:'stueck',unitPriceCents:null,vatRateBasisPoints:null}]};
  const booked=await withSession(actor,()=>erfasseAuftragAusEingangAction(input));if(booked.code!=='OK')throw Error('C02_BOOKING_REQUIRED:'+booked.message);
  const {searchOrderIntakeCustomersAction}=await import('@/app/warendurchlauf/actions');
  const found=await withSession(actor,()=>searchOrderIntakeCustomersAction({query:created.customer.customerNumber!}));
  expect(found).toMatchObject({ok:true,data:{customers:[expect.objectContaining({id:created.customer.id,handoverPreference:null,lastHandoverMode:'shipping'})]}});
  expect(await sql`SELECT handover_preference FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${created.customer.id}`).toEqual([{handover_preference:null}]);
  expect(await sql`SELECT handover_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${booked.orderId}`).toEqual([{handover_mode:'shipping'}]);
 });
});

describe("P44 Aus Mail: the actual read action keeps the canonical intake unchanged",()=>{
 it("requires Mails, reads the stored source and preserves assignment, version and event count",async()=>{
  const actor=await createFixture("meister",["eingang","auftraege","kunden","geld","mails"]),denied=await createFixture();
  const {saveIntakeNoteAction,getOpenIntakeMailsAction,getIntakeCaptureAction}=await import("@/app/actions/eingang.actions");
  const itemId=randomUUID(),text="SYNTHETISCH Mail-Auswahl";
  const saved=await withSession(actor,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text,concerns:[]}));
  expect(saved.code).toBe("OK");
  await sql`UPDATE public.intake_item SET kanal='mail',betreff='SYNTHETISCH P44 Mail',absender_adresse='p44@example.invalid',zuordnung='offen',einsatz='offen' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
  const snapshot=()=>sql`SELECT kanal,text,kunde_id,vorgang_id,zuordnung,einsatz,version,(SELECT count(*)::int FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid) AS events FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
  const before=await snapshot();
  expect(await withSession(denied,getOpenIntakeMailsAction)).toMatchObject({code:"FORBIDDEN"});
  // Existing Mails right also protects a known source ID, not only the list/entry button.
  expect(await withSession(denied,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'FORBIDDEN'});
  expect(await withSession(denied,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'SYNTHETISCH unzulässige Änderung',concerns:[]}))).toMatchObject({code:'FORBIDDEN'});
  const mails=await withSession(actor,getOpenIntakeMailsAction);expect(mails.code).toBe("OK");
  if(mails.code!=="OK")throw Error("P44_MAIL_READ_REQUIRED");expect(mails.mails.find(row=>row.id===itemId)).toMatchObject({subject:"SYNTHETISCH P44 Mail",fileCount:0});
  expect(await withSession(actor,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:"OK",capture:{id:itemId,text}});
  expect(await snapshot()).toEqual(before);
 });
});

describe("AP-EIN device handover: real Actions, Storage, DB and refresh",()=>{
 it("rein.abnahme[12]: two phone photos stay at the same intake and finish exactly once",async()=>withLocalReplayStorage(async()=>{
  const fixture=await createFixture(),deviceId=randomUUID(),itemId=randomUUID();
  const {saveIntakeDeviceRequestAction,prepareIntakeFileAction,finishIntakeFileAction,getIntakeCaptureAction}=await import("@/app/actions/eingang.actions");
  const requested=await withSession(fixture,()=>saveIntakeDeviceRequestAction({command:"request",itemId}));
  expect(requested.code).toBe("OK");
  if(requested.code!=="OK"||!requested.token)throw Error("DEVICE_TOKEN_REQUIRED");
  expect(requested.token).toMatch(/^[a-f0-9]{32}$/);
  const requestId=requested.requests[0].id;
  const [row]=await sql`SELECT token_hash,token_sitzung,status,item_id::text FROM public.device_request WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${requestId}::uuid`;
  expect(row).toEqual({token_hash:createHash("sha256").update(requested.token).digest("hex"),token_sitzung:"",status:"angefordert",item_id:itemId});
  const accepted=await withSession(fixture,()=>saveIntakeDeviceRequestAction({command:"accept",token:requested.token,deviceId}));
  expect(accepted).toMatchObject({code:"OK",requests:[{id:requestId,itemId,status:"angenommen",acceptedOn:[deviceId]}]});
  const repeated=await withSession(fixture,()=>saveIntakeDeviceRequestAction({command:"accept",token:requested.token,deviceId}));
  expect(repeated).toEqual(accepted);
  const {uploadIntakeOriginal}=await import("@/modules/eingang/public");
  const bytes=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLp8AAAAASUVORK5CYII=","base64");
  for(let photo=1;photo<=2;photo+=1){
   const fileId=randomUUID(),name="Handy-"+photo+".png",mime="image/png";
   const grant=await withSession(fixture,()=>prepareIntakeFileAction({itemId,fileId,name,mime,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),deviceId}));
   expect(grant.code).toBe("OK");if(grant.code!=="OK")throw Error("DEVICE_FILE_GRANT_REQUIRED");
   if(grant.upload)expect((await uploadIntakeOriginal(grant.upload,new File([Uint8Array.from(bytes).buffer],name,{type:mime}))).ok).toBe(true);
   const finished=await withSession(fixture,()=>finishIntakeFileAction(fileId));
   expect(finished).toMatchObject({code:"OK",capture:{id:itemId}});
  }
  const refreshed=await withSession(fixture,()=>saveIntakeDeviceRequestAction({command:"refresh",requestId}));
  expect(refreshed).toMatchObject({code:"OK",requests:[{id:requestId,status:"fotos_da",photoCount:2}]});
  const ended=await withSession(fixture,()=>saveIntakeDeviceRequestAction({command:"end",requestId,deviceId,reason:"fertig"}));
  expect(ended).toMatchObject({code:"OK",requests:[{id:requestId,itemId,status:"beendet",finishedOn:[deviceId],photoCount:2}]});
  const eventsBefore=await sql`SELECT id::text,art FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid ORDER BY id`;
  expect(await withSession(fixture,()=>saveIntakeDeviceRequestAction({command:"end",requestId,deviceId,reason:"fertig"}))).toEqual(ended);
  const eventsAfter=await sql`SELECT id::text,art FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid ORDER BY id`;
  expect(eventsAfter).toEqual(eventsBefore);
  const [proof]=await sql`SELECT status,beendet_art,(SELECT count(*)::int FROM public.intake_file f WHERE f.item_id=r.item_id AND f.tenant_id=r.tenant_id) AS files
   FROM public.device_request r WHERE r.id=${requestId}::uuid AND r.tenant_id=${KREILE_TENANT_SLUG}`;
  expect(proof).toEqual({status:"beendet",beendet_art:"fertig",files:2});
  const fresh=await withSession(fixture,()=>getIntakeCaptureAction(itemId));
  expect(fresh).toMatchObject({code:"OK",capture:{id:itemId,files:[{name:"Handy-1.png",readable:true},{name:"Handy-2.png",readable:true}]}});
 }));
});

// Owner F09: closing the capture over an intake flags its original; no deletion.
describe("AP-EIN F09: capture cancellation through the real action",()=>{
 it("keeps the original and records in_erfassung_verworfen exactly once",async()=>{
  const fixture=await createFixture();
  const {saveIntakeNoteAction,discardIntakeCaptureAction,getIntakeCaptureAction}=await import("@/app/actions/eingang.actions");
  const itemId=randomUUID(),text="Prüfnotiz eins";
  const saved=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text,concerns:[]}));
  expect(saved.code).toBe("OK");if(saved.code!=="OK")throw Error("F09_ORIGINAL_REQUIRED");
  const input={itemId,version:saved.capture.version,clientEventId:randomUUID()};
  const discarded=await withSession(fixture,()=>discardIntakeCaptureAction(input));
  expect(discarded).toMatchObject({code:"OK",capture:{id:itemId,text,usage:"info"}});
  const [row]=await sql`SELECT text,einsatz,kennzeichen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
  expect(row).toEqual({text,einsatz:"info",kennzeichen:["in_erfassung_verworfen"]});
  expect(await withSession(fixture,()=>discardIntakeCaptureAction(input))).toEqual(discarded);
  const events=await sql`SELECT art,nachher->>'grund' AS grund FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid ORDER BY zeit,id`;
  expect(events.filter(event=>event.art==="original_gespeichert")).toHaveLength(1);
  expect(events.filter(event=>event.art==="einsatz")).toEqual([{art:"einsatz",grund:"in Erfassung verworfen"}]);
  expect(await withSession(fixture,()=>getIntakeCaptureAction(itemId))).toEqual(discarded);
 });
});

// Owner E07 / AP-01 idempotency, with adopted 3.0 originals: one order, no second intake.
describe("AP-EIN E18 / PositionZeile.rechte: catalog without money",()=>{
 it("books the canonical catalog price server-side and rereads without exposing monetary fields",async()=>{
  const owner=await createFixture("meister",["eingang","auftraege","kunden","geld","einstellungen"]);
  const worker=await createFixture("werkstatt",["eingang","auftraege","kunden"]);
  const {createCustomerAction}=await import("@/app/actions/customers.actions");
  const customer=await withSession(owner,()=>createCustomerAction({clientEventId:randomUUID(),customerType:"business",companyName:"SYNTHETISCH Katalog ohne Geld "+randomUUID().slice(0,8),
   salutation:"ohne",firstName:"Ada",lastName:"Kundin",email:"katalog-ohne-geld@example.invalid",phone:"+49 711 5550190",street:"Kundenweg",houseNumber:"18",zipCode:"70176",city:"Stuttgart",country:"DE",paymentPreference:"vorkasse",vatId:null,notes:null}));
  if(customer.code!=="OK")throw Error("E18_CUSTOMER_REQUIRED:"+customer.message);expect(customer.code).toBe("OK");
  const {saveCatalogServiceAction}=await import("@/app/actions/settings.actions");
  const service=await withSession(owner,()=>saveCatalogServiceAction({id:null,name:"SYNTHETISCH Katalog "+randomUUID().slice(0,8),surface:"verchromen",unit:"stueck",netPriceCents:12345,vatRateBasisPoints:1900,standardLeadTimeWorkingDays:6,active:true}));
  expect(service.code).toBe("OK");if(service.code!=="OK")throw Error("E18_SERVICE_REQUIRED");
  const {getIntakeCatalogAction}=await import("@/app/actions/catalog.actions");
  const catalog=await withSession(worker,getIntakeCatalogAction);
  expect(catalog.code).toBe("OK");if(catalog.code!=="OK")throw Error("E18_CATALOG_REQUIRED");
  const choice=catalog.services.find(row=>row.id===service.service.id);
  expect(choice).toMatchObject({name:service.service.name,unit:"stueck",surface:"verchromen"});
  expect(JSON.stringify(catalog)).not.toMatch(/netPriceCents|vatRateBasisPoints/);
  const {erfasseAuftragAusEingangAction}=await import("@/app/actions/eingang.actions");
  const input={ geprueft: true,clientKey:randomUUID(),text:null,customer:{mode:"EXISTING" as const,customerId:customer.receipt.customerId},dueDate:"2026-11-19",intakeSource:"persoenlich" as const,
   termStatus:"bestaetigt" as const,handoverMode:"pickup" as const,
   items:[{catalogServiceId:service.service.id,name:service.service.name,quantity:2,material:null,surfaceRequested:"verchromen",executionRequested:"offen" as const,unit:"stueck",unitPriceCents:null,vatRateBasisPoints:null}]};
  const first=await withSession(worker,()=>erfasseAuftragAusEingangAction(input));
  expect(first.code).toBe("OK");if(first.code!=="OK")throw Error("E18_BOOK_FAILED:"+first.code+":"+first.message);
  const [stored]=await sql`SELECT item.catalog_service_id::text,item.unit,round(item.preis_netto*100)::int AS price,item.vat_rate_basis_points,
    (SELECT count(*)::int FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${first.orderId} AND event_type='ORDER_INTAKE_CREATED_V1') AS events
    FROM public.items item WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${first.orderId}`;
  expect(stored).toEqual({catalog_service_id:service.service.id,unit:"stueck",price:12345,vat_rate_basis_points:1900,events:1});
  expect(await withSession(worker,()=>erfasseAuftragAusEingangAction(input))).toMatchObject({code:"OK",orderId:first.orderId,replayed:true});
  const {getOrderIntakeReceiptAction}=await import("@/app/warendurchlauf/actions");
  const readback=await withSession(worker,()=>getOrderIntakeReceiptAction({orderId:first.orderId,clientEventId:input.clientKey}));
  expect(readback).toMatchObject({ok:true,data:{orderId:first.orderId,items:[{catalogServiceId:service.service.id,unit:"stueck"}]}});
  expect(JSON.stringify(readback)).not.toMatch(/unitPriceCents|vatRateBasisPoints/);
  // BAUPLAN PositionZeile: kg accepts up to three decimals; the same contract governs suggestions and booking.
  const massService = await withSession(owner, () => saveCatalogServiceAction({id:null,name:"SYNTHETISCH Massenteil "+randomUUID().slice(0,8),surface:"verchromen",unit:"kg",netPriceCents:12345,vatRateBasisPoints:1900,standardLeadTimeWorkingDays:6,active:true}));
  expect(massService.code).toBe("OK"); if(massService.code!=="OK")throw Error("DECIMAL_CATALOG_REQUIRED");
  await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,tagesleistung_eur)
    SELECT 'h18-intake-suggestions',${KREILE_TENANT_SLUG},'SYNTHETISCH Vorschlagsprüfung',800
    WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
  const {getOrderIntakeSuggestionsAction}=await import("@/app/warendurchlauf/actions");
  const suggestionInput={customerId:customer.receipt.customerId,kind:"ORDER" as const,wishDate:null,
    positions:[{key:"synthetic-mass",catalogServiceId:massService.service.id,name:massService.service.name,quantity:0.125,surfaceRequested:"verchromen",unit:"kg",unitPriceCents:null}]};
  const suggestions=await withSession(owner,()=>getOrderIntakeSuggestionsAction(suggestionInput));
  expect(suggestions).toMatchObject({ok:true,data:{prices:[{positionKey:"synthetic-mass",unit:"kg",unitPriceCents:12345,lineTotalCents:1543}]}});
  const massInput={...input,clientKey:randomUUID(),items:[{...input.items[0]!,catalogServiceId:massService.service.id,name:massService.service.name,unit:"kg",quantity:0.125}]};
  const mass=await withSession(worker,()=>erfasseAuftragAusEingangAction(massInput));
  expect(mass.code).toBe("OK");if(mass.code!=="OK")throw Error("DECIMAL_BOOK_FAILED:"+mass.code+":"+mass.message);
  const [massStored]=await sql`SELECT item.quantity::float8 AS quantity,item.unit,round(item.quantity*item.preis_netto*100)::int AS net_line_cents,
    (SELECT count(*)::int FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${mass.orderId} AND event_type='ORDER_INTAKE_CREATED_V1') AS events
    FROM public.items item WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${mass.orderId}`;
  expect(massStored).toEqual({quantity:0.125,unit:"kg",net_line_cents:1543,events:1});
  expect(await withSession(worker,()=>getOrderIntakeReceiptAction({orderId:mass.orderId,clientEventId:massInput.clientKey})))
    .toMatchObject({ok:true,data:{orderId:mass.orderId,items:[{unit:"kg",quantity:0.125}]}});
  expect(await withSession(owner,()=>getOrderIntakeSuggestionsAction({...suggestionInput,positions:[{...suggestionInput.positions[0]!,unit:"stueck"}]}))).toMatchObject({ok:false,error:"QUERY_ERROR"});
 });
});

describe("AP-EIN adopted originals remain on the single order path",()=>{
 it("books and rereads the same original; retry and a competing booking cannot create another order",async()=>{
  const fixture=await createFixture();
  const {createCustomerAction}=await import("@/app/actions/customers.actions");
  const customer=await withSession(fixture,()=>createCustomerAction({clientEventId:randomUUID(),customerType:"business",companyName:"SYNTHETISCH Originalbindung "+randomUUID().slice(0,8),
   salutation:"ohne",firstName:"Ada",lastName:"Kundin",email:"originalbindung@example.invalid",phone:"+49 711 5550190",street:"Kundenweg",houseNumber:"18",zipCode:"70176",city:"Stuttgart",country:"DE",paymentPreference:"vorkasse",vatId:null,notes:null}));
  if(customer.code!=="OK")throw Error("CAPTURE_BINDING_CUSTOMER_REQUIRED:"+customer.message);expect(customer.code).toBe("OK");
   const {saveIntakeNoteAction,erfasseAuftragAusEingangAction,getIntakeCaptureAction,saveIntakeDraftAction}=await import("@/app/actions/eingang.actions");
   // Owner model D06: successful booking removes the same login's draft atomically.
   const draftId=randomUUID();
   expect(await withSession(fixture,()=>saveIntakeDraftAction({id:draftId,clientEventId:randomUUID(),art:"eingang",payload:{clientKey:randomUUID(),text:"SYNTHETISCH D06"},lastField:"eingang.menge",expectedVersion:null}))).toMatchObject({code:"OK"});
  const itemId=randomUUID();
  const source=await withSession(fixture,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:"Synthetisch zwei Teile",concerns:[]}));
  expect(source.code).toBe("OK");if(source.code!=="OK")throw Error("CAPTURE_BINDING_ORIGINAL_REQUIRED");
   const input={ geprueft: true,draftId,clientKey:randomUUID(),text:null,customer:{mode:"EXISTING" as const,customerId:customer.receipt.customerId},dueDate:"2026-11-19",intakeSource:"persoenlich" as const,
   termStatus:"bestaetigt" as const,handoverMode:"pickup" as const,paymentMode:"vorkasse" as const,sourceCaptures:[{id:itemId,version:source.capture.version}],
   items:[{catalogServiceId:null,name:"Synthetisches Teil",quantity:2,material:null,surfaceRequested:"verchromen",executionRequested:"offen" as const,unit:"stueck",unitPriceCents:null,vatRateBasisPoints:null}]};
  const first=await withSession(fixture,()=>erfasseAuftragAusEingangAction(input));
  expect(first).toMatchObject({code:"OK",intakeItemId:itemId,replayed:false});if(first.code!=="OK")throw Error("CAPTURE_BINDING_BOOK_FAILED:"+first.code+":"+first.message);
  expect(await withSession(fixture,()=>erfasseAuftragAusEingangAction(input))).toMatchObject({code:"OK",orderId:first.orderId,intakeItemId:itemId,replayed:true});
  expect(await withSession(fixture,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:"OK",capture:{id:itemId,text:"Synthetisch zwei Teile",customerId:customer.receipt.customerId,orderId:first.orderId}});
  const competingKey=randomUUID();
  const conflict=await withSession(fixture,()=>erfasseAuftragAusEingangAction({...input,clientKey:competingKey}));
  expect(conflict.code).toBe("CONFLICT");
  const [proof]=await sql`SELECT
    (SELECT count(*)::int FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientKey}) AS shadow_intakes,
    (SELECT count(*)::int FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND source_ref=${competingKey}) AS competing_orders,
    (SELECT count(*)::int FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND art='zugeordnet') AS assignments`;
  expect(proof).toEqual({shadow_intakes:0,competing_orders:0,assignments:1});
  expect(await sql`SELECT id FROM private.intake_drafts WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${draftId}::uuid`).toHaveLength(0);
 });
});

describe("Owner model D05/D07: draft actions against real Replay DB",()=>{
 it("D05 saves and rereads the exact draft; D07 never exposes another login's draft",async()=>{
  const owner=await createFixture();const other=await createFixture("werkstatt",["eingang"]);
  const {saveIntakeDraftAction,getIntakeDraftsAction,discardIntakeDraftAction}=await import("@/app/actions/eingang.actions");
  const input={id:randomUUID(),clientEventId:randomUUID(),art:"eingang",payload:{clientKey:randomUUID(),text:"SYNTHETISCH D05 Prüfnotiz Entwurf"},lastField:"eingang.kundensuche",expectedVersion:null};
  const saved=await withSession(owner,()=>saveIntakeDraftAction(input));
  expect(saved).toMatchObject({code:"OK",drafts:[{id:input.id,art:"eingang",payload:input.payload,zuletzt_feld:input.lastField,version:0}]});
  expect(await withSession(owner,()=>saveIntakeDraftAction(input))).toMatchObject({code:"OK",drafts:[{id:input.id}]});
  const [row]=await sql`SELECT art,payload,zuletzt_feld,version FROM private.intake_drafts WHERE tenant_id=${KREILE_TENANT_SLUG} AND actor_id=${owner.actorId}::uuid AND id=${input.id}::uuid`;
  expect(row).toMatchObject({art:"eingang",payload:input.payload,zuletzt_feld:input.lastField,version:0});
  expect(await withSession(other,()=>getIntakeDraftsAction())).toMatchObject({code:"OK",drafts:[]});
  expect(await withSession(owner,()=>getIntakeDraftsAction())).toMatchObject({code:"OK",drafts:[{id:input.id,payload:input.payload}]});
  const deletion={id:input.id,clientEventId:randomUUID(),expectedVersion:row.version};
  expect(await withSession(owner,()=>discardIntakeDraftAction(deletion))).toMatchObject({code:"OK",drafts:[]});
  expect(await withSession(owner,()=>discardIntakeDraftAction(deletion))).toMatchObject({code:"OK",drafts:[]});
  expect(await sql`SELECT id FROM private.intake_drafts WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.id}::uuid`).toHaveLength(0);
  expect(await sql`SELECT event_type FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${owner.actorId}::uuid AND client_event_id IN (${input.clientEventId}::uuid,${deletion.clientEventId}::uuid)`).toHaveLength(2);
 });

 it("P101 creates one tenant-bound continuation and draft, then rereads the same original",async()=>{
  const actor=await createFixture();
  const {saveIntakeNoteAction,createIntakeContinuationAction,getIntakeCaptureAction,getIntakeDraftsAction}=await import("@/app/actions/eingang.actions");
  const parentId=randomUUID(),childId=randomUUID(),draftId=randomUUID(),clientEventId=randomUUID(),text="SYNTHETISCH P101 Original mit 23 Positionen";
  const original=await withSession(actor,()=>saveIntakeNoteAction({itemId:parentId,textstand:randomUUID(),text,concerns:[]}));
  expect(original.code).toBe("OK");if(original.code!=="OK")throw Error("P101_ORIGINAL_REQUIRED");
  const payload={clientKey:childId,text,documents:[childId],items:[{key:randomUUID(),name:"SYNTHETISCH Position 21",quantity:"1"}]};
  const input={parentId,parentVersion:original.capture.version,textSourceId:parentId,childId,draftId,clientEventId,fileId:null,payload};
  const other=await createFixture("werkstatt",["eingang"]);
  expect(await withSession(other,()=>createIntakeContinuationAction(input))).toMatchObject({code:"FORBIDDEN"});
  expect(await sql`SELECT id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${childId}::uuid`).toHaveLength(0);
  expect(await withSession(actor,()=>createIntakeContinuationAction(input))).toMatchObject({code:"OK",childId,draftId,replayed:false});
  expect(await withSession(actor,()=>createIntakeContinuationAction(input))).toMatchObject({code:"OK",childId,draftId,replayed:true});
  expect(await withSession(other,()=>createIntakeContinuationAction(input))).toMatchObject({code:"FORBIDDEN"});
  const anotherId=randomUUID();
  expect(await withSession(actor,()=>createIntakeContinuationAction({...input,childId:anotherId,draftId:randomUUID(),clientEventId:randomUUID(),payload:{...payload,clientKey:anotherId,documents:[anotherId]}}))).toMatchObject({code:"CONFLICT"});
  const [row]=await sql`SELECT fortsetzung_von::text,file_id::text,text FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${childId}::uuid`;
  expect(row).toEqual({fortsetzung_von:parentId,file_id:null,text:null});
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${childId}::uuid AND art='angelegt' AND befehl_id=${clientEventId}::uuid`).toHaveLength(1);
  expect(await withSession(actor,()=>getIntakeDraftsAction())).toMatchObject({code:"OK",drafts:[{id:draftId,payload}]});
  expect(await withSession(actor,()=>getIntakeCaptureAction(childId))).toMatchObject({code:"OK",capture:{id:childId,text,continuation:{sourceId:parentId}}});
  expect(await withSession(other,()=>getIntakeCaptureAction(childId))).toMatchObject({code:"FORBIDDEN"});
  expect(await withSession(actor,()=>getIntakeCaptureAction(parentId))).toMatchObject({code:"OK",capture:{continuation:{childIds:[childId]}}});
  expect(await withSession(actor,()=>createIntakeContinuationAction({...input,payload:{...payload,text:"SYNTHETISCH verändert"}}))).toMatchObject({code:"CONFLICT"});
  const thirdId=randomUUID(),thirdDraftId=randomUUID();
  const thirdPayload={clientKey:thirdId,text,documents:[thirdId],items:[{key:randomUUID(),name:"SYNTHETISCH Position 41",quantity:"1"}]};
  expect(await withSession(actor,()=>createIntakeContinuationAction({parentId:childId,parentVersion:1,textSourceId:parentId,childId:thirdId,draftId:thirdDraftId,clientEventId:randomUUID(),fileId:null,payload:thirdPayload}))).toMatchObject({code:"OK"});
  const {erfasseAuftragAusEingangAction}=await import("@/app/actions/eingang.actions");
  const position={catalogServiceId:null,name:"SYNTHETISCH Position",quantity:1,material:null,surfaceRequested:"verzinken",executionRequested:"offen" as const,unit:"stueck",unitPriceCents:null,vatRateBasisPoints:null};
  const common={geprueft:true,text,dueDate:"2026-11-19",termStatus:"bestaetigt" as const,intakeSource:"persoenlich" as const,handoverMode:"pickup" as const,paymentMode:"vorkasse" as const,items:[position]};
  const first=await withSession(actor,()=>erfasseAuftragAusEingangAction({...common,clientKey:randomUUID(),sourceCaptures:[{id:parentId,version:original.capture.version}],customer:{mode:"NEW" as const,customerType:"business" as const,companyName:"SYNTHETISCH P101 "+randomUUID(),salutation:"ohne" as const,firstName:"Ada",lastName:"Prüferin",email:"p101@example.invalid",phone:"+49 711 5550190",street:"Kundenweg",houseNumber:"7",zipCode:"70176",city:"Stuttgart",country:"DE",paymentPreference:"vorkasse"}}));
  if(first.code!=="OK")throw Error("P101_FIRST_ORDER_FAILED:"+first.message);
  const [firstOrder]=await sql<{customer_id:string}[]>`SELECT customer_id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${first.orderId}`;
  if(!firstOrder)throw Error("P101_FIRST_ORDER_MISSING");
  const second=await withSession(actor,()=>erfasseAuftragAusEingangAction({...common,clientKey:childId,draftId,sourceCaptures:[{id:childId,version:1}],customer:{mode:"EXISTING" as const,customerId:firstOrder.customer_id}}));
  if(second.code!=="OK")throw Error("P101_SECOND_ORDER_FAILED:"+second.message);
  const third=await withSession(actor,()=>erfasseAuftragAusEingangAction({...common,clientKey:thirdId,draftId:thirdDraftId,sourceCaptures:[{id:thirdId,version:1}],customer:{mode:"EXISTING" as const,customerId:firstOrder.customer_id}}));
  if(third.code!=="OK")throw Error("P102_THIRD_ORDER_FAILED:"+third.message);
  expect(second.orderId).not.toBe(first.orderId);
  expect(new Set([first.orderId,second.orderId,third.orderId]).size).toBe(3);
  expect(await sql`SELECT id::text,vorgang_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id IN (${parentId}::uuid,${childId}::uuid,${thirdId}::uuid) ORDER BY id`).toEqual(expect.arrayContaining([{id:parentId,vorgang_id:first.orderId},{id:childId,vorgang_id:second.orderId},{id:thirdId,vorgang_id:third.orderId}]));
  expect(await sql`SELECT id FROM private.intake_drafts WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${draftId}::uuid`).toHaveLength(0);
  expect(await withSession(actor,()=>getIntakeCaptureAction(childId))).toMatchObject({code:"OK",capture:{orderId:second.orderId,text,continuation:{sourceId:parentId}}});
  expect(await withSession(actor,()=>getIntakeCaptureAction(thirdId))).toMatchObject({code:"OK",capture:{orderId:third.orderId,text,continuation:{sourceId:childId}}});
 });

 it("P101 erzeugt bei zwei gleichzeitigen Versuchen genau eine Fortsetzung",async()=>{
  const actor=await createFixture(),parentId=randomUUID(),text="SYNTHETISCH gleichzeitige Fortsetzung";
  const {saveIntakeNoteAction,createIntakeContinuationAction}=await import("@/app/actions/eingang.actions");
  const parent=await withSession(actor,()=>saveIntakeNoteAction({itemId:parentId,textstand:randomUUID(),text,concerns:[]}));
  if(parent.code!=="OK")throw Error("P101_PARENT_REQUIRED");
  const input=()=>{const childId=randomUUID();return {parentId,parentVersion:parent.capture.version,textSourceId:parentId,childId,draftId:randomUUID(),clientEventId:randomUUID(),fileId:null,payload:{clientKey:childId,text,documents:[childId],items:[{key:randomUUID(),name:"SYNTHETISCH Teil",quantity:"1"}]}};};
  const [a,b]=await Promise.all([withSession(actor,()=>createIntakeContinuationAction(input())),withSession(actor,()=>createIntakeContinuationAction(input()))]);
  expect([a.code,b.code].sort()).toEqual(["CONFLICT","OK"]);
  expect(await sql`SELECT id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND fortsetzung_von=${parentId}::uuid`).toHaveLength(1);
 });

 it("P101 verknüpft gesicherte Originaldateien ohne Kopie und friert den Quellstand ein",async()=>withLocalReplayStorage(async()=>{
  const actor=await createFixture("meister",["auftraege","kunden","geld","eingang","mails"]);
  const {prepareIntakeFileAction,finishIntakeFileAction,saveIntakeNoteAction,createIntakeContinuationAction,getIntakeCaptureAction,getIntakeMessagesAction,openIntakeOriginalAction}=await import("@/app/actions/eingang.actions");
  const {uploadIntakeOriginal}=await import("@/modules/eingang/public");
  const bytes=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLp8AAAAASUVORK5CYII=","base64");
  const parentId=randomUUID(),fileId=randomUUID(),textSourceId=randomUUID(),childId=randomUUID(),draftId=randomUUID();
  const file={itemId:parentId,fileId,name:"SYNTHETISCH-P101.png",mime:"image/png",bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
  const grant=await withSession(actor,()=>prepareIntakeFileAction(file));if(grant.code!=="OK")throw Error("P101_UPLOAD_GRANT:"+grant.message);
  if(grant.upload)expect(await uploadIntakeOriginal(grant.upload,new File([Uint8Array.from(bytes).buffer],file.name,{type:file.mime}))).toMatchObject({ok:true});
  const parent=await withSession(actor,()=>finishIntakeFileAction(fileId));if(parent.code!=="OK")throw Error("P101_FILE_FINISH:"+parent.message);
  const text="SYNTHETISCH Text zu 23 Positionen";
  expect(await withSession(actor,()=>saveIntakeNoteAction({itemId:textSourceId,textstand:randomUUID(),text,concerns:[]}))).toMatchObject({code:"OK"});
  const payload={clientKey:childId,text,documents:[childId],items:[{key:randomUUID(),name:"SYNTHETISCH Position 21",quantity:"1"}]};
  const command={parentId,parentVersion:parent.capture.version,textSourceId,childId,draftId,clientEventId:randomUUID(),fileId,payload};
  expect(await withSession(actor,()=>createIntakeContinuationAction(command))).toMatchObject({code:"OK",replayed:false});
  expect(await withSession(actor,()=>getIntakeCaptureAction(childId))).toMatchObject({code:"OK",capture:{text,files:[{id:fileId,secured:true}],continuation:{sourceId:parentId}}});
  expect(await sql`SELECT item_id::text FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fileId}::uuid`).toEqual([{item_id:parentId}]);
  expect(await sql`SELECT file_id::text,fortsetzung_von::text FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${childId}::uuid`).toEqual([{file_id:fileId,fortsetzung_von:parentId}]);
  expect(await sql`SELECT id FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${childId}::uuid`).toHaveLength(0);
  const thirdId=randomUUID(),thirdDraftId=randomUUID();
  const thirdPayload={clientKey:thirdId,text,documents:[thirdId],items:[{key:randomUUID(),name:"SYNTHETISCH Position 41",quantity:"1"}]};
  expect(await withSession(actor,()=>createIntakeContinuationAction({parentId:childId,parentVersion:1,textSourceId,childId:thirdId,draftId:thirdDraftId,clientEventId:randomUUID(),fileId,payload:thirdPayload}))).toMatchObject({code:"OK",replayed:false});
  expect(await withSession(actor,()=>getIntakeCaptureAction(thirdId))).toMatchObject({code:"OK",capture:{text,files:[{id:fileId,secured:true}],continuation:{sourceId:childId,textSourceId}}});
  expect(await sql`SELECT file_id::text,fortsetzung_von::text FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${thirdId}::uuid`).toEqual([{file_id:fileId,fortsetzung_von:childId}]);
  expect(await sql`SELECT id FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id IN (${childId}::uuid,${thirdId}::uuid)`).toHaveLength(0);
  const messages=await withSession(actor,()=>getIntakeMessagesAction('alle'));
  if(messages.code!=="OK")throw Error("P102_MESSAGE_READ_FAILED:"+messages.message);
  expect(messages.messages.find(row=>row.id===thirdId)).toMatchObject({text,fileIds:[fileId]});
  expect(await withSession(actor,()=>openIntakeOriginalAction({fileId,clientEventId:randomUUID()}))).toMatchObject({code:"OK",original:{id:fileId,sha256:file.sha256,restricted:false}});
  const {erfasseAuftragAusEingangAction}=await import('@/app/actions/eingang.actions');
  const {getDomainAttachmentsAction}=await import('@/app/actions/domainAttachments.actions');
  const position={catalogServiceId:null,name:'SYNTHETISCH Position',quantity:1,material:null,surfaceRequested:'verzinken',executionRequested:'offen' as const,unit:'stueck',unitPriceCents:null,vatRateBasisPoints:null};
  const booked=await withSession(actor,()=>erfasseAuftragAusEingangAction({geprueft:true,text,dueDate:'2026-11-19',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'pickup',paymentMode:'vorkasse',items:[position],clientKey:thirdId,draftId:thirdDraftId,sourceCaptures:[{id:thirdId,version:1}],customer:{mode:'NEW',customerType:'business',companyName:'SYNTHETISCH Original '+randomUUID(),salutation:'ohne',firstName:'Ada',lastName:'Prüferin',email:'original@example.invalid',phone:'+49 711 5550190',street:'Kundenweg',houseNumber:'7',zipCode:'70176',city:'Stuttgart',country:'DE',paymentPreference:'vorkasse'}}));
  if(booked.code!=='OK')throw Error('P103_ORDER_BOOK_FAILED:'+booked.message);
  await sql`UPDATE public.intake_item SET erstellt_am=statement_timestamp()-interval '100 days' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${thirdId}::uuid`;
  const orderOnly=await createFixture('werkstatt',['auftraege']);
  const listed=await withSession(orderOnly,()=>getDomainAttachmentsAction({targetType:'ORDER',targetId:booked.orderId}));
  expect(listed).toMatchObject({code:'OK',data:expect.arrayContaining([expect.objectContaining({attachmentId:fileId,intakeOriginal:true,intakePart:3,intakeTotal:3,intakeSecured:true})])});
  const openEvent=randomUUID();
  expect(await withSession(orderOnly,()=>openIntakeOriginalAction({fileId,orderId:booked.orderId,clientEventId:openEvent}))).toMatchObject({code:'OK',original:{id:fileId,sha256:file.sha256,restricted:false}});
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${parentId}::uuid AND befehl_id=${openEvent}::uuid AND nachher->>'action'='original_geoeffnet'`).toHaveLength(1);
  expect(await withSession(orderOnly,()=>getDomainAttachmentsAction({targetType:'ORDER',targetId:booked.orderId}))).toMatchObject({code:'OK',data:expect.arrayContaining([expect.objectContaining({attachmentId:fileId,intakePart:3,intakeTotal:3})])});
  const noRights=await createFixture('werkstatt',[]);
  expect(await withSession(noRights,()=>openIntakeOriginalAction({fileId,orderId:booked.orderId,clientEventId:randomUUID()}))).toMatchObject({code:'FORBIDDEN'});
  expect(await withSession(orderOnly,()=>openIntakeOriginalAction({fileId,orderId:randomUUID(),clientEventId:randomUUID()}))).not.toMatchObject({code:'OK'});
  expect(await sql`SELECT item_id::text FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fileId}::uuid`).toEqual([{item_id:parentId}]);
 }));

 it("P66 keeps the newer draft when an older browser session saves later",async()=>{
  const owner=await createFixture();
  const {saveIntakeDraftAction,getIntakeDraftsAction}=await import("@/app/actions/eingang.actions");
  const id=randomUUID(),clientKey=randomUUID();
  const first=await withSession(owner,()=>saveIntakeDraftAction({id,clientEventId:randomUUID(),art:"eingang",payload:{clientKey,text:"SYNTHETISCH erster Stand"},lastField:"eingang.erfassen-text",expectedVersion:null}));
  expect(first.code).toBe("OK");if(first.code!=="OK")throw Error("DRAFT_FIRST_SAVE_REQUIRED");
  const firstTab=first.drafts.find(draft=>draft.id===id);
  const secondTab=(await withSession(owner,()=>getIntakeDraftsAction()));
  expect(secondTab.code).toBe("OK");if(!firstTab||secondTab.code!=="OK")throw Error("DRAFT_TWO_TABS_REQUIRED");
  const secondSnapshot=secondTab.drafts.find(draft=>draft.id===id);
  if(!secondSnapshot)throw Error("DRAFT_SECOND_TAB_REQUIRED");
  expect(firstTab.version).toBe(0);expect(secondSnapshot.version).toBe(0);

  const newer={id,clientEventId:randomUUID(),art:"eingang" as const,payload:{clientKey,text:"SYNTHETISCH neuer Stand"},lastField:"eingang.erfassen-text",expectedVersion:secondSnapshot.version};
  expect(await withSession(owner,()=>saveIntakeDraftAction(newer))).toMatchObject({code:"OK",drafts:[{id,version:1,payload:newer.payload}]});

  const stale={id,clientEventId:randomUUID(),art:"eingang" as const,payload:{clientKey,text:"SYNTHETISCH alter Tab"},lastField:"eingang.erfassen-text",expectedVersion:firstTab.version};
  expect(await withSession(owner,()=>saveIntakeDraftAction(stale))).toMatchObject({code:"CONFLICT",message:"Entwurf wurde inzwischen geändert · Eingaben bleiben erhalten."});
  const [stored]=await sql`SELECT version,payload FROM private.intake_drafts WHERE tenant_id=${KREILE_TENANT_SLUG} AND actor_id=${owner.actorId}::uuid AND id=${id}::uuid`;
  expect(stored).toEqual({version:1,payload:newer.payload});
 });
});

// Owner model RT02: retry reads the same secured original; no second original.
describe("Owner model RT02: recognition retry against Replay DB",()=>{
 it("RT02 preserves the original and records one retry result",async()=>withLocalReplayStorage(async()=>{
  const fixture=await createFixture();
  const {prepareIntakeFileAction,finishIntakeFileAction,retryIntakeRecognitionAction,getIntakeCaptureAction}=await import("@/app/actions/eingang.actions");
  const {uploadIntakeOriginal}=await import("@/modules/eingang/public");
  const bytes=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLp8AAAAASUVORK5CYII=","base64");
  const input={itemId:randomUUID(),fileId:randomUUID(),name:"SYNTHETISCH-RT02.png",mime:"image/png",bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
  const grant=await withSession(fixture,()=>prepareIntakeFileAction(input));
  expect(grant.code).toBe("OK");if(grant.code!=="OK")throw Error("RT02_UPLOAD_REQUIRED");
  if(grant.upload)expect(await uploadIntakeOriginal(grant.upload,new File([Uint8Array.from(bytes).buffer],input.name,{type:input.mime}))).toMatchObject({ok:true});
  expect(await withSession(fixture,()=>finishIntakeFileAction(input.fileId))).toMatchObject({code:"OK",capture:{files:[{id:input.fileId,status:"fertig"}]}});
  // The supplied RT02 precondition is a persisted recognition failure, never a mock DB.
  await sql`UPDATE public.intake_file SET erkennung_status='fehler' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.fileId}::uuid`;
  const retry={fileId:input.fileId,clientEventId:randomUUID()};
  const result=await withSession(fixture,()=>retryIntakeRecognitionAction(retry));
  expect(result).toMatchObject({code:"OK",capture:{files:[{id:input.fileId,status:"fertig"}]}});
  expect(await withSession(fixture,()=>retryIntakeRecognitionAction(retry))).toEqual(result);
  expect(await withSession(fixture,()=>getIntakeCaptureAction(input.itemId))).toEqual(result);
  expect(await sql`SELECT id FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid`).toHaveLength(1);
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid AND art='erkannt' AND befehl_id=${retry.clientEventId}::uuid`).toHaveLength(1);
 }));
});

async function goodsActorFixture(areas?:string[]){
 const actor=await createFixture('meister',areas);const {createCustomerAction}=await import('@/app/actions/customers.actions');
 const created=await withSession(actor,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'SYNTHETISCH Warenprüfung '+randomUUID().slice(0,8),salutation:'ohne',firstName:'Ada',lastName:'Testperson',email:'synthetic-goods@fixture.invalid',phone:'+49 711 5550190',street:'Kundenweg',houseNumber:'18',zipCode:'70176',city:'Stuttgart',country:'DE',paymentPreference:'vorkasse',vatId:null,notes:null}));
 if(created.code!=='OK')throw Error('GOODS_CUSTOMER_FIXTURE:'+created.message);return {...actor,customerId:created.receipt.customerId};
}

describe('AP-EIN G01/G05/G06/G07 real task actions',()=>{
 it('creates one task, rereads, changes its date, completes with a history note, and repeats without new rows/events',async()=>{
  const actor=await goodsActorFixture();
  const {saveIntakeTaskAction,getIntakeTaskAction,completeIntakeTaskAction}=await import('@/app/actions/eingang.actions');
  const input:TaskSaveInput={clientKey:randomUUID(),version:0,kind:'aufgabe',title:'SYNTHETISCH Aufgabe G01',dueDate:'2027-01-15',time:null,forLogin:actor.actorId,forArea:null,reference:{type:'kunde',id:actor.customerId},note:null};
  const created=await withSession(actor,()=>saveIntakeTaskAction(input));if(created.code!=='OK')throw Error('TASK_CREATE_FAILED:'+created.code+':'+created.message);
  const [written]=await sql`SELECT art,titel,faellig_am::text,vorlauf_tage,fuer_login::text,fuer_bereich,bezug_typ,bezug_id,status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientKey}::uuid`;
  expect(written).toEqual({art:'aufgabe',titel:input.title,faellig_am:input.dueDate,vorlauf_tage:0,fuer_login:actor.actorId,fuer_bereich:null,bezug_typ:'kunde',bezug_id:actor.customerId,status:'offen'});
  expect(await withSession(actor,()=>getIntakeTaskAction({taskId:created.task.id}))).toMatchObject({code:'OK',task:{id:created.task.id,status:'offen',version:1},reference:{id:actor.customerId},canEdit:true,canComplete:true});
  const beforeRepeat=await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} ORDER BY id`;
  expect(await withSession(actor,()=>saveIntakeTaskAction(input))).toEqual({...created,replayed:true});
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} ORDER BY id`).toEqual(beforeRepeat);
  const changedInput={...input,taskId:created.task.id,version:1,dueDate:'2027-01-18'};
  const changed=await withSession(actor,()=>saveIntakeTaskAction(changedInput));expect(changed).toMatchObject({code:'OK',task:{version:2,faellig_am:'2027-01-18'}});
  expect(await withSession(actor,()=>saveIntakeTaskAction(changedInput))).toEqual({...changed,replayed:true});
  const completedInput={taskId:created.task.id,version:2,note:'SYNTHETISCH G05 erledigt'};
  const completed=await withSession(actor,()=>completeIntakeTaskAction(completedInput));expect(completed).toMatchObject({code:'OK',task:{status:'erledigt',erledigt_notiz:completedInput.note,erledigt_von:actor.actorId,version:3}});
  const notes=await sql`SELECT kanal,richtung,text,kunde_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND kunde_id=${actor.customerId} AND text=${completedInput.note}`;
  expect(notes).toEqual([{kanal:'notiz',richtung:'intern',text:completedInput.note,kunde_id:actor.customerId}]);
  const effects=await sql`SELECT event.nachher->>'action' AS action FROM public.intake_event event WHERE tenant_id=${KREILE_TENANT_SLUG} AND event.nachher->>'taskId'=${created.task.id} ORDER BY zeit,id`;
  expect(effects.map(row=>row.action).sort()).toEqual(['aufgabe.angelegt','aufgabe.geaendert','aufgabe.erledigt'].sort());
  expect(await withSession(actor,()=>completeIntakeTaskAction(completedInput))).toEqual({...completed,replayed:true});
  expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientKey}::uuid`).toEqual([{n:1}]);
  expect(await withSession(actor,()=>getIntakeTaskAction({taskId:created.task.id}))).toMatchObject({code:'OK',task:{status:'erledigt',version:3},canEdit:false,canComplete:false});
 });
 it('G03 closes only the executed concern in the same transaction; stale source or unreadable target rolls everything back',async()=>{
  const actor=await goodsActorFixture();
  const {saveIntakeNoteAction,saveIntakeTaskAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
  const itemId=randomUUID();const captured=await withSession(actor,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'SYNTHETISCH bitte zurückrufen',context:{customerId:actor.customerId},concerns:['rueckruf']}));
  if(captured.code!=='OK')throw Error('TASK_SOURCE_FIXTURE_FAILED:'+captured.message);
  const input:TaskSaveInput={clientKey:randomUUID(),version:0,kind:'rueckruf',title:'SYNTHETISCH Rückruf G03',dueDate:'2027-01-15',time:'10:30',forLogin:actor.actorId,forArea:null,reference:{type:'eingang',id:itemId},note:null,itemId,itemVersion:captured.capture.version};
  const nonOwner=await createFixture('meister',['eingang']),foreignAttempt={...input,clientKey:randomUUID(),forLogin:nonOwner.actorId};
  expect(await withSession(nonOwner,()=>saveIntakeTaskAction(foreignAttempt))).toMatchObject({code:'FORBIDDEN'});
  expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${foreignAttempt.clientKey}::uuid`).toHaveLength(0);
  expect(await withSession(actor,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{version:captured.capture.version,usage:'offen'}});
  expect(await withSession(actor,()=>saveIntakeTaskAction({...input,itemVersion:input.itemVersion!+1}))).toMatchObject({code:'CONFLICT'});
  expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientKey}::uuid`).toHaveLength(0);
  const saved=await withSession(actor,()=>saveIntakeTaskAction(input));if(saved.code!=='OK')throw Error('TASK_SOURCE_SAVE_FAILED:'+saved.message);
  expect(await withSession(actor,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{concerns:['rueckruf'],usage:'erledigt'}});
  expect(await sql`SELECT anliegen_offen,einsatz FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`).toEqual([{anliegen_offen:[],einsatz:'erledigt'}]);
  const sourceEvents=await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid ORDER BY id`;
  expect(await withSession(actor,()=>saveIntakeTaskAction(input))).toEqual({...saved,replayed:true});
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid ORDER BY id`).toEqual(sourceEvents);
  const outsider=await createFixture('werkstatt',[]);
  expect(await withSession(outsider,()=>saveIntakeTaskAction({...input,clientKey:randomUUID(),itemId:undefined,itemVersion:undefined,forLogin:outsider.actorId,reference:{type:'kunde',id:actor.customerId}}))).toMatchObject({code:'FORBIDDEN'});
  const otherItem=randomUUID(),mailsActor=await createFixture('meister',['mails']);
  const other=await withSession(actor,()=>saveIntakeNoteAction({itemId:otherItem,textstand:randomUUID(),text:'SYNTHETISCH bitte zurückrufen',concerns:['rueckruf']}));
  if(other.code!=='OK')throw Error('TASK_MAILS_SOURCE_FIXTURE_FAILED');
  expect(await withSession(mailsActor,()=>saveIntakeTaskAction({...input,clientKey:randomUUID(),forLogin:mailsActor.actorId,itemId:otherItem,itemVersion:other.capture.version,reference:{type:'eingang',id:otherItem}}))).toMatchObject({code:'OK'});
  expect(await sql`SELECT anliegen_offen,einsatz FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${otherItem}::uuid`).toEqual([{anliegen_offen:[],einsatz:'erledigt'}]);
 });
});

// All expectations below come from the owner's W02/W13/W17/O02/O04/O07/O09 cases.
// Only Azure's documented replay boundary is replaced. Actions, auth, SQL and Storage are real.
import type {GoodsReceiptInput} from '@/modules/eingang/public';
import type {TaskSaveInput} from '@/modules/tasks/public';

async function orderFixture(fixture:Fixture & {customerId:string}){
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const result=await withSession(fixture,()=>createOrderIntakeAction({geprueft:false,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId:fixture.customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'anfrage_mail',handoverMode:'pickup',paymentMode:'vorkasse',note:'SYNTHETISCH Warenprüfung',items:[{catalogServiceId:null,name:'SYNTHETISCH Prüfteil',quantity:2,material:'Stahl',surfaceRequested:'verchromen',executionRequested:'offen',unit:'stueck',unitPriceCents:null,vatRateBasisPoints:null}]}));
 if(result.code!=='OK')throw Error('GOODS_ORDER_FIXTURE:'+result.code+':'+result.message);return result.receipt;
}
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLp8AAAAASUVORK5CYII=','base64');
async function originalFixture(fixture:Fixture,name='synthetic-original.png',mime='image/png',bytes=PNG){
 const {prepareIntakeFileAction,finishIntakeFileAction}=await import('@/app/actions/eingang.actions');
 const {uploadIntakeOriginal}=await import('@/modules/eingang/public');
 const itemId=randomUUID(),fileId=randomUUID(),sha256=createHash('sha256').update(bytes).digest('hex');
 const grant=await withSession(fixture,()=>prepareIntakeFileAction({itemId,fileId,name,mime,bytes:bytes.length,sha256}));
 if(grant.code!=='OK')throw Error('GOODS_ORIGINAL_GRANT:'+grant.message);
 if(grant.upload)expect((await uploadIntakeOriginal(grant.upload,new File([Uint8Array.from(bytes).buffer],name,{type:mime}))).ok).toBe(true);
 const finished=await withSession(fixture,()=>finishIntakeFileAction(fileId));
 if(finished.code!=='OK')throw Error('GOODS_ORIGINAL_FINISH:'+finished.message);
 return {itemId,fileId,sha256};
}
describe('AP-EIN owner cases: goods and original Server Actions against the real replay database',()=>{
 it('R52 warehouse gate: the canonical station Action rejects expected, unclear or returned goods without a row or event change',async()=>{
  const actor=await goodsActorFixture();
  const {transitionWareneingangToGalvanikAction}=await import('@/app/actions/orders.actions');
  const {getGoodsReceiptsAction}=await import('@/app/actions/eingang.actions');
  for(const ware of ['erwartet','abweichung','zurueck','storniert']){
   const order=await orderFixture(actor),clientEventId=randomUUID();
   // Deliberately inconsistent/stale states are confined to this isolated replay fixture.
   await sql`UPDATE public.orders SET ware=${ware} WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
   expect(await withSession(actor,()=>transitionWareneingangToGalvanikAction({orderId:order.orderId,expectedVersion:1,clientEventId}))).toMatchObject({code:'VALIDATION_ERROR'});
   expect(await sql`SELECT ware,station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{ware,station:'angenommen',version:1}]);
   expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientEventId}::uuid`).toEqual([]);
   expect(await withSession(actor,()=>getGoodsReceiptsAction(order.orderId))).toMatchObject({code:'OK',order:{ware,station:'angenommen',version:1},receipts:[]});
  }
 });
 it('R52 warehouse gate W08: the real partial receipt and station transition commit together and replay without a second event',async()=>withLocalReplayStorage(async()=>{
  const actor=await goodsActorFixture(),order=await orderFixture(actor),file=await originalFixture(actor);
  const {saveGoodsReceiptAction,getGoodsReceiptsAction}=await import('@/app/actions/eingang.actions');
  const input:GoodsReceiptInput={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:file.itemId,orderId:order.orderId,expectedOrderVersion:1,expectedVersion:0,mode:'erwartet',command:'galvanik',card:3,packagesReceived:1,packagesTotal:2,condition:'teillieferung',deviations:[],foundUnattended:false,foundAt:null,procedure:null,procedureNote:null,photos:[{fileId:file.fileId,kind:'uebersicht'}],quantities:order.items.map(item=>({itemId:item.id,expected:item.quantity,received:1,confirmed:false,note:null}))};
  const saved=await withSession(actor,()=>saveGoodsReceiptAction(input));
  expect(saved).toMatchObject({code:'OK',receipt:{id:input.id,status:'galvanik'}});
  expect(await sql`SELECT ware,station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{ware:'teilweise',station:'galvanik',version:2}]);
  expect(await withSession(actor,()=>getGoodsReceiptsAction(order.orderId))).toMatchObject({code:'OK',order:{ware:'teilweise',station:'galvanik',version:2},receipts:[{id:input.id,status:'galvanik',mengen:[{teil_id:order.items[0].id,erwartet:2,bestaetigt:1,geaendert:true}]}]});
  expect(await withSession(actor,()=>saveGoodsReceiptAction(input))).toMatchObject({code:'OK',replayed:true,receipt:{id:input.id,status:'galvanik'}});
  expect(await sql`SELECT id FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND auftrag_id=${order.orderId}`).toHaveLength(1);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid AND event_type='ORDER_STATION_MOVED_V1'`).toHaveLength(1);
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${file.itemId}::uuid AND befehl_id=${input.clientEventId}::uuid AND art='ware'`).toHaveLength(1);
 }));
 it('P48 schema: complaint source is a separate tenant-bound intake FK; the original position reference stays unchanged',async()=>{
  const actor=await goodsActorFixture(),order=await orderFixture(actor),itemId=randomUUID(),complaintId=randomUUID();
  const {saveIntakeNoteAction}=await import('@/app/actions/eingang.actions');
  expect(await withSession(actor,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'SYNTHETISCH P48 Quelle',context:{orderId:order.orderId},concerns:[]}))).toMatchObject({code:'OK'});
  await sql`INSERT INTO public.complaints(id,tenant_id,order_id,customer_id,item_id,intake_item_id,reason,description,status)
   VALUES(${complaintId},${KREILE_TENANT_SLUG},${order.orderId},${actor.customerId},${order.items[0].id},${itemId}::uuid,'other','SYNTHETISCH P48','open')`;
  expect(await sql`SELECT item_id,intake_item_id::text FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${complaintId}`).toEqual([{item_id:order.items[0].id,intake_item_id:itemId}]);
  const {getComplaints,getByOrder}=await import('@/app/actions/complaints.actions');
  expect(await withRequest('',()=>getComplaints())).toMatchObject({code:'UNAUTHENTICATED'});
  const noAccess=await createFixture('meister',['eingang']);
  expect(await withSession(noAccess,()=>getByOrder(order.orderId))).toMatchObject({code:'FORBIDDEN'});
  const read=await withSession(actor,()=>getByOrder(order.orderId));
  expect(read).toMatchObject({code:'OK',complaints:[{id:complaintId,itemId,legacyPositionId:order.items[0].id}]});
  const {complaintsRepository}=await import('@/lib/repositories/complaintsRepository');
  const projected=await withSession(actor,()=>complaintsRepository.getByCustomer(actor.customerId));
  expect(projected).toMatchObject([{id:complaintId,itemId,legacyPositionId:order.items[0].id}]);
  await expect(withSession(noAccess,()=>complaintsRepository.getAll())).rejects.toThrow('FORBIDDEN');
  const foreignSource=randomUUID(),foreignTenant='SYNTH-P48-'+randomUUID();
  await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,text)
   VALUES(${foreignSource}::uuid,${foreignTenant},${foreignSource},'notiz','intern','app',${actor.actorId}::uuid,'SYNTHETISCH fremder Mandant')`;
  const rejected=randomUUID();
  await expect(sql`INSERT INTO public.complaints(id,tenant_id,order_id,customer_id,item_id,intake_item_id,reason,description,status)
   VALUES(${rejected},${KREILE_TENANT_SLUG},${order.orderId},${actor.customerId},${order.items[0].id},${foreignSource}::uuid,'other','SYNTHETISCH abgewiesen','open')`).rejects.toMatchObject({code:'23503'});
  expect(await sql`SELECT id FROM public.complaints WHERE id=${rejected}`).toHaveLength(0);
  const foreignComplaint=randomUUID();
  await sql`INSERT INTO public.complaints(id,tenant_id,order_id,customer_id,reason,description,status)
   VALUES(${foreignComplaint},${foreignTenant},${order.orderId},${actor.customerId},'other','SYNTHETISCH NEGATIV Fremdmandant','open')`;
  expect(await withSession(actor,()=>getComplaints({tenantId:foreignTenant} as never))).toMatchObject({code:'VALIDATION_ERROR'});
  const own=await withSession(actor,()=>getComplaints());if(own.code!=='OK')throw Error('COMPLAINT_READ_REQUIRED');
  expect(own.complaints.some(row=>row.id===foreignComplaint)).toBe(false);
 });
 it('AP-EIN no DELETE: service_role cannot delete tasks or complaints, including an empty selection',async()=>{
  for(const table of ['public.tasks','public.complaints'])await expect(sql.begin(async transaction=>{
   await transaction`SET LOCAL ROLE service_role`;
   await transaction.unsafe('DELETE FROM '+table+' WHERE false');
  })).rejects.toMatchObject({code:'42501'});
 });
 it('W04: Nur annehmen creates one linked task for missing inspection, preserves the station, records history and rereads; repeated UI command is inert',async()=>{
  const actor=await goodsActorFixture(['eingang','kunden','geld']),order=await orderFixture(actor);
  const {saveGoodsReceiptAction,getGoodsReceiptsAction,getIntakeTaskAction}=await import('@/app/actions/eingang.actions');
  const [before]=await sql`SELECT station FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
  const [clock]=await sql<{today:string}[]>`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`;
  const input:GoodsReceiptInput={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:null,orderId:order.orderId,expectedOrderVersion:1,expectedVersion:0,
   mode:'erwartet',command:'accept',card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig',deviations:[],foundUnattended:false,foundAt:null,procedure:null,procedureNote:null,photos:[],
   quantities:order.items.map(item=>({itemId:item.id,expected:item.quantity,received:null,confirmed:false,note:null}))};
  const outsider=await createFixture('werkstatt',[]);
  expect(await withSession(outsider,()=>saveGoodsReceiptAction(input))).toMatchObject({code:'FORBIDDEN'});
  expect(await sql`SELECT id FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.id}::uuid`).toHaveLength(0);
  const saved=await withSession(actor,()=>saveGoodsReceiptAction(input));if(saved.code!=='OK')throw Error('W04_GOODS_TASK_FAILED:'+saved.code+':'+saved.message);
  const [written]=await sql`SELECT receipt.status,receipt.offen,task.id::text AS task_id,task.art,task.titel,task.fuer_bereich,task.faellig_am::text,task.bezug_id,orders.ware,orders.station
   FROM public.goods_receipt receipt JOIN public.tasks task ON task.tenant_id=receipt.tenant_id AND task.id=receipt.aufgabe_id
   JOIN public.orders orders ON orders.tenant_id=receipt.tenant_id AND orders.id=receipt.auftrag_id WHERE receipt.tenant_id=${KREILE_TENANT_SLUG} AND receipt.id=${input.id}::uuid`;
  expect(written).toMatchObject({status:'angenommen',offen:['Foto Paket oder Teile','Positionen prüfen'],art:'aufgabe',titel:'Foto Paket oder Teile, Positionen prüfen fehlt · '+order.orderNumber,
   fuer_bereich:'auftraege',faellig_am:clock.today,bezug_id:order.orderId,ware:'da',station:before.station});
  expect(await withSession(actor,()=>getGoodsReceiptsAction(order.orderId))).toMatchObject({code:'OK',order:{ware:'da',station:before.station},receipts:[{id:input.id,status:'angenommen'}]});
  expect(await withSession(actor,()=>getIntakeTaskAction({taskId:written.task_id}))).toMatchObject({code:'OK',task:{id:written.task_id,status:'offen',fuer_bereich:'auftraege',faellig_am:clock.today},canOpenReference:false});
  const history=await sql`SELECT id::text FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND nachher->>'taskId'=${written.task_id}`;
  expect(history).toHaveLength(1);
  expect(await withSession(actor,()=>saveGoodsReceiptAction(input))).toEqual({...saved,replayed:true});
  expect(await sql`SELECT id::text FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND nachher->>'taskId'=${written.task_id}`).toEqual(history);
  expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${order.orderId}`).toHaveLength(1);
 });
 it('R52 warehouse gate: the canonical station Action rejects expected, unclear or returned goods without a row or event change',async()=>{
  const actor=await goodsActorFixture();
  const {transitionWareneingangToGalvanikAction}=await import('@/app/actions/orders.actions');
  const {getGoodsReceiptsAction}=await import('@/app/actions/eingang.actions');
  for(const ware of ['erwartet','abweichung','zurueck','storniert']){
   const order=await orderFixture(actor),clientEventId=randomUUID();
   // Deliberately inconsistent/stale states are confined to this isolated replay fixture.
   await sql`UPDATE public.orders SET ware=${ware} WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
   expect(await withSession(actor,()=>transitionWareneingangToGalvanikAction({orderId:order.orderId,expectedVersion:1,clientEventId}))).toMatchObject({code:'VALIDATION_ERROR'});
   expect(await sql`SELECT ware,station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{ware,station:'angenommen',version:1}]);
   expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientEventId}::uuid`).toEqual([]);
   expect(await withSession(actor,()=>getGoodsReceiptsAction(order.orderId))).toMatchObject({code:'OK',order:{ware,station:'angenommen',version:1},receipts:[]});
  }
 });
 it('R52 warehouse gate W08: the real partial receipt and station transition commit together and replay without a second event',async()=>withLocalReplayStorage(async()=>{
  const actor=await goodsActorFixture(),order=await orderFixture(actor),file=await originalFixture(actor);
  const {saveGoodsReceiptAction,getGoodsReceiptsAction}=await import('@/app/actions/eingang.actions');
  const input:GoodsReceiptInput={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:file.itemId,orderId:order.orderId,expectedOrderVersion:1,expectedVersion:0,mode:'erwartet',command:'galvanik',card:3,packagesReceived:1,packagesTotal:2,condition:'teillieferung',deviations:[],foundUnattended:false,foundAt:null,procedure:null,procedureNote:null,photos:[{fileId:file.fileId,kind:'uebersicht'}],quantities:order.items.map(item=>({itemId:item.id,expected:item.quantity,received:1,confirmed:false,note:null}))};
  const saved=await withSession(actor,()=>saveGoodsReceiptAction(input));
  expect(saved).toMatchObject({code:'OK',receipt:{id:input.id,status:'galvanik'}});
  expect(await sql`SELECT ware,station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{ware:'teilweise',station:'galvanik',version:2}]);
  expect(await withSession(actor,()=>getGoodsReceiptsAction(order.orderId))).toMatchObject({code:'OK',order:{ware:'teilweise',station:'galvanik',version:2},receipts:[{id:input.id,status:'galvanik',mengen:[{teil_id:order.items[0].id,erwartet:2,bestaetigt:1,geaendert:true}]}]});
  expect(await withSession(actor,()=>saveGoodsReceiptAction(input))).toMatchObject({code:'OK',replayed:true,receipt:{id:input.id,status:'galvanik'}});
  expect(await sql`SELECT id FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND auftrag_id=${order.orderId}`).toHaveLength(1);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid AND event_type='ORDER_STATION_MOVED_V1'`).toHaveLength(1);
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${file.itemId}::uuid AND befehl_id=${input.clientEventId}::uuid AND art='ware'`).toHaveLength(1);
 }));
 it('W13 → W02/W17: saves the receipt draft, associates its real photo, accepts through the existing station command and rereads; retry cannot write again',async()=>withLocalReplayStorage(async()=>{
  const actor=await goodsActorFixture(),order=await orderFixture(actor),file=await originalFixture(actor);
  const {saveGoodsReceiptAction,getGoodsReceiptsAction}=await import('@/app/actions/eingang.actions');
  const input:GoodsReceiptInput={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:file.itemId,orderId:order.orderId,expectedOrderVersion:1,expectedVersion:0,mode:'erwartet',command:'draft',card:2,packagesReceived:1,packagesTotal:1,condition:'unauffaellig',deviations:[],foundUnattended:false,foundAt:null,procedure:null,procedureNote:null,photos:[{fileId:file.fileId,kind:'uebersicht'}],quantities:order.items.map(item=>({itemId:item.id,expected:item.quantity,received:null,confirmed:false,note:null}))};
  const draft=await withSession(actor,()=>saveGoodsReceiptAction(input));
  if(draft.code!=='OK')throw Error('GOODS_DRAFT_FAILED:'+draft.message);
  const [row]=await sql`SELECT receipt.status,receipt.zustand,source.zuordnung,source.vorgang_id FROM public.goods_receipt receipt JOIN public.intake_item source ON source.id=receipt.item_id AND source.tenant_id=receipt.tenant_id WHERE receipt.tenant_id=${KREILE_TENANT_SLUG} AND receipt.id=${input.id}::uuid`;
  expect(row).toEqual({status:'entwurf',zustand:'unauffaellig',zuordnung:'hand',vorgang_id:order.orderId});
  expect(await withSession(actor,()=>saveGoodsReceiptAction(input))).toMatchObject({code:'OK',replayed:true,receipt:{id:input.id,version:1}});
  const view=await withSession(actor,()=>getGoodsReceiptsAction(order.orderId));
  expect(view).toMatchObject({code:'OK',order:{id:order.orderId,ware:'erwartet',version:1},receipts:[{id:input.id,version:1,status:'entwurf',zustand:'unauffaellig'}]});
  const acceptance:GoodsReceiptInput={...input,clientEventId:randomUUID(),command:'galvanik',expectedVersion:draft.receipt.version,quantities:input.quantities.map(q=>({...q,confirmed:true}))};
  const accepted=await withSession(actor,()=>saveGoodsReceiptAction(acceptance));
  if(accepted.code!=='OK')throw Error('GOODS_ACCEPT_FAILED:'+accepted.message);
  const [written]=await sql`SELECT orders.ware,orders.station,orders.version,receipt.status,(SELECT count(*)::int FROM public.events e WHERE e.tenant_id=orders.tenant_id AND e.order_id=orders.id AND e.event_type='ORDER_STATION_MOVED_V1') AS moves FROM public.orders orders JOIN public.goods_receipt receipt ON receipt.tenant_id=orders.tenant_id AND receipt.auftrag_id=orders.id WHERE orders.tenant_id=${KREILE_TENANT_SLUG} AND orders.id=${order.orderId}`;
  expect(written).toEqual({ware:'da',station:'galvanik',version:2,status:'galvanik',moves:1});
  const eventsBefore=await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${file.itemId}::uuid ORDER BY id`;
  expect(await withSession(actor,()=>saveGoodsReceiptAction(acceptance))).toEqual({...accepted,replayed:true});
  expect(await withSession(actor,()=>saveGoodsReceiptAction({...acceptance,clientEventId:randomUUID(),command:'draft',expectedVersion:accepted.receipt.version,expectedOrderVersion:2}))).toMatchObject({code:'CONFLICT'});
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${file.itemId}::uuid ORDER BY id`).toEqual(eventsBefore);
  expect(await withSession(actor,()=>getGoodsReceiptsAction(order.orderId))).toMatchObject({code:'OK',order:{ware:'da',station:'galvanik',version:2},receipts:[{id:input.id,status:'galvanik',version:2}]});
 }));
 it('O02/O09: opens real unchanged bytes, then explicitly verifies suggestions once, with actor/event/readback',async()=>withLocalReplayStorage(async()=>{
  const actor=await goodsActorFixture(),file=await originalFixture(actor);
  const {openIntakeOriginalAction,confirmIntakeOriginalAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
  const suggestion=randomUUID();await sql`INSERT INTO public.intake_suggestion(id,tenant_id,item_id,file_id,feld,wert,sicherheit,fundstelle,status) VALUES(${suggestion}::uuid,${KREILE_TENANT_SLUG},${file.itemId}::uuid,${file.fileId}::uuid,'kunde','"SYNTHETISCH Vorschlag"'::jsonb,'unsicher','{"seite":1}'::jsonb,'offen')`;
  const opened=await withSession(actor,()=>openIntakeOriginalAction({fileId:file.fileId,clientEventId:randomUUID()}));
  expect(opened).toMatchObject({code:'OK',original:{id:file.fileId,sha256:file.sha256,restricted:false}});
  const [unconfirmed]=await sql`SELECT geprueft_am FROM public.intake_suggestion WHERE id=${suggestion}::uuid`;expect(unconfirmed.geprueft_am).toBeNull();
  const command={fileId:file.fileId,clientEventId:randomUUID()};
  expect(await withSession(actor,()=>confirmIntakeOriginalAction(command))).toEqual({code:'OK',count:1,replayed:false});
  const [verified]=await sql`SELECT geprueft_von::text,geprueft_am IS NOT NULL AS checked FROM public.intake_suggestion WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${suggestion}::uuid`;
  expect(verified).toEqual({geprueft_von:actor.actorId,checked:true});
  expect(await withSession(actor,()=>confirmIntakeOriginalAction(command))).toEqual({code:'OK',count:1,replayed:true});
  const events=await sql`SELECT nachher->>'action' AS action FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${file.itemId}::uuid AND art='einsatz' AND nachher->>'action'='original_geprueft'`;expect(events).toEqual([{action:'original_geprueft'}]);
  expect(await withSession(actor,()=>getIntakeCaptureAction(file.itemId))).toMatchObject({code:'OK',capture:{suggestions:[{id:suggestion,verifiedBy:actor.actorId,verifiedAt:expect.any(String),value:'SYNTHETISCH Vorschlag'}]}});
 }));
 it('O07: a login without mails gets metadata and checksum, never mail content or signed URLs',async()=>withLocalReplayStorage(async()=>{
  const actor=await goodsActorFixture(),owner=await goodsActorFixture(),body=Buffer.from('From: synthetic@fixture.invalid\nSubject: SYNTHETISCH\n\nPrivate synthetic mail body.');
  await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) VALUES(${KREILE_TENANT_SLUG},${owner.actorId}::uuid,'mails',${owner.actorId}::uuid)`;
  const file=await originalFixture(owner,'synthetic.eml','message/rfc822',body);
  await sql`UPDATE public.intake_item SET kanal='mail',text='Private synthetic mail body.' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${file.itemId}::uuid`;
  const {openIntakeOriginalAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
  expect(await withSession(actor,()=>openIntakeOriginalAction({fileId:file.fileId,clientEventId:randomUUID()}))).toMatchObject({code:'OK',original:{restricted:true,sha256:file.sha256,url:null,downloadUrl:null}});
  const before=await sql`SELECT row_to_json(source)::jsonb AS source FROM public.intake_item source WHERE source.tenant_id=${KREILE_TENANT_SLUG} AND source.id=${file.itemId}::uuid`;
  const content=await withSession(actor,()=>getIntakeCaptureAction(file.itemId));
  expect(content).toMatchObject({code:'FORBIDDEN'});
  expect(JSON.stringify(content)).not.toContain('Private synthetic mail body.');
  expect(await sql`SELECT row_to_json(source)::jsonb AS source FROM public.intake_item source WHERE source.tenant_id=${KREILE_TENANT_SLUG} AND source.id=${file.itemId}::uuid`).toEqual(before);
  const [row]=await sql`SELECT geoeffnet FROM public.intake_file WHERE id=${file.fileId}::uuid`;expect(row.geoeffnet).toBe(false);
 }));
 it('O04: executable original is blocked and recorded once in the existing audit log',async()=>withLocalReplayStorage(async()=>{
  const actor=await goodsActorFixture(),file=await originalFixture(actor,'synthetic.exe','application/octet-stream',Buffer.from('MZ synthetic blocked fixture'));
  const {openIntakeOriginalAction}=await import('@/app/actions/eingang.actions');const input={fileId:file.fileId,clientEventId:randomUUID()};
  expect(await withSession(actor,()=>openIntakeOriginalAction(input))).toMatchObject({code:'FILE_BLOCKED'});
  expect(await withSession(actor,()=>openIntakeOriginalAction(input))).toMatchObject({code:'FILE_BLOCKED'});
  expect(await sql`SELECT action FROM public.audit_log WHERE tenant_id=${KREILE_TENANT_SLUG} AND record_id=${file.fileId} AND action='FILE_BLOCKED'`).toEqual([{action:'FILE_BLOCKED'}]);
 }));
});

describe('AP-EIN M6/Nachrichten: canonical concern and use commands against real replay',()=>{
 it('M6 server contract: selection removes Lesen, preserves other open concerns and records one event; no target command means the source stays open',async()=>{
  const actor=await createFixture('meister',['eingang']),outsider=await createFixture('meister',['eingang']),itemId=randomUUID();
  const {saveIntakeNoteAction,selectIntakeConcernAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
  const saved=await withSession(actor,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'SYNTHETISCH Frist bis zum Termin',concerns:['frist']}));
  if(saved.code!=='OK')throw Error('M6_SOURCE_FIXTURE');
  await sql`UPDATE public.intake_item SET anliegen=ARRAY['lesen','frist'],anliegen_offen=ARRAY['lesen','frist'] WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
  const input={itemId,version:saved.capture.version,clientEventId:randomUUID(),concern:'rueckruf'};
  expect(await withSession(outsider,()=>selectIntakeConcernAction(input))).toMatchObject({code:'FORBIDDEN'});
  expect(await withSession(actor,()=>selectIntakeConcernAction({...input,concern:'zahlung'}))).toMatchObject({code:'FORBIDDEN'});
  const selected=await withSession(actor,()=>selectIntakeConcernAction(input));
  expect(selected).toMatchObject({code:'OK',capture:{concerns:['rueckruf','frist'],openConcerns:['rueckruf','frist'],usage:'offen',version:2}});
  const [row]=await sql`SELECT anliegen,anliegen_offen,einsatz,version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
  expect(row).toEqual({anliegen:['rueckruf','frist'],anliegen_offen:['rueckruf','frist'],einsatz:'offen',version:2});
  expect(await withSession(actor,()=>selectIntakeConcernAction(input))).toEqual(selected);
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND art='anliegen'`).toHaveLength(1);
  expect(await withSession(actor,()=>getIntakeCaptureAction(itemId))).toEqual(selected);
 });
 it('eingang.einsatz_erledigen / N07 server contract: atomic Info, idempotent retries and reopening with Mails and a reason',async()=>{
  const actor=await createFixture('meister',['eingang']),mails=await createFixture('meister',['mails']),ids=[randomUUID(),randomUUID()].sort();
  const {saveIntakeNoteAction,finishIntakeUseAction,reopenIntakeAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
  for(const itemId of ids)expect(await withSession(actor,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'SYNTHETISCH bitte zurückrufen',concerns:['rueckruf']}))).toMatchObject({code:'OK'});
  const input={items:ids.map(itemId=>({itemId,version:1})),kind:'info',note:'SYNTHETISCH bewusst als Info',clientEventId:randomUUID()};
  expect(await withSession(actor,()=>finishIntakeUseAction({...input,items:[input.items[0],{...input.items[1],version:2}]}))).toMatchObject({code:'CONFLICT'});
  expect(await sql`SELECT einsatz,version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=ANY(${ids}::uuid[]) ORDER BY id`).toEqual([{einsatz:'offen',version:1},{einsatz:'offen',version:1}]);
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND befehl_id=${input.clientEventId}::uuid`).toHaveLength(0);
  const done=await withSession(actor,()=>finishIntakeUseAction(input));expect(done).toMatchObject({code:'OK',captures:[{usage:'info',openConcerns:[]},{usage:'info',openConcerns:[]}]});
  expect(await withSession(actor,()=>finishIntakeUseAction(input))).toEqual(done);
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND befehl_id=${input.clientEventId}::uuid`).toHaveLength(2);
  const reopening={itemId:ids[0],version:2,reason:'SYNTHETISCH neuer Rückruf',clientEventId:randomUUID()};
  expect(await withSession(mails,()=>reopenIntakeAction({...reopening,reason:''}))).toMatchObject({code:'VALIDATION_ERROR'});
  expect(await withSession(actor,()=>reopenIntakeAction(reopening))).toMatchObject({code:'FORBIDDEN'});
  const reopened=await withSession(mails,()=>reopenIntakeAction(reopening));expect(reopened).toMatchObject({code:'OK',capture:{usage:'offen',openConcerns:['rueckruf'],assignment:'offen',version:3}});
  expect(await withSession(mails,()=>reopenIntakeAction(reopening))).toEqual(reopened);
  expect(await sql`SELECT nachher->>'grund' AS grund FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${ids[0]}::uuid AND art='wieder_geoeffnet'`).toEqual([{grund:reopening.reason}]);
  expect(await withSession(actor,()=>getIntakeCaptureAction(ids[0]))).toEqual(reopened);
 });
 it('RG11: a recognized invoice cannot disappear through Info before the invoice workflow handles it',async()=>{
  const actor=await createFixture('meister',['eingang']),itemId=randomUUID();
  const {saveIntakeNoteAction,finishIntakeUseAction}=await import('@/app/actions/eingang.actions');
  expect(await withSession(actor,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'SYNTHETISCH bitte zurückrufen',concerns:['rueckruf']}))).toMatchObject({code:'OK'});
  await sql`UPDATE public.intake_item SET anliegen=ARRAY['rechnung'],anliegen_offen=ARRAY['rechnung'] WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
  expect(await withSession(actor,()=>finishIntakeUseAction({items:[{itemId,version:1}],kind:'info',note:null,clientEventId:randomUUID()}))).toMatchObject({code:'INVOICE_REVIEW_REQUIRED',itemId});
  expect(await sql`SELECT anliegen_offen,einsatz,version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`).toEqual([{anliegen_offen:['rechnung'],einsatz:'offen',version:1}]);
 });
});

describe('AP-EIN 3.4: assignment and source customer against the real replay DB',()=>{
 it('M02/M03/M10: confirms the actual proposal, propagates only compatible group members and rereads the same rows/events',async()=>{
  const actor=await goodsActorFixture(['eingang','kunden','geld','mails']),denied=await createFixture('meister',['eingang']),ids=[randomUUID(),randomUUID(),randomUUID()],group='synthetic-'+randomUUID()+'@fixture.invalid';
  const {saveIntakeNoteAction,assignIntakeCustomerAction,getIntakeAssignmentAction}=await import('@/app/actions/eingang.actions');
  for(const id of ids){expect(await withSession(actor,()=>saveIntakeNoteAction({itemId:id,textstand:randomUUID(),text:'SYNTHETISCH bitte zurückrufen'}))).toMatchObject({code:'OK'});await sql`UPDATE public.intake_item SET kanal='mail',richtung='rein',gruppe_adresse=${group},absender_adresse=${group},text='SYNTHETISCH VERTRAULICHER MAILINHALT',betreff='SYNTHETISCH Mail' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${id}::uuid`;}
  for(const[id,index]of ids.map((id,index)=>[id,index] as const))await sql`INSERT INTO public.intake_suggestion(tenant_id,item_id,feld,wert,sicherheit,regel,grund,status) VALUES(${KREILE_TENANT_SLUG},${id}::uuid,'kunde',${sql.json(index===2?randomUUID():actor.customerId)},'vorschlag','R6','SYNTHETISCH Firmenadresse','offen')`;
  const input={itemId:ids[0],version:1,customerId:actor.customerId,mode:'confirm',clientEventId:randomUUID()};
  expect(await withSession(denied,()=>assignIntakeCustomerAction(input))).toMatchObject({code:'FORBIDDEN'});
  const saved=await withSession(actor,()=>assignIntakeCustomerAction(input));expect(saved).toMatchObject({code:'OK',customer:{id:actor.customerId},additional:1,version:2,replayed:false});
  expect(await sql`SELECT id::text,kunde_id,zuordnung,version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=ANY(${ids}::uuid[]) ORDER BY id`).toEqual(expect.arrayContaining([{id:ids[0],kunde_id:actor.customerId,zuordnung:'bestaetigt',version:2},{id:ids[1],kunde_id:actor.customerId,zuordnung:'hand',version:2},{id:ids[2],kunde_id:null,zuordnung:'offen',version:1}]));
  expect(await sql`SELECT art FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND befehl_id=${input.clientEventId}::uuid`).toEqual([{art:'zugeordnet'},{art:'zugeordnet'}]);
  expect(await withSession(actor,()=>assignIntakeCustomerAction(input))).toEqual({...saved,replayed:true});
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND befehl_id=${input.clientEventId}::uuid`).toHaveLength(2);
  expect(await withSession(actor,()=>getIntakeAssignmentAction({itemId:ids[0],mode:'normal'}))).toMatchObject({code:'OK',view:{customer:{id:actor.customerId},assignment:'bestaetigt',version:2}});
  const workshop=await createFixture('werkstatt',['eingang','kunden','auftraege']),restricted=await withSession(workshop,()=>getIntakeAssignmentAction({itemId:ids[0],mode:'normal'}));expect(restricted).toMatchObject({code:'OK',view:{restricted:true,text:null,subject:null,files:[]}});expect(JSON.stringify(restricted)).not.toContain('VERTRAULICHER MAILINHALT');
 });
 it('M05/M12: a reason closes only the intake use, preserves the original, writes once and remains readable in Erledigt',async()=>withLocalReplayStorage(async()=>{
  const actor=await goodsActorFixture(['eingang','kunden','geld','mails']),file=await originalFixture(actor),{setIntakeNoBusinessAction,getIntakeMessagesAction}=await import('@/app/actions/eingang.actions');
  await sql`UPDATE public.intake_item SET kunde_id=${actor.customerId},zuordnung='automatisch',anliegen=ARRAY['lesen'],anliegen_offen=ARRAY['lesen'] WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${file.itemId}::uuid`;
  const before=await sql`SELECT row_to_json(file)::jsonb AS file FROM public.intake_file file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${file.itemId}::uuid`;
  const [initial]=await sql`SELECT version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${file.itemId}::uuid`;
  const input={itemId:file.itemId,version:initial.version,reason:'privat',clientEventId:randomUUID()};
  expect(await withSession(actor,()=>setIntakeNoBusinessAction(input))).toEqual({code:'OK'});expect(await withSession(actor,()=>setIntakeNoBusinessAction(input))).toEqual({code:'OK'});
  expect(await sql`SELECT kunde_id,vorgang_id,zuordnung,einsatz,anliegen_offen,einsatz_aktion,einsatz_vermerk,version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${file.itemId}::uuid`).toEqual([{kunde_id:null,vorgang_id:null,zuordnung:'hand',einsatz:'erledigt',anliegen_offen:[],einsatz_aktion:'kein_gv',einsatz_vermerk:'privat',version:initial.version+1}]);
  expect(await sql`SELECT row_to_json(file)::jsonb AS file FROM public.intake_file file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${file.itemId}::uuid`).toEqual(before);
  expect(await sql`SELECT art,nachher->'intent'->>'reason' AS reason FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${file.itemId}::uuid AND befehl_id=${input.clientEventId}::uuid`).toEqual([{art:'einsatz',reason:'privat'}]);
  const read=await withSession(actor,()=>getIntakeMessagesAction('erledigt'));if(read.code!=='OK')throw Error(JSON.stringify(read));expect(read.messages.find(row=>row.id===file.itemId)).toMatchObject({usage:'erledigt',assignment:'hand',fileIds:[file.fileId]});
 }));
 it('Neukunde aus Absender: one existing customer writer plus the same assignment in one transaction, rollback on conflict and idempotent reread',async()=>{
  const actor=await createFixture('meister',['eingang','kunden','geld']),itemId=randomUUID(),{saveIntakeNoteAction,createCustomerForIntakeAction,getIntakeAssignmentAction}=await import('@/app/actions/eingang.actions');
  expect(await withSession(actor,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'SYNTHETISCH Kunde aus Absender'}))).toMatchObject({code:'OK'});
  const input={itemId,version:1,customer:{clientEventId:randomUUID(),customerType:'business',companyName:'SYNTHETISCH Absender '+randomUUID().slice(0,8),salutation:'ohne',firstName:'Ada',lastName:'Testperson',email:randomUUID()+'@fixture.invalid',phone:'+49 711 5550190',street:'Kundenweg',houseNumber:'18',zipCode:'70176',city:'Stuttgart',country:'DE',paymentPreference:'vorkasse',vatId:null,notes:null}};
  const [before]=await sql`SELECT count(*)::int AS count FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG}`;
  expect(await withSession(actor,()=>createCustomerForIntakeAction({...input,version:2}))).toMatchObject({code:'CONFLICT'});
  expect(await sql`SELECT count(*)::int AS count FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual([before]);
  const saved=await withSession(actor,()=>createCustomerForIntakeAction(input));if(saved.code!=='OK')throw Error('SOURCE_CUSTOMER:'+saved.code+':'+saved.message);
  expect(await sql`SELECT kunde_id,zuordnung,version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`).toEqual([{kunde_id:saved.customer.id,zuordnung:'hand',version:2}]);
  expect(await sql`SELECT name FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.customer.id}`).toEqual([{name:input.customer.companyName}]);
  expect(await withSession(actor,()=>createCustomerForIntakeAction(input))).toEqual({...saved,replayed:true});
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND befehl_id=${input.customer.clientEventId}::uuid AND art='zugeordnet'`).toHaveLength(1);
  expect(await withSession(actor,()=>getIntakeAssignmentAction({itemId,mode:'normal'}))).toMatchObject({code:'OK',view:{customer:{id:saved.customer.id,name:input.customer.companyName},assignment:'hand',version:2}});
 });
});

describe("AP-ABS agreement actions: real Action, database event and reread", () => {
  it("ABS-02, ABS-06 and ABS-18: saves, replays and revokes one typed agreement only with Geld", async () => {
    // The fixture creates its own customer through the canonical customer action;
    // that action is intentionally granted by Eingang, while the agreement itself
    // remains guarded by Geld below.
    const moneyActor = await createFixture("meister", ["kunden", "geld", "eingang"]);
    const noMoneyActor = await createFixture("meister", ["kunden"]);
    const { createCustomerAction, saveCustomerAgreementAction, revokeCustomerAgreementAction } = await import("@/app/actions/customers.actions");
    const customer = await withSession(moneyActor, () => createCustomerAction({
      clientEventId: randomUUID(),
      customerType: "business",
      companyName: `SYNTHETISCH Absprache ${randomUUID().slice(0, 8)}`,
      salutation: "ohne",
      firstName: "Ada",
      lastName: "Absprache",
      phone: "+49 711 5550190",
      email: `agreement-${randomUUID()}@fixture.invalid`,
      street: "Kundenweg",
      houseNumber: "20",
      zipCode: "70176",
      city: "Stuttgart",
      country: "DE",
      paymentPreference: "bar",
    }));
    if (customer.code !== "OK") throw new Error(`ABS_CUSTOMER_CREATE_FAILED:${customer.code}:${customer.message}`);

    const saveInput = {
      clientKey: randomUUID(),
      customerId: customer.receipt.customerId,
      orderId: null,
      type: "ausgabe_ohne_zahlung" as const,
      targetDays: null,
      validUntil: null,
      reason: "Synthetischer Prüfgrund für Rechnung folgt",
      version: null,
    };
    const beforeDenied = await sql`SELECT count(*)::integer AS count FROM public.customer_agreements WHERE tenant_id=${KREILE_TENANT_SLUG}`;
    expect(await withSession(noMoneyActor, () => saveCustomerAgreementAction({ ...saveInput, clientKey: randomUUID() }))).toMatchObject({ code: "FORBIDDEN" });
    expect(await sql`SELECT count(*)::integer AS count FROM public.customer_agreements WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(beforeDenied);

    const saved = await withSession(moneyActor, () => saveCustomerAgreementAction(saveInput));
    if (saved.code !== "OK") throw new Error(`ABS_SAVE_FAILED:${saved.code}:${saved.message}`);
    expect(saved).toMatchObject({
      code: "OK",
      replayed: false,
      agreement: {
        customerId: customer.receipt.customerId,
        orderId: null,
        type: "ausgabe_ohne_zahlung",
        targetDays: null,
        reason: saveInput.reason,
        version: 1,
        revokedAt: null,
      },
    });
    expect(await sql`
      SELECT agreement.customer_id, agreement.typ, agreement.geld, agreement.grund,
        agreement.version, event.event_type, event.user_id::text AS actor_id,
        event.payload->>'agreementId' AS event_agreement_id
      FROM public.customer_agreements agreement
      JOIN public.events event ON event.tenant_id=agreement.tenant_id
        AND event.client_event_id=${saveInput.clientKey}::uuid
      WHERE agreement.tenant_id=${KREILE_TENANT_SLUG} AND agreement.id=${saved.agreement.id}::uuid
    `).toEqual([{
      customer_id: customer.receipt.customerId,
      typ: "ausgabe_ohne_zahlung",
      geld: true,
      grund: saveInput.reason,
      version: 1,
      event_type: "CUSTOMER_AGREEMENT_SAVED_V1",
      actor_id: moneyActor.actorId,
      event_agreement_id: saved.agreement.id,
    }]);
    expect(await withSession(moneyActor, () => saveCustomerAgreementAction(saveInput))).toMatchObject({
      code: "OK",
      replayed: true,
      agreement: { id: saved.agreement.id, version: 1 },
    });

    const revokeInput = {
      clientKey: randomUUID(),
      agreementId: saved.agreement.id,
      reason: "Synthetischer Widerruf nach Prüfung",
      version: saved.agreement.version,
    };
    const revoked = await withSession(moneyActor, () => revokeCustomerAgreementAction(revokeInput));
    if (revoked.code !== "OK") throw new Error(`ABS_REVOKE_FAILED:${revoked.code}:${revoked.message}`);
    expect(revoked).toMatchObject({
      code: "OK",
      replayed: false,
      agreement: {
        id: saved.agreement.id,
        version: 2,
        revokeReason: revokeInput.reason,
        revokedBy: moneyActor.actorId,
        revokedAt: expect.any(String),
      },
    });
    expect(await sql`
      SELECT agreement.widerrufen_am IS NOT NULL AS revoked, agreement.widerrufen_von::text AS revoked_by,
        agreement.widerruf_grund, agreement.version, event.event_type, event.payload->>'agreementId' AS event_agreement_id
      FROM public.customer_agreements agreement
      JOIN public.events event ON event.tenant_id=agreement.tenant_id
        AND event.client_event_id=${revokeInput.clientKey}::uuid
      WHERE agreement.tenant_id=${KREILE_TENANT_SLUG} AND agreement.id=${saved.agreement.id}::uuid
    `).toEqual([{
      revoked: true,
      revoked_by: moneyActor.actorId,
      widerruf_grund: revokeInput.reason,
      version: 2,
      event_type: "CUSTOMER_AGREEMENT_REVOKED_V1",
      event_agreement_id: saved.agreement.id,
    }]);
    expect(await withSession(moneyActor, () => revokeCustomerAgreementAction(revokeInput))).toMatchObject({
      code: "OK",
      replayed: true,
      agreement: { id: saved.agreement.id, version: 2, revokeReason: revokeInput.reason },
    });
  });
});


describe('AP-KREISLAUF AF-1',()=>{
 it('retains each pending business concern and rolls back an entire mixed batch through the real actions',async()=>{
  const actor=await createFixture('meister',['eingang','mails','geld','auftraege','kunden']);
  const {saveIntakeNoteAction,selectIntakeConcernAction,finishIntakeUseAction,setIntakeNoBusinessAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
  for(const concern of ['kv_annahme','kv_ablehnung','preis_einwand','reklamation','termin']){
   const ids=[randomUUID(),randomUUID()].sort(),key=randomUUID();
   for(const itemId of ids)expect(await withSession(actor,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'SYNTHETISCH AF1 bitte zurückrufen',concerns:['rueckruf']}))).toMatchObject({code:'OK'});
   expect(await withSession(actor,()=>selectIntakeConcernAction({itemId:ids[1],version:1,clientEventId:randomUUID(),concern}))).toMatchObject({code:'OK'});
   for(const kind of ['info','erledigt'] as const){const result=await withSession(actor,()=>finishIntakeUseAction({items:ids.map((itemId,index)=>({itemId,version:index===0?1:2})),kind,note:null,clientEventId:key}));expect(result).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('Eingang bleibt offen')});}
   expect(await sql`SELECT version,einsatz FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=ANY(${ids}::uuid[]) ORDER BY id`).toEqual([{version:1,einsatz:'offen'},{version:2,einsatz:'offen'}]);
   expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND befehl_id=${key}::uuid`).toHaveLength(0);
   expect(await withSession(actor,()=>setIntakeNoBusinessAction({itemId:ids[1],version:2,reason:'info',clientEventId:randomUUID()}))).toMatchObject({code:'VALIDATION_ERROR'});
   expect(await withSession(actor,()=>getIntakeCaptureAction(ids[1]))).toMatchObject({code:'OK',capture:{version:2,usage:'offen',openConcerns:[concern,'rueckruf']}});
  }
 });
});


describe('S05 existing intake task calendar source',()=>{
 it('keeps an open real task after its source concern is closed, rereads a changed date and removes only completed work',async()=>{
  const actor=await goodsActorFixture(['auftraege','kunden','geld','eingang','mails']);
  const {saveIntakeNoteAction,saveIntakeTaskAction,getIntakeTaskAction,completeIntakeTaskAction}=await import('@/app/actions/eingang.actions');
  const {readTodayCalendar}=await import('@/lib/server/todayDashboardPolicy');
  const calendar=readTodayCalendar();
  const itemId=randomUUID();
  const captured=await withSession(actor,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'SYNTHETISCH bitte zur\u00fcckrufen',context:{customerId:actor.customerId},concerns:['rueckruf']}));
  if(captured.code!=='OK')throw Error('TEST_S05_TASK_CAPTURE:'+JSON.stringify(captured));
  const input:TaskSaveInput={clientKey:randomUUID(),version:0,kind:'rueckruf',title:'TEST S05 callback',dueDate:calendar.today,time:null,forLogin:actor.actorId,forArea:null,reference:{type:'eingang',id:itemId},note:null,itemId,itemVersion:captured.capture.version};
  const saved=await withSession(actor,()=>saveIntakeTaskAction(input));
  if(saved.code!=='OK')throw Error('TEST_S05_TASK_SAVE:'+saved.code);
  expect(await sql`SELECT einsatz,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`).toEqual([{einsatz:'erledigt',anliegen_offen:[]}]);
  const reader=()=>withSession(actor,()=>getIntakeTaskAction({calendar:true}));
  const first=await reader();if(!('rows'in first))throw Error('TEST_S05_TASK_READ:'+first.code);
  expect(first.rows.find(row=>row.id===saved.task.id)).toEqual({id:saved.task.id,version:1,itemId,dueDate:calendar.today,canComplete:true,canOpenReference:true});
  expect(await reader()).toEqual(first);
  const changedInput={...input,taskId:saved.task.id,version:1,itemVersion:undefined,dueDate:calendar.throughDate};
  const changed=await withSession(actor,()=>saveIntakeTaskAction(changedInput));if(changed.code!=='OK')throw Error('TEST_S05_TASK_CHANGE:'+changed.code);
  const {readTodayDashboard}=await import('@/lib/server/todayDashboard');
  const {getComplaints}=await import('@/app/actions/complaints.actions');
  const {getQuoteFollowupsForTodayAction}=await import('@/app/actions/quotes.actions');
  const day=()=>withSession(actor,async()=>{const {resolveAuthorization}=await import('@/lib/server/authorization');const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_S05_TASK_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
  expect((await day()).taskSchedule?.rows.find(row=>row.id===saved.task.id)).toMatchObject({id:saved.task.id,version:changed.task.version,dueDate:calendar.throughDate});
  const noMails=await createFixture('meister',['eingang']);
  expect(await withSession(noMails,()=>getIntakeTaskAction({calendar:true}))).toMatchObject({code:'FORBIDDEN'});
  const completeInput={taskId:saved.task.id,version:changed.task.version,note:'TEST S05 callback complete'};
  const completed=await withSession(actor,()=>completeIntakeTaskAction(completeInput));expect(completed.code).toBe('OK');
  expect(await withSession(actor,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(completeInput))))).toMatchObject({code:'OK',replayed:true});
  const final=await reader();if(!('rows'in final))throw Error('TEST_S05_TASK_FINAL:'+final.code);
  expect(final.rows.some(row=>row.id===saved.task.id)).toBe(false);
  expect((await day()).taskSchedule?.rows.some(row=>row.id===saved.task.id)).toBe(false);
 });
});
