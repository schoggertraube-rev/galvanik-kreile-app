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
vi.mock("@/lib/server/microsoftGraph", () => ({ sendMicrosoftGraphMail: vi.fn(async () => ({ code: "OK", data: {} })) }));

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
  expect(events.map(row=>row.art)).toEqual(["angelegt","erkannt","original_gespeichert"]);
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
  const failed=await withSession(actor,()=>saveIntakeProspectAction({...input,activeDraft:{id:randomUUID(),updatedAt:new Date().toISOString()}}));
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
  const booked=await withSession(actor,()=>erfasseAuftragAusEingangAction(input),async result=>{
    expect(result).toMatchObject({code:'OK',confirmationMessage:'Auftragsbestätigung wird gesendet'});
    if(result.code!=='OK')throw Error('INLINE_BOOKING_RESPONSE_REQUIRED');
    expect(await sql`SELECT status FROM public.outbox_mails WHERE tenant_id=${KREILE_TENANT_SLUG} AND objekt=${result.orderId}`).toEqual([{status:'wartet'}]);
    expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${result.intakeItemId} AND art='gesendet'`).toHaveLength(0);
  });
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
 it("stores a phone note only for telephone intake and rereads it without duplication",async()=>{
  const actor=await createFixture();
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
   expect(await withSession(fixture,()=>saveIntakeDraftAction({id:draftId,clientEventId:randomUUID(),art:"eingang",payload:{clientKey:randomUUID(),text:"SYNTHETISCH D06"},lastField:"eingang.menge",expectedUpdatedAt:null}))).toMatchObject({code:"OK"});
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
  const input={id:randomUUID(),clientEventId:randomUUID(),art:"eingang",payload:{clientKey:randomUUID(),text:"SYNTHETISCH D05 Prüfnotiz Entwurf"},lastField:"eingang.kundensuche",expectedUpdatedAt:null};
  const saved=await withSession(owner,()=>saveIntakeDraftAction(input));
  expect(saved).toMatchObject({code:"OK",drafts:[{id:input.id,art:"eingang",payload:input.payload,zuletzt_feld:input.lastField}]});
  expect(await withSession(owner,()=>saveIntakeDraftAction(input))).toMatchObject({code:"OK",drafts:[{id:input.id}]});
  const [row]=await sql`SELECT art,payload,zuletzt_feld,to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at FROM private.intake_drafts WHERE tenant_id=${KREILE_TENANT_SLUG} AND actor_id=${owner.actorId}::uuid AND id=${input.id}::uuid`;
  expect(row).toMatchObject({art:"eingang",payload:input.payload,zuletzt_feld:input.lastField});
  expect(await withSession(other,()=>getIntakeDraftsAction())).toMatchObject({code:"OK",drafts:[]});
  expect(await withSession(owner,()=>getIntakeDraftsAction())).toMatchObject({code:"OK",drafts:[{id:input.id,payload:input.payload}]});
  const deletion={id:input.id,clientEventId:randomUUID(),expectedUpdatedAt:row.updated_at};
  expect(await withSession(owner,()=>discardIntakeDraftAction(deletion))).toMatchObject({code:"OK",drafts:[]});
  expect(await withSession(owner,()=>discardIntakeDraftAction(deletion))).toMatchObject({code:"OK",drafts:[]});
  expect(await sql`SELECT id FROM private.intake_drafts WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.id}::uuid`).toHaveLength(0);
  expect(await sql`SELECT event_type FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${owner.actorId}::uuid AND client_event_id IN (${input.clientEventId}::uuid,${deletion.clientEventId}::uuid)`).toHaveLength(2);
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
