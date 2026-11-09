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

const belegTenant=vi.hoisted(()=>`test-r2-${crypto.randomUUID()}`);
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


it('R2 existing settings Action writes explicit policy once, logs actor, rereads it and preserves it on legacy shipping edits',async()=>{
 const fixture=await createFixture(['einstellungen','auftraege']);await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,versand_dienst) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST R2 Firma','TEST DPD')`;
 const {readShippingSettingsAction,saveShippingSettingsAction}=await import('@/app/actions/settings.actions');const initial=await withSession(fixture,()=>readShippingSettingsAction());expect(initial).toMatchObject({code:'OK',settings:{dispatchPolicy:null}});if(initial.code!=='OK')throw Error(initial.message);
 const policy={reminderDays:7,secondReminderDays:7,callAfterDays:3,storageAfterDays:14,blockAfterDueDays:10,unconfirmedDeliveryDays:5,holdMinutes:30,pickupWindows:[{day:1,start:'08:00',end:'16:00'}],holidays:['2026-12-25'],carrierCutoffs:[{service:'TEST DPD',day:1,time:'16:00'}],fallbackService:'TEST fallback'};
 const input={service:initial.settings.service,numberPattern:initial.settings.numberPattern,numberHint:initial.settings.numberHint,trackingUrl:initial.settings.trackingUrl,expectedUpdatedAt:initial.settings.updatedAt,dispatchPolicy:policy};
 const saved=await withSession(fixture,()=>saveShippingSettingsAction(input));expect(saved).toMatchObject({code:'OK',replayed:false,settings:{dispatchPolicy:policy}});
 expect(await sql`SELECT ausgang_regeln FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual([{ausgang_regeln:policy}]);expect(await sql`SELECT payload->>'actorId' AS actor FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='shipping_settings_updated'`).toEqual([{actor:fixture.actorId}]);
 const roundtrip=await withSession(fixture,()=>readShippingSettingsAction());expect(roundtrip).toMatchObject({code:'OK',settings:{dispatchPolicy:policy}});if(roundtrip.code!=='OK')throw Error(roundtrip.message);expect(await withSession(fixture,()=>saveShippingSettingsAction({...input,dispatchPolicy:roundtrip.settings.dispatchPolicy}))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(fixture,()=>saveShippingSettingsAction({...input,dispatchPolicy:{...policy,holdMinutes:50}}))).toMatchObject({code:'CONFLICT'});expect(await withSession(fixture,()=>saveShippingSettingsAction({...input,dispatchPolicy:{...policy,pickupWindows:[{day:1,start:'16:00',end:'08:00'}]}}))).toMatchObject({code:'VALIDATION_ERROR'});
 const denied=await createFixture(['auftraege']);expect(await withSession(denied,()=>saveShippingSettingsAction(input))).toMatchObject({code:'FORBIDDEN'});
 const current=await withSession(fixture,()=>readShippingSettingsAction());if(current.code!=='OK')throw Error(current.message);const {dispatchPolicy:_,...legacy}=input;void _;expect(await withSession(fixture,()=>saveShippingSettingsAction({...legacy,expectedUpdatedAt:current.settings.updatedAt,numberHint:'TEST hint changed'}))).toMatchObject({code:'OK',settings:{dispatchPolicy:policy}});
});
