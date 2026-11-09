// @vitest-environment node
// @vitest-environment node

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testTenant=vi.hoisted(()=> 'test-rm08-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:testTenant}));

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
    displayName: "Rolf TEST Versandverbindung",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work);
}

async function createFixture(areas:string[]=['eingang', 'auftraege', 'kunden', 'geld', 'kassieren', 'entscheiden','einstellungen']): Promise<Fixture> {
  const actorId = randomUUID();
  const customerId = randomUUID();
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES (
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`rolf-h18-workshop-${actorId}@local.invalid`},
        'Rolf TEST Versandverbindung', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
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
        ${customerId}, ${KREILE_TENANT_SLUG}, ${`H18-W-${customerId.slice(0, 8)}`}, 'TEST Reklamation Restkunde', 'TEST Reklamation Restkunde GmbH', 'business', 'Ada Werkstatt', ${`werkstatt-${customerId}@local.invalid`}, '+49 711 5550192', (SELECT street FROM private.kunde_split_street('Werkstattweg 18')), '70178', 'Stuttgart', private.kunde_land_schluessel('Deutschland'), 'rechnung', true, 14, 'manual', (SELECT first_name FROM private.kunde_split_name('Ada Werkstatt')), (SELECT last_name FROM private.kunde_split_name('Ada Werkstatt')), (SELECT salutation FROM private.kunde_split_name('Ada Werkstatt')), (SELECT house_number FROM private.kunde_split_street('Werkstattweg 18'))
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


it('RM08 existing settings Action persists nullable workday policy, its actor receipt, readback and retry without granting unrelated rights',async()=>{
 const actor=await createFixture(),denied=await createFixture(['auftraege']),login=await createFixture(['logins']);
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST RM08 Fristen')`;
 const {SALES_STAGE_FEATURES}=await import('@/modules/fundament/public');for(const feature of SALES_STAGE_FEATURES)await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES(${KREILE_TENANT_SLUG},${feature.id},${feature.defaultEnabled}) ON CONFLICT(tenant,feature_id) DO NOTHING`;
 const {readSettingsAction,saveCompanySettingsAction}=await import('@/app/actions/settings.actions');
 const initial=await withSession(actor,()=>readSettingsAction());expect(initial.code).toBe('OK');if(initial.code!=='OK')throw Error(initial.message);expect(initial.snapshot.photoPolicy).toMatchObject({reminderDays:null,callDays:null});
 const request={command:'complaint-photo-policy' as const,reminderDays:3,callDays:5,expectedUpdatedAt:initial.snapshot.photoPolicy!.updatedAt,clientEventId:randomUUID()};
 expect(await withSession(denied,()=>saveCompanySettingsAction(request))).toMatchObject({code:'FORBIDDEN'});expect(await sql`SELECT id FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='complaint_photo_policy_changed'`).toHaveLength(0);
 const saved=await withSession(actor,()=>saveCompanySettingsAction(request));expect(saved).toMatchObject({code:'OK',replayed:false,photoPolicy:{reminderDays:3,callDays:5}});
 expect(await sql`SELECT rekla_fotos_erinnerung_tage AS reminder,rekla_fotos_anruf_tage AS call FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual([{reminder:3,call:5}]);
 const view=await withSession(actor,()=>readSettingsAction());if(view.code!=='OK')throw Error(view.message);expect(view.snapshot.photoPolicy).toMatchObject({reminderDays:3,callDays:5});
 const [receipt]=await sql<{key:string;reminder:number;call:number;actor:string}[]>`SELECT payload->>'clientEventId' AS key,(payload->'after'->>'reminderDays')::int AS reminder,(payload->'after'->>'callDays')::int AS call,payload->>'actorId' AS actor FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='complaint_photo_policy_changed'`;
 expect(receipt.actor).toBe(actor.actorId);const retry={command:'complaint-photo-policy' as const,reminderDays:receipt.reminder,callDays:receipt.call,clientEventId:receipt.key,expectedUpdatedAt:view.snapshot.photoPolicy!.updatedAt};
 expect(await withSession(actor,()=>saveCompanySettingsAction(retry))).toMatchObject({code:'OK',replayed:true});expect(await sql`SELECT id FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='complaint_photo_policy_changed'`).toHaveLength(1);
 expect(await withSession(actor,()=>saveCompanySettingsAction({...retry,reminderDays:4}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(actor,()=>saveCompanySettingsAction({...request,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(actor,()=>saveCompanySettingsAction({...retry,clientEventId:randomUUID(),callDays:-1}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(login,()=>readSettingsAction())).toMatchObject({code:'OK',snapshot:{photoPolicy:null}});
 expect(await withSession(actor,()=>saveCompanySettingsAction({...retry,reminderDays:null,callDays:null,clientEventId:randomUUID()}))).toMatchObject({code:'OK',photoPolicy:{reminderDays:null,callDays:null}});
 expect(await withSession(actor,()=>readSettingsAction())).toMatchObject({code:'OK',snapshot:{photoPolicy:{reminderDays:null,callDays:null}}});expect(await withSession(actor,()=>saveCompanySettingsAction(retry))).toMatchObject({code:'CONFLICT'});expect(await sql`SELECT id FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='complaint_photo_policy_changed'`).toHaveLength(2);
});
