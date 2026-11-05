import { expect, type Locator, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import postgres from "postgres";
import { createPinLoginHandle } from "../../src/lib/server/pinLoginHandle";
import { berlinCalendarDay, isWorkingDay, plusWorkingDays, previousWorkingDay } from "../../src/lib/domain/workingDays";
import { generatedFlowRuntime } from "./_model";
import { localReplayStorageEnvironment } from "../../src/test/localReplayStorage";

export type FlowExpectation = {
  id?: string;
  nr?: number;
  erwartung?: string;
  wert?: unknown;
  text?: string;
  oben?: string;
  dialoge?: number;
  toast?: string;
  druck?: number;
  option?: string;
};

export type FlowStep = FlowExpectation & {
  id?: string;
  nr?: number;
  aktion?: string;
  wert?: unknown;
  arg?: unknown;
  anzeige?: FlowExpectation[];
  db?: FlowDbExpectation[];
};

export type FlowDbExpectation = {
  tabelle: string;
  neu?: number;
  wo?: Record<string, unknown>;
  werte?: Record<string, unknown>;
};

export type FlowCase = {
  id: string;
  titel: string;
  paket: string | null;
  gegeben: {
    login: keyof typeof generatedFlowRuntime.logins;
    datenlagen: string[];
    aufruf: { seite: string; arg?: unknown; weg?: FlowStep[] | "oeffne" };
    geraet: string;
  };
  wenn?: FlowStep[];
  dann?: { anzeige?: FlowExpectation[]; db?: FlowDbExpectation[] };
};

type FlowRunState = {
  before: Map<string, number>;
  beforeIds: Map<string, Set<string>>;
  rows: Map<string, Record<string, unknown>>;
  createdRows: Map<string, Record<string, unknown>[]>;
  restoreOnlineAfterWrite: boolean;
  interruptionObserved?: Promise<boolean>;
  loginId: string;
};

const TENANT = "galvanik-kreile";
const VALUE_IS_SET = "__FLOW_VALUE_IS_SET__";
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("FLOW_HARNESS_DATABASE_URL_REQUIRED");
if (!/^postgresql?:\/\/postgres:postgres@127\.0\.0\.1:54322\/postgres$/.test(databaseUrl)) {
  throw new Error("FLOW_HARNESS_LOCAL_REPLAY_DATABASE_REQUIRED");
}
const pendingAreas = new Set<string>();
let fixtureLoginId: string = generatedFlowRuntime.logins.login_meister.id;
const sql = postgres(databaseUrl, { max: 1, prepare: false, onnotice: (notice) => {
  if (notice.message.startsWith("truncate cascades")) return;
  if (notice.message.startsWith("FLOW_SEED_AREA_PENDING:")) {
    if (pendingAreas.has(notice.message)) return;
    pendingAreas.add(notice.message);
  }
  console.info("FLOW_REPLAY_NOTICE", notice.message);
} });

export async function prepareGeneratedSeed(flowCase: FlowCase) {
  fixtureLoginId = generatedFlowRuntime.logins[flowCase.gegeben.login].id;
  canonicalOrderIds.clear();
  canonicalOrderSource = null;
  const copySource = typeof flowCase.gegeben.aufruf.arg === "string"
    ? /^\{([a-z_0-9]+)\}#kopie$/.exec(flowCase.gegeben.aufruf.arg)?.[1] : undefined;
  if (copySource === "auftrag_quelle") {
    const fixture = generatedFixtures[copySource];
    if (!fixture || fixture.tabelle !== "orders") throw Error("FLOW_COPY_SOURCE_FIXTURE_INVALID");
    canonicalOrderSource = { name: copySource, fixture };
  }
  await resetGeneratedDomain();
  const seed = readFileSync(path.resolve(process.cwd(), "e2e/generated/_seed.sql"), "utf8");
  await sql.unsafe(seed);
  const names = selectedFixtureNames(flowCase.gegeben.datenlagen);
  const seeds = generatedFlowRuntime.fixtureSql as unknown as Record<string, string>;
  for (const name of names) {
    if (name === canonicalOrderSource?.name) continue;
    if (seeds[name]) await sql.unsafe(seeds[name]);
    else await seedSupplementalFixtures([generatedFixtures[name]!]);
  }
}

type GeneratedFixture = {
  id: string;
  tabelle: string;
  order_number?: string;
  nummer?: string;
  [key: string]: unknown;
};
const canonicalOrderIds = new Map<string, { id: string; order_number: string }>();
let canonicalOrderSource: { name: string; fixture: GeneratedFixture } | null = null;

const generatedFixtures = generatedFlowRuntime.datenlagen as unknown as Record<string, GeneratedFixture>;
const columnCache = new Map<string, Map<string, { column_name: string; data_type: string; udt_name: string }>>();
let baselineSettings: Record<string, unknown>[] | null = null;

function selectedFixtureNames(requested: string[]) {
  const selected: string[] = [];
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (name: string) => {
    if (done.has(name)) return;
    if (visiting.has(name)) throw new Error(`FLOW_FIXTURE_CYCLE:${name}`);
    const fixture = generatedFixtures[name];
    if (!fixture) throw new Error(`FLOW_FIXTURE_UNKNOWN:${name}`);
    visiting.add(name);
    for (const match of JSON.stringify(fixture).matchAll(/\{([a-z_0-9]+)(?:\.[a-z_]+)?\}/g)) {
      if (generatedFixtures[match[1]!]) visit(match[1]!);
    }
    visiting.delete(name);
    done.add(name);
    selected.push(name);
  };
  requested.forEach(visit);
  return selected;
}

async function resetGeneratedDomain() {
  if (baselineSettings === null) {
    // The model assumes configured company settings. Use database delivery defaults
    // for the isolated Replay baseline; never synthesize settings in product code.
    const current=await sql`SELECT id FROM public.company_settings WHERE tenant_id=${TENANT}`;
    if(current.length===0)await upsertFixture("company_settings",{id:"default",tenant_id:TENANT,company_name:"SYNTHETISCH Replay-Betrieb"});
    if(current.length>1)throw Error("FLOW_REPLAY_BASE_SETTINGS_AMBIGUOUS");
    const rows = await sql<{ row: Record<string, unknown> }[]>`SELECT to_jsonb(settings) AS row FROM public.company_settings settings WHERE tenant_id = ${TENANT}`;
    baselineSettings = rows.map((row) => row.row);
  }
  const names = [...new Set([...Object.values(databaseMapping).map((entry) => `${entry.schema ?? "public"}.${entry.table}`), "public.events"])];
  const present = await sql<{ schema: string; name: string }[]>`SELECT schemaname AS schema, tablename AS name FROM pg_tables WHERE schemaname || '.' || tablename = ANY(${names}::text[]) ORDER BY schemaname, tablename`;
  if (present.some((row) => !/^[a-z_]+$/.test(row.name) || !["public", "private"].includes(row.schema))) throw new Error("FLOW_REPLAY_TABLE_NAME_INVALID");
  const targets = present.map((row) => `"${row.schema}"."${row.name}"`).join(", ");
  const protectedRows = await sql<{ relname: string }[]>`WITH RECURSIVE affected(oid) AS (
    SELECT relation.oid FROM pg_class relation JOIN pg_namespace schema ON schema.oid = relation.relnamespace
    WHERE schema.nspname || '.' || relation.relname = ANY(${names}::text[])
    UNION SELECT constraint_row.conrelid FROM pg_constraint constraint_row JOIN affected ON affected.oid = constraint_row.confrelid WHERE constraint_row.contype = 'f'
  ) SELECT relation.relname FROM affected JOIN pg_class relation ON relation.oid = affected.oid
    WHERE relation.relname IN ('app_users', 'app_user_rights')`;
  if (protectedRows.length) throw new Error("FLOW_REPLAY_CLEANUP_SCOPE_INVALID");
  // Fixture cleanup only, on the guarded local replay connection. Append-only
  // tables may be reset here; real app connections retain every trigger.
  await sql.begin(async (cleanup) => {
    await cleanup.unsafe("SET LOCAL session_replication_role = replica");
    await cleanup.unsafe(`TRUNCATE TABLE ${targets} CASCADE`);
  });
  await sql`DELETE FROM public.company_settings WHERE tenant_id = ${TENANT}`;
  for (const row of baselineSettings) await upsertFixture("company_settings", row);
}

async function tableColumns(table: string) {
  const cached = columnCache.get(table);
  if (cached) return cached;
  const rows = await sql<{ column_name: string; data_type: string; udt_name: string }[]>`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = ${fixtureStorageSchema(table)} AND table_name = ${table}
  `;
  const columns = new Map(rows.map((row) => [row.column_name, row]));
  columnCache.set(table, columns);
  return columns;
}

function parameterCast(index: number, column: { data_type: string; udt_name: string }) {
  if (column.data_type === "json" || column.data_type === "jsonb") return `$${index}::${column.data_type}`;
  if (column.data_type === "ARRAY") return `$${index}::${column.udt_name.replace(/^_/, "")}[]`;
  if (column.data_type === "uuid") return `$${index}::uuid`;
  if (column.data_type === "date") return `$${index}::date`;
  if (column.data_type.startsWith("timestamp")) return `$${index}::timestamptz`;
  return `$${index}`;
}

async function upsertFixture(table: string, values: Record<string, unknown>) {
  const columns = await tableColumns(table);
  if (columns.size === 0) throw new Error(`FLOW_MODEL_TABLE_NOT_BUILT:${table}`);
  const entries = Object.entries(values).filter(([name, value]) => columns.has(name) && value !== undefined);
  if (!entries.some(([name]) => name === "id")) throw new Error(`FLOW_SEED_ID_REQUIRED:${table}`);
  const params = entries.map(([name, value]) => {
    const column = columns.get(name)!;
    return column.data_type === "json" || column.data_type === "jsonb" ? sql.json(value as postgres.JSONValue) : value;
  });
  const names = entries.map(([name]) => `"${name}"`);
  const placeholders = entries.map(([name], index) => parameterCast(index + 1, columns.get(name)!));
  const updates = entries.filter(([name]) => name !== "id").map(([name]) => `"${name}" = EXCLUDED."${name}"`);
  await sql.unsafe(
    `INSERT INTO ${qualifiedStorageTable(table)} (${names.join(", ")}) VALUES (${placeholders.join(", ")}) ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}`,
    params as never[],
  );
}

function resolvedFixture(fixture: GeneratedFixture) {
  const loginId = fixtureLoginId;
  return resolveValue({ ...fixture, ...canonicalOrderIds.get(fixture.id) }, {
    before: new Map(), beforeIds: new Map(), rows: new Map(), createdRows: new Map(), restoreOnlineAfterWrite: false, loginId,
  }) as GeneratedFixture;
}

function unitLabel(value: unknown) {
  return value === "stueck" ? "Stück" : value === "dm2" ? "dm²" : value;
}

async function seedOrderFixture(fixture: GeneratedFixture, orderIndex: number) {
  const value = resolvedFixture(fixture);
  const positions = Array.isArray(value.positionen) ? value.positionen as Array<Record<string, unknown>> : [];
  const customerId = String(value.kunde ?? "");
  // The model's in-progress fixture uses the existing physical workshop station.
  const station = value.station === "in_arbeit" ? "galvanik" : String(value.station ?? "angenommen");
  await upsertFixture("orders", {
    id: value.id,
    tenant_id: TENANT,
    order_number: value.order_number,
    customer_id: customerId,
    title: positions[0]?.bezeichnung ?? value.order_number,
    task: positions.map((position) => position.bezeichnung).filter(Boolean).join(", "),
    station,
    current_station: station,
    current_station_id: station,
    status: station === "abgeschlossen" ? "completed" : "in_progress",
    parts: positions,
    intake_date: value.angenommen_am ?? new Date().toISOString(),
    due_date: value.liefertermin,
    promised_due_date: value.liefertermin,
    payment_mode: value.zahlungsmodus === "bar" ? "abholung" : value.zahlungsmodus,
    handover_mode: value.uebergabe === "abholung" ? "pickup" : value.uebergabe === "versand" ? "shipping" : value.uebergabe,
    intake_term_status: value.terminstatus,
    intake_source: value.eingangsart,
    source: "FLOW_SPEC",
    source_ref: value.id,
    ware: value.ware,
    angenommen_am: value.angenommen_am,
  });
  for (let positionIndex = 0; positionIndex < positions.length; positionIndex += 1) {
    const position = positions[positionIndex]!;
    const suffix = String(700000 + orderIndex * 100 + positionIndex).padStart(12, "0");
    await upsertFixture("items", {
      id: `30000000-0000-4000-8000-${suffix}`,
      tenant_id: TENANT,
      order_id: value.id,
      customer_id: customerId,
      name: position.bezeichnung,
      quantity: position.menge ?? 1,
      current_station_id: station,
      material: position.material,
      surface_requested: position.oberflaeche,
      execution_requested: position.ausfuehrung ?? "offen",
      unit: unitLabel(position.einheit),
      preis_netto: position.einzelpreis,
    });
  }
}

const syntheticJpeg=Buffer.from("/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=","base64");

/** Technical materialization of the model's given originals, in real loopback Storage. */
async function seedOriginalFixture(file:Record<string,unknown>,sequence:number){
  const name=String(file.dateiname??"");
  const content=/\.jpe?g$/iu.test(name)?{mime:"image/jpeg",bytes:syntheticJpeg}
    :/\.eml$/iu.test(name)?{mime:"message/rfc822",bytes:Buffer.from("From: synthetic@fixture.invalid\r\nSubject: SYNTHETISCHES Replay-Original\r\n\r\nIsolierter Testinhalt.\r\n")}
    :/\.exe$/iu.test(name)?{mime:"application/octet-stream",bytes:Buffer.from("SYNTHETISCH: gesperrter Dateityp; keine ausfuehrbare Datei.")}:null;
  if(!content)throw Error(`FLOW_ORIGINAL_BYTES_NOT_SUPPLIED:${name}`);
  const sha256=createHash('sha256').update(content.bytes).digest('hex');
  if(file.sha256&&file.sha256!==sha256)throw Error(`FLOW_ORIGINAL_FIXTURE_HASH_MISMATCH:${name}`);
  const environment=localReplayStorageEnvironment(databaseUrl!);
  const {createClient}=await import('@supabase/supabase-js');
  const client=createClient(environment.NEXT_PUBLIC_SUPABASE_URL,environment.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const storagePath=TENANT+'/'+sha256;
  const uploaded=await client.storage.from('scans').upload(storagePath,content.bytes,{contentType:content.mime,upsert:true});
  if(uploaded.error)throw Error('FLOW_ORIGINAL_STORAGE_FAILED:'+uploaded.error.message);
  await upsertFixture('intake_file',{
    ...file,tenant_id:TENANT,client_key:file.client_key??file.id,mime:file.mime??content.mime,
    bytes:content.bytes.length,sha256,speicherpfad:storagePath,aufgenommen_am:new Date().toISOString(),
    aufgenommen_von:fixtureLoginId,reihenfolge:sequence,lesbar:file.lesbar??true,
    geoeffnet:file.geoeffnet??false,erkennung_status:file.erkennung_status??'fertig',
  });
}

async function seedIntakeFixture(fixture: GeneratedFixture, fixtureIndex: number) {
  const value = resolvedFixture(fixture);
  const actorId = fixtureLoginId;
  await upsertFixture("intake_item", {
    id: value.id,
    tenant_id: TENANT,
    client_key: `flow:${value.id}`,
    kanal: value.kanal,
    richtung: value.richtung ?? "rein",
    quelle: value.quelle ?? "geraet",
    erstellt_von: actorId,
    empfangen_am: new Date().toISOString(),
    absender_name: value.absender_name,
    absender_adresse: value.absender_adresse,
    betreff: value.betreff,
    text: value.text,
    kunde_id: value.kunde_id,
    vorgang_art: value.vorgang_art,
    vorgang_id: value.vorgang_id,
    zuordnung: value.zuordnung ?? "offen",
    zuordnung_regel: value.zuordnung_regel,
    einsatz: value.einsatz ?? "offen",
    anliegen: value.anliegen,
    anliegen_haupt: value.anliegen_haupt,
    anliegen_offen: value.anliegen_offen,
  });
  const files = Array.isArray(value.dateien) ? value.dateien as Array<Record<string, unknown>> : [];
  const fileIds:string[]=[];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]!;
    const fileId=`40000000-0000-4000-8000-${String(800000 + fixtureIndex * 100 + index).padStart(12, "0")}`;
    await seedOriginalFixture({
      id:fileId,
      item_id: value.id,
      ...file,
    },index+1);
    fileIds.push(fileId);
  }
  const suggestions = Array.isArray(value.vorschlaege) ? value.vorschlaege as Array<Record<string, unknown>> : [];
  for (let index = 0; index < suggestions.length; index += 1) {
    const suggestion = suggestions[index]!;
    await upsertFixture("intake_suggestion", {
      id: `50000000-0000-4000-8000-${String(900000 + fixtureIndex * 100 + index).padStart(12, "0")}`,
      tenant_id: TENANT,
      item_id: value.id,
      file_id:suggestion.file_id??fileIds[0]??null,
      ...suggestion,
    });
  }
}

async function seedSupplementalFixtures(fixtures: GeneratedFixture[]) {
  for (const fixture of fixtures) {
    const fixtureIndex = Object.values(generatedFixtures).indexOf(fixture) + 1;
    if (!fixtureIndex) throw new Error("FLOW_FIXTURE_IDENTITY_UNKNOWN");
    if (fixture.tabelle === "customers" || fixture.tabelle === "address_directory") continue;
    if (fixture.tabelle === "orders") {
      await seedOrderFixture(fixture, fixtureIndex);
      continue;
    }
    if (fixture.tabelle === "intake_item") {
      await seedIntakeFixture(fixture, fixtureIndex);
      continue;
    }
    const value = resolvedFixture(fixture);
    if(fixture.tabelle==='intake_file'){
      await seedOriginalFixture(value,1);
      continue;
    }
    if (fixture.tabelle === "intake_drafts") {
      const actor = generatedFlowRuntime.logins[String(value.login) as keyof typeof generatedFlowRuntime.logins]
        ?? Object.values(generatedFlowRuntime.logins).find(login => login.id === value.login);
      if (!actor) throw new Error(`FLOW_DRAFT_FIXTURE_LOGIN_UNKNOWN:${String(value.login)}`);
      await upsertFixture("intake_drafts", {
        id: value.id,
        tenant_id: TENANT,
        actor_id: actor.id,
        art: value.art,
        zuletzt_feld: value.zuletzt_feld,
        payload: { art: value.art, text: value.text, ...(value.kunde ? { kunde: value.kunde } : {}) },
        status: "open",
      });
      continue;
    }
    if (fixture.tabelle === "company_settings") {
      const baseline=baselineSettings?.[0];
      if(!baseline||typeof baseline.id!=="string")throw Error("FLOW_REPLAY_BASE_SETTINGS_MISSING");
      await upsertFixture("company_settings", { ...baseline,...value, id: baseline.id, tenant_id: TENANT });
      continue;
    }
    if (fixture.tabelle === "intake_file") {
      await seedOriginalFixture(value, 1);
      continue;
    }
    if (fixture.tabelle === "complaint") {
      await upsertFixture("complaints", {
        ...value,
        id: value.id,
        tenant_id: TENANT,
        order_id: value.auftrag_id,
        customer_id: value.kunde_id,
        reason: value.mangel ?? "sonstiges",
        description: value.beschreibung ?? "",
        status: value.stand === "abgeschlossen" ? "resolved" : "open",
      });
      continue;
    }
    const table = fixture.tabelle === "task" ? "tasks" : fixture.tabelle;
    await upsertFixture(table, { ...value, id: value.id, tenant_id: TENANT });
  }
}

export async function closeGeneratedDatabase() {
  await sql.end({ timeout: 5 });
}

function dataSpec(page: Page, id: string, nr?: number): Locator {
  const result = page.locator(`[data-spec-id="${id}"]`);
  return typeof nr === "number" ? result.nth(nr - 1) : result.first();
}

function dataSpecs(page: Page, id: string): Locator {
  return page.locator(`[data-spec-id="${id}"]`);
}

async function control(locator: Locator): Promise<Locator> {
  await locator.waitFor({ state: "attached", timeout: 5_000 });
  const tag = await locator.evaluateAll((elements) => elements[0]?.tagName.toLowerCase() ?? null);
  if (!tag) throw new Error("FLOW_CONTROL_REMOVED");
  return ["input", "textarea", "select", "button"].includes(tag)
    ? locator
    : locator.locator("input, textarea, select, button").first();
}

async function login(page: Page, loginName: keyof typeof generatedFlowRuntime.logins) {
  const fixture = generatedFlowRuntime.logins[loginName];
  await page.context().clearCookies();
  await page.goto("/start");
  const card = page.getByTestId(`pin-user-card-${createPinLoginHandle(fixture.id)}`);
  await expect(card).toBeEnabled();
  await card.click();
  const keypad = dataSpec(page, "login.anmelden");
  await expect(keypad).toBeVisible();
  const navigation = page.waitForURL((url) => url.pathname !== "/start", { timeout: 30_000 });
  for (const digit of fixture.pin) await keypad.getByRole("button", { name: digit, exact: true }).click();
  await navigation;
  await shellReady(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** Copy givens need the existing reader's genuine intake receipt, not an invented event. */
async function materializeCanonicalOrderSource(page: Page) {
  if (!canonicalOrderSource) return false;
  const { fixture } = canonicalOrderSource;
  const value = resolvedFixture(fixture);
  const positions = value.positionen;
  if (!Array.isArray(positions) || !positions.length) throw Error("FLOW_COPY_SOURCE_POSITIONS_MISSING");
  await login(page, "login_meister");
  const clientEventId = randomUUID();
  const input = {
    geprueft: value.geprueft, clientEventId,
    customer: { mode: "EXISTING", customerId: value.kunde }, dueDate: value.liefertermin,
    termStatus: value.terminstatus, intakeSource: value.eingangsart,
    handoverMode: value.uebergabe === "versand" ? "shipping" : value.uebergabe === "abholung" ? "pickup" : value.uebergabe,
    paymentMode: value.zahlungsmodus === "bar" ? "abholung" : value.zahlungsmodus,
    note: "SYNTHETISCH: bestehender Kopierauftrag aus dem echten Anlagebefehl",
    items: positions.map((position: Record<string, unknown>) => ({
      name: position.bezeichnung, quantity: position.menge, material: position.material,
      surfaceRequested: position.oberflaeche, executionRequested: position.ausfuehrung,
      unit: position.einheit, catalogServiceId: null,
      unitPriceCents: position.einzelpreis === null ? null : Math.round(Number(position.einzelpreis) * 100),
      vatRateBasisPoints: position.einzelpreis === null ? null : 1900,
    })),
  };
  const manifest = JSON.parse(readFileSync(path.join(process.cwd(), ".next/server/server-reference-manifest.json"), "utf8")) as {
    node: Record<string, { workers: Record<string, { exportedName?: string; filename?: string }> }>;
  };
  const actions = Object.entries(manifest.node).filter(([, action]) => Object.values(action.workers).some(
    worker => worker.exportedName === "createOrderIntakeAction" && worker.filename === "src/app/actions/eingang.actions.ts",
  ));
  if (actions.length !== 1) throw Error("FLOW_SOURCE_CREATE_ACTION_AMBIGUOUS");
  const response = await page.evaluate(async ({ actionId, input }) => {
    const reply = await fetch("/", { method: "POST", headers: {
      "Next-Action": actionId, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component",
    }, body: JSON.stringify([input]) });
    return { status: reply.status, text: await reply.text() };
  }, { actionId: actions[0]![0], input });
  const receipts = await sql<{ order_id: string; order_number: string }[]>`
    SELECT receipt.order_id,receipt.order_number FROM private.order_intake_receipts receipt
    JOIN public.events event ON event.id=receipt.event_id AND event.tenant_id=receipt.tenant_id
    WHERE receipt.tenant_id=${TENANT} AND receipt.client_event_id=${clientEventId}::uuid
      AND event.event_type='ORDER_INTAKE_CREATED_V1' AND event.client_event_id=${clientEventId}::uuid`;
  if (response.status !== 200 || receipts.length !== 1) throw Error("FLOW_SOURCE_REAL_ACTION_FAILED:" + response.text.slice(-1500));
  const source = receipts[0]!;
  // The given historical station remains the model's state; its intake record is real.
  const station = value.station === "in_arbeit" ? "galvanik" : String(value.station);
  await sql`UPDATE public.orders SET station=${station},current_station=${station},current_station_id=${station},
    status=${station === "abgeschlossen" ? "completed" : "in_progress"},ware=${String(value.ware)}
    WHERE tenant_id=${TENANT} AND id=${source.order_id}`;
  await sql`UPDATE public.items SET current_station_id=${station} WHERE tenant_id=${TENANT} AND order_id=${source.order_id}`;
  if (value.fotos !== undefined) {
    if (!Number.isSafeInteger(value.fotos) || Number(value.fotos) < 0 || Number(value.fotos) > 20) throw Error("FLOW_SOURCE_PHOTO_COUNT_INVALID");
    if (Number(value.fotos) > 0) {
      const itemId = randomUUID(), photoIds: string[] = [];
      await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,text,kunde_id,vorgang_art,vorgang_id,zuordnung)
        VALUES(${itemId}::uuid,${TENANT},${itemId},'notiz','intern','app',${generatedFlowRuntime.logins.login_meister.id}::uuid,
          'SYNTHETISCH: Quellenfotos des Kopierauftrags',${String(value.kunde)},'auftrag',${source.order_id},'hand')`;
      for (let index = 0; index < Number(value.fotos); index++) {
        const fileId = randomUUID(); photoIds.push(fileId);
        await seedOriginalFixture({ id: fileId, item_id: itemId, art: "foto", dateiname: `SYNTHETISCH-Quellfoto-${index + 1}.jpg` }, index + 1);
        await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
          SELECT ${TENANT},${itemId}::uuid,'original_gespeichert',${fileId}::uuid,${generatedFlowRuntime.logins.login_meister.id},
            jsonb_build_object('fileId',file.id,'sha256',file.sha256,'bytes',file.bytes)
          FROM public.intake_file file WHERE file.tenant_id=${TENANT} AND file.id=${fileId}::uuid
            AND NOT EXISTS(SELECT 1 FROM public.intake_event prior WHERE prior.tenant_id=file.tenant_id AND prior.item_id=file.item_id AND prior.art='original_gespeichert' AND prior.befehl_id=${fileId}::uuid)`;
      }
      const sourceItems = await sql<{ id: string }[]>`SELECT id FROM public.items WHERE tenant_id=${TENANT} AND order_id=${source.order_id} ORDER BY id`;
      if (!sourceItems.length) throw Error("FLOW_SOURCE_PHOTO_POSITION_MISSING");
      await sql`UPDATE public.items SET photo_ids=${sql.json(photoIds)} WHERE tenant_id=${TENANT} AND id=${sourceItems[0]!.id}`;
    }
  }
  const integrity = await sql.begin(async tx => {
    await tx`SELECT set_config('app.tenant_id',${TENANT},true)`;
    return tx<{ integrity_ok: boolean }[]>`SELECT integrity_ok FROM private.v_order_intake_receipts_v1 WHERE tenant_id=${TENANT} AND order_id=${source.order_id}`;
  });
  if (integrity.length !== 1 || integrity[0]!.integrity_ok !== true) throw Error("FLOW_SOURCE_RECEIPT_INTEGRITY_FAILED");
  canonicalOrderIds.set(fixture.id, { id: source.order_id, order_number: source.order_number });
  canonicalOrderSource = null;
  return true;
}

async function shellReady(page: Page) {
  await page.getByRole("button", { name: "Konto", exact: true }).waitFor({ state: "visible", timeout: 5_000 });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

function addWorkdays(date: Date, delta: number) {
  let day = dateIso(date);
  if (delta >= 0) {
    const next = plusWorkingDays(day, delta);
    if (!next) throw new Error(`FLOW_WORKDAY_INVALID:${day}:${delta}`);
    return new Date(`${next}T12:00:00Z`);
  }
  day = previousWorkingDay(day)!;
  for (let index = 0; index < Math.abs(delta); index += 1) {
    const before = new Date(`${day}T12:00:00Z`);
    before.setUTCDate(before.getUTCDate() - 1);
    day = previousWorkingDay(dateIso(before))!;
  }
  return new Date(`${day}T12:00:00Z`);
}

function today() { return new Date(`${berlinCalendarDay()}T12:00:00Z`); }

function dateIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formattedDate(date: Date, format?: string) {
  if (!format) return dateIso(date);
  const short = `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.`;
  if (format === "TT.MM.") return short;
  if (format === "WT TT.MM.") return `${["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][date.getUTCDay()]} ${short}`;
  throw new Error(`FLOW_DATE_FORMAT_UNSUPPORTED:${format}`);
}

function calendarWeekEnd(date: Date) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + (5 - (result.getUTCDay() || 7)));
  while (!isWorkingDay(dateIso(result))) result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

function followingWeekStart(date: Date) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + (8 - (result.getUTCDay() || 7)));
  while (!isWorkingDay(dateIso(result))) result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

function runtimeValue(name: string, state?: FlowRunState): string | null {
  const row = name === "auftrag" ? state?.rows.get("orders")
    : name === "kunde" ? state?.rows.get("customers")
      : name === "kv" ? state?.rows.get("orders")
        : name === "reklamation" ? state?.rows.get("complaint") ?? state?.rows.get("complaints")
        : undefined;
  if (!row) return null;
  const key = name === "auftrag" || name === "kv" ? "order_number"
    : name === "kunde" ? "customer_number"
      : "nummer";
  return typeof row[key] === "string" ? row[key] : null;
}

function resolveString(value: string, state?: FlowRunState): string {
  let result = value;
  result = result.replace(/\{neu:([a-z_]+)\}/g, (match, table) => {
    const id = state?.rows.get(table)?.id;
    if (typeof id !== "string" || !state?.beforeIds.has(table) || state.beforeIds.get(table)!.has(id)) throw new Error(`FLOW_RUNTIME_REFERENCE_UNRESOLVED:${match}`);
    return id;
  });
  result = result.replace(/\{(auftrag|kunde|kv|reklamation)\}/g, (match, name) => {
    const resolved = runtimeValue(name, state);
    if (!resolved) return match;
    return resolved;
  });
  result = result.replace(/\{arbeitstag:([+-]\d+)(?:\|(TT\.MM\.|WT TT\.MM\.))?\}/g, (_, raw, format) => {
    const date = addWorkdays(today(), Number(raw));
    return formattedDate(date, format);
  });
  result = result.replace(/\{heute:([+-]\d+)(?:\|(TT\.MM\.|WT TT\.MM\.))?\}/g, (_, raw, format) => {
    const date = today();
    date.setUTCDate(date.getUTCDate() + Number(raw));
    return formattedDate(date, format);
  });
  result = result.replace(/\{kw_ende:([+-]\d+)\}/g, (_, raw) => {
    return dateIso(calendarWeekEnd(addWorkdays(today(), Number(raw))));
  });
  result = result.replace(/\{kw_folge_anfang:([+-]\d+)\}/g, (_, raw) => {
    return dateIso(followingWeekStart(addWorkdays(today(), Number(raw))));
  });
  result = result.replaceAll("{gesetzt}", VALUE_IS_SET);
  result = result.replaceAll("{login}", state?.loginId ?? "");
  result = result.replaceAll("{fehler}", "");
  result = result.replace(/\{([a-z_]+)(?:\.([a-z_]+))?\}/g, (match, fixtureName, field) => {
    const fixture = generatedFlowRuntime.datenlagen[fixtureName as keyof typeof generatedFlowRuntime.datenlagen];
    if (!fixture) return match;
    const aliased = canonicalOrderIds.get(fixture.id);
    let resolved = field ? fixture[field as keyof typeof fixture] : aliased?.id ?? fixture.id;
    if (aliased && field === "id") resolved = aliased.id;
    if (aliased && field === "order_number") resolved = aliased.order_number;
    if (resolved === null || resolved === undefined) return "";
    const text = String(resolved);
    return text.includes("{") ? resolveString(text, state) : text;
  });
  return result;
}

function resolveValue(value: unknown, state?: FlowRunState): unknown {
  if (typeof value === "string") return resolveString(value, state);
  if (Array.isArray(value)) return value.map((entry) => resolveValue(entry, state));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveValue(entry, state)]));
  return value;
}

async function select(locator: Locator, label: string) {
  const target = await control(locator);
  const tagName = await target.evaluate((element) => element.tagName.toLowerCase());
  if (tagName === "select") await target.selectOption({ label }, { timeout: 5_000 });
  else await choiceButton(locator, label).click({ timeout: 5_000 });
}

function choiceButton(locator: Locator, label: string): Locator {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return locator.getByRole("button", { name: label, exact: true })
    .or(locator.locator("button").filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) }));
}

async function interruptNextServerAction(page: Page, state: FlowRunState) {
  state.interruptionObserved=page.waitForEvent("requestfailed",{
    predicate:request=>request.method()==="POST"&&Boolean(request.headers()["next-action"]),timeout:5_000,
  }).then(()=>true,()=>false);
  await page.context().setOffline(true);
}

async function interruptNextLoad(page: Page) {
  const matcher = "**/*";
  let handled = false;
  const handler = async (route: import("@playwright/test").Route) => {
    const request = route.request();
    // App Router also transports read Server Actions with POST + Next-Action.
    const isLoad = ["document", "fetch", "xhr"].includes(request.resourceType())
      && (request.method() === "GET" || (request.method() === "POST" && Boolean(request.headers()["next-action"])));
    if (!handled && isLoad) {
      handled = true;
      await route.abort("failed");
      await page.unroute(matcher, handler);
      return;
    }
    await route.continue();
  };
  await page.route(matcher, handler);
}

const settledServerActions = new Set(["eingang.buchen", "eingang.erneut-buchen", "eingang.angaben-erkennen",
  "ware.annehmen","ware.nur-annehmen","ware.teil-warten","ware.rest-annehmen","ware.erneut",
  "original.am-original-geprueft","original.erneut-lesen"]);

/** Open the actual accordion before a user interaction; visibility assertions stay unchanged. */
async function revealForInteraction(locator:Locator){
  await locator.waitFor({state:"attached",timeout:5_000});
  if(await locator.isVisible())return;
  const section=locator.locator('xpath=ancestor::section[contains(concat(" ",normalize-space(@class)," ")," ev-schritt9 ")][1]');
  if(await section.count())await section.locator('button.ev-schritt9-kopf').click({timeout:15_000});
}

async function waitForServerAction(page: Page, id: string) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect.poll(async () => {
    const action = page.locator(`[data-spec-id="${id}"]`).first();
    // Recognition removes this button; inspect its state in one DOM snapshot.
    return action.evaluateAll((elements) => {
      const element = elements[0];
      if (!element) return "settled";
      const busy = element.matches(":disabled") || element.getAttribute("aria-disabled") === "true"
        || /Wird (?:gebucht|angenommen|gespeichert)|Foto wird gesichert/u.test(element.textContent??"");
      return busy ? "busy" : "settled";
    });
  }, { timeout: 15_000 }).toBe("settled");
}

async function executeStep(page: Page, step: FlowStep, state: FlowRunState) {
  if (!step.aktion && step.erwartung) {
    await assertExpectation(page, step, state);
    return;
  }
  if (step.aktion === "oeffne") {
    await openTarget(page, String(step.wert), resolveValue(step.arg, state));
    return;
  }
  if (step.aktion === "erwarten") {
    await captureDbResults(step.db??[],state);
    await assertExpectations(page, step.anzeige ?? [], state);
    await assertDb(step.db ?? [], state);
    return;
  }
  if (step.aktion === "netz_unterbrechen") {
    await interruptNextServerAction(page,state);
    state.restoreOnlineAfterWrite = true;
    return;
  }
  if (step.aktion === "netz_laden") {
    await interruptNextLoad(page);
    return;
  }
  const locator = step.id ? dataSpec(page, step.id, step.nr) : null;
  const value = resolveValue(step.wert, state);
  if(locator&&step.aktion&&["datei","klicken","doppelklicken","tippen","waehlen","verlassen","taste"].includes(step.aktion))await revealForInteraction(locator);
  switch (step.aktion) {
    case "datei": {
      if (!locator) throw new Error("FLOW_STEP_ID_REQUIRED:datei");
      await locator.waitFor({ state: "attached", timeout: 5_000 });
      const names = Array.isArray(value) ? value.map(String) : [String(value)];
      const files = names.map((name) => {
        if (!/^pruef_(?:foto(?:_2)?\.jpg|tabelle\.xlsx)$/.test(name)) throw new Error(`FLOW_TEST_FILE_UNSUPPORTED:${name}`);
        return {
          name,
          mimeType: name.endsWith(".jpg") ? "image/jpeg" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: name.endsWith(".jpg")
            ? Buffer.from("/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=", "base64")
            : Buffer.from("Isolated generated-flow fixture: unsupported spreadsheet upload\n", "utf8"),
        };
      });
      const input = locator.locator('input[type="file"]');
      if (await locator.evaluate((element) => element.matches('input[type="file"]'))) await locator.setInputFiles(files, { timeout: 5_000 });
      else if (await input.count()) await input.setInputFiles(files, { timeout: 5_000 });
      else {
        const chooser = page.waitForEvent("filechooser", { timeout: 5_000 });
        await locator.click({ timeout: 5_000 });
        await (await chooser).setFiles(files);
      }
      if(state.restoreOnlineAfterWrite){
        expect(await state.interruptionObserved,"file upload really encountered the requested server interruption").toBe(true);
        await page.context().setOffline(false);
        state.restoreOnlineAfterWrite=false;
      }
      break;
    }
    case "klicken":
      if (!locator) throw new Error("FLOW_STEP_ID_REQUIRED:klicken");
      await locator.click({ timeout: 5_000 });
      if (step.id && settledServerActions.has(step.id)) await waitForServerAction(page, step.id);
      if (state.restoreOnlineAfterWrite) {
        await page.context().setOffline(false);
        state.restoreOnlineAfterWrite = false;
      }
      break;
    case "doppelklicken":
      if (!locator) throw new Error("FLOW_STEP_ID_REQUIRED:doppelklicken");
      await locator.dblclick({ timeout: 5_000 });
      if (step.id && settledServerActions.has(step.id)) await waitForServerAction(page, step.id);
      if (state.restoreOnlineAfterWrite) {
        await page.context().setOffline(false);
        state.restoreOnlineAfterWrite = false;
      }
      break;
    case "tippen":
      if (!locator) throw new Error("FLOW_STEP_ID_REQUIRED:tippen");
      await (await control(locator)).fill(String(value ?? ""), { timeout: 5_000 });
      break;
    case "waehlen":
      if (!locator) throw new Error("FLOW_STEP_ID_REQUIRED:waehlen");
      await select(locator, String(value ?? ""));
      break;
    case "verlassen":
      if (!locator) throw new Error("FLOW_STEP_ID_REQUIRED:verlassen");
      await (await control(locator)).focus();
      await (await control(locator)).press("Tab", { timeout: 5_000 });
      break;
    case "taste":
      if (locator) await (await control(locator)).press(String(value ?? ""), { timeout: 5_000 });
      else {
        if (String(value ?? "").toLowerCase() === "n") {
          await shellReady(page);
        }
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await page.locator("body").press(String(value ?? ""), { timeout: 5_000 });
      }
      break;
    default:
      throw new Error(`FLOW_STEP_ACTION_UNSUPPORTED:${step.aktion}`);
  }
}

async function topDialog(page: Page) {
  return page.locator('[role="dialog"]:visible').last();
}

async function openTarget(page: Page, target: string, arg: unknown) {
  if (target === "kundebearbeiten") {
    const [customerId, fragment] = String(arg ?? "").split("#", 2);
    if (!customerId) throw new Error("FLOW_OPEN_CUSTOMER_REQUIRED");
    if (fragment && !["fehlend", "uebernahme", "bearbeiten"].includes(fragment)) throw new Error(`FLOW_CUSTOMER_MODE_UNSUPPORTED:${fragment}`);
  }
  await page.evaluate(({ ziel, argument }) => {
    window.dispatchEvent(new CustomEvent("kreile:oeffne", { detail: { ziel, arg: argument } }));
  }, { ziel: target, argument: arg ?? null });
}

async function selectedColor(locator: Locator, selected: boolean) {
  const color = await locator.evaluate((element) => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--ci-success)";
    element.appendChild(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { expected, actual: getComputedStyle(element).backgroundColor };
  });
  // Wait for the supplied color transition; the exact required color is unchanged.
  const settled = () => locator.evaluate(element => getComputedStyle(element).backgroundColor);
  if (selected) await expect.poll(settled, { timeout: 2_000 }).toBe(color.expected);
  else await expect.poll(settled, { timeout: 2_000 }).not.toBe(color.expected);
}

async function assertExpectation(page: Page, expectation: FlowExpectation, state: FlowRunState) {
  if (typeof expectation.druck === "number") {
    await expect.poll(() => page.evaluate(() => Number((window as unknown as Record<string, unknown>).__flowPrintCount ?? 0))).toBe(expectation.druck);
    return;
  }
  if (typeof expectation.dialoge === "number") {
    await expect(page.locator('[role="dialog"]:visible')).toHaveCount(expectation.dialoge);
    return;
  }
  if (expectation.oben) {
    if (generatedFlowRuntime.screenTypes[expectation.oben as keyof typeof generatedFlowRuntime.screenTypes] === "seite") {
      await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0);
      await expect(dataSpec(page, expectation.oben)).toBeVisible();
      return;
    }
    const dialog = await topDialog(page);
    // The card's loading layer is replaced asynchronously. Keep the same
    // top-layer assertion live while its root receives the object identifier.
    await expect(dialog.and(page.locator(`[data-spec-id="${expectation.oben}"]`))
      .or(dialog.locator(`[data-spec-id="${expectation.oben}"]`))).toBeVisible();
    return;
  }
  if (expectation.toast) {
    await expect(page.getByRole("status").filter({ hasText: resolveString(expectation.toast, state) })).toBeVisible();
    return;
  }
  const value = resolveValue(expectation.wert ?? expectation.text, state);
  if (!expectation.id) {
    const dialog = await page.locator('[role="dialog"]:visible').count() ? await topDialog(page) : page.locator('main').first();
    if (expectation.erwartung === "toast") await expect(page.getByRole("status").last()).toBeVisible();
    else if (expectation.erwartung === "nicht_sichtbar") await expect(dialog.getByText(String(value), { exact: false })).toHaveCount(0);
    else if (expectation.erwartung === "text") await expect(dialog.getByText(String(value), { exact: true })).toBeVisible();
    else await expect(dialog.getByText(String(value), { exact: false }).first()).toBeVisible();
    return;
  }
  const locator = ["anzahl", "anzahl_min", "anzahl_max"].includes(expectation.erwartung ?? "")
    ? dataSpecs(page, expectation.id)
    : dataSpec(page, expectation.id, expectation.nr);
  switch (expectation.erwartung) {
    case "sichtbar": await expect(locator).toBeVisible(); break;
    case "nicht_sichtbar": await expect(locator).toBeHidden(); break;
    case "text": await expect(locator).toHaveText(String(value)); break;
    case "text_enthaelt": await expect(locator).toContainText(String(value)); break;
    case "wert": {
      const target = await control(locator);
      const tag = await target.evaluate((element) => element.tagName.toLowerCase());
      if (tag === "select") await expect(target.locator("option:checked")).toHaveText(String(value));
      else await expect(target).toHaveValue(String(value));
      break;
    }
    case "wert_nicht": await expect(await control(locator)).not.toHaveValue(String(value)); break;
    case "leer": await expect(await control(locator)).toHaveValue(""); break;
    case "nicht_leer": await expect(await control(locator)).not.toHaveValue(""); break;
    case "ohne_wahl": {
      const target = await control(locator);
      const tag = await target.evaluate((element) => element.tagName.toLowerCase());
      if (tag === "select") await expect(target).toHaveValue("");
      else await expect(locator.locator('[aria-pressed="true"]')).toHaveCount(0);
      break;
    }
    case "gewaehlt": {
      const target = await control(locator);
      const tag = await target.evaluate((element) => element.tagName.toLowerCase());
      if (tag === "button" && value === undefined) {
        await expect(target).toHaveAttribute("aria-pressed","true");
        await selectedColor(target,true);
      } else if (tag === "select") {
        await expect(target.locator("option:checked")).toHaveText(String(value));
        await selectedColor(target, true);
      } else {
        const chosen = choiceButton(locator, String(value));
        await expect(chosen).toHaveAttribute("aria-pressed", "true");
        await selectedColor(chosen, true);
      }
      break;
    }
    case "nicht_gewaehlt": {
      const target = await control(locator);
      const label = resolveString(expectation.option ?? String(value), state);
      if (await target.evaluate((element) => element.tagName.toLowerCase()) === "select") {
        await expect(target.locator("option:checked")).not.toHaveText(label);
      } else {
        const option = choiceButton(locator, label);
        await expect(option).not.toHaveAttribute("aria-pressed", "true");
        await selectedColor(option, false);
      }
      break;
    }
    case "an": await expect(await control(locator)).toBeChecked(); break;
    case "aus": await expect(await control(locator)).not.toBeChecked(); break;
    case "optionen": {
      const target = await control(locator);
      const labels = Array.isArray(value) ? value.map(String) : [];
      const tag = await target.evaluate((element) => element.tagName.toLowerCase());
      const actual = tag === "select" ? await target.locator("option").allTextContents() : await locator.getByRole("button").evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-label") ?? button.textContent ?? ""));
      expect(actual.map((entry) => entry.trim()).filter(Boolean)).toEqual(labels);
      break;
    }
    case "gesperrt": {
      const target = await control(locator);
      const label = resolveString(expectation.option ?? String(value), state);
      if (await target.evaluate((element) => element.tagName.toLowerCase()) === "select") {
        const option = target.locator("option:disabled").filter({ hasText: label });
        await expect(option).toHaveCount(1);
        await expect(option).toContainText(String(value));
      } else {
        const option = locator.getByRole("button", { name: label, exact: false });
        await expect(option).toBeDisabled();
        const reason = locator.getByText(String(value), { exact: false });
        await expect(reason).toBeVisible();
      }
      break;
    }
    case "aktiv":
    case "aktiviert": await expect(await control(locator)).toBeEnabled(); break;
    case "fokus": await expect(await control(locator)).toBeFocused(); break;
    case "anzahl": await expect(locator).toHaveCount(Number(value)); break;
    case "anzahl_min": await expect.poll(() => locator.count()).toBeGreaterThanOrEqual(Number(value)); break;
    case "anzahl_max": await expect.poll(() => locator.count()).toBeLessThanOrEqual(Number(value)); break;
    case "status": await expect(locator).toContainText(String(value), { ignoreCase: true }); break;
    default: throw new Error(`FLOW_EXPECTATION_UNSUPPORTED:${expectation.erwartung}`);
  }
}

async function assertExpectations(page: Page, expectations: FlowExpectation[], state: FlowRunState) {
  for (const expectation of expectations) await assertExpectation(page, expectation, state);
}

type DatabaseMapping = { schema?: string; table: string; columns: Record<string, string>; transforms: Record<string, string> };
const databaseMapping = generatedFlowRuntime.database as unknown as Record<string, DatabaseMapping>;

function fixtureStorageSchema(table: string): string {
  return Object.values(databaseMapping).find((entry) => entry.table === table)?.schema ?? "public";
}

function qualifiedStorageTable(table: string): string {
  const schema = fixtureStorageSchema(table);
  if (!/^[a-z_]+$/.test(table) || !["public", "private"].includes(schema)) throw new Error("FLOW_DB_TABLE_INVALID");
  return `"${schema}"."${table}"`;
}

function storageMapping(table: string): DatabaseMapping {
  const mapping = databaseMapping[table];
  if (!mapping || !/^[a-z_]+$/.test(mapping.table)) throw new Error(`FLOW_DB_TABLE_UNSUPPORTED:${table}`);
  return mapping;
}

function storageColumn(table: string, field: string) {
  const column = storageMapping(table).columns[field] ?? field;
  if (!/^[a-z_]+$/.test(column)) throw new Error(`FLOW_DB_COLUMN_INVALID:${table}:${field}`);
  return column;
}

async function tableIds(table: string): Promise<string[]> {
  const actual = storageMapping(table).table;
  const rows = await sql.unsafe<{ id: string }[]>(`SELECT id::text AS id FROM ${qualifiedStorageTable(actual)} WHERE tenant_id = $1`, [TENANT]);
  return rows.map((row) => row.id);
}

async function tableCount(table: string) { return (await tableIds(table)).length; }

async function readStorageRow(table: string, where: Record<string, unknown>) {
  const actual = storageMapping(table).table;
  const params: unknown[] = [TENANT];
  const clauses = ['record.tenant_id = $1'];
  for (const [field, value] of Object.entries(where)) {
    params.push(storageColumn(table, field), JSON.stringify(value));
    // JSON text is explicitly typed as text so postgres.js does not encode it twice.
    clauses.push(`(to_jsonb(record) -> $${params.length - 1}::text) IS NOT DISTINCT FROM $${params.length}::text::jsonb`);
  }
  const rows = await sql.unsafe<{ row: Record<string, unknown> }[]>(
    `SELECT to_jsonb(record) AS row FROM ${qualifiedStorageTable(actual)} record WHERE ${clauses.join(' AND ')} LIMIT 2`, params as never[],
  );
  expect(rows, `one exact ${table} row for ${JSON.stringify(where)}`).toHaveLength(1);
  return rows[0]!.row;
}

async function captureDbResults(expectations: FlowDbExpectation[], state: FlowRunState) {
  for (const expectation of expectations) {
    if (typeof expectation.neu !== 'number') {
      if (expectation.wo || state.rows.has(expectation.tabelle) || !Object.keys(expectation.werte ?? {}).length) continue;
      const beforeIds = state.beforeIds.get(expectation.tabelle);
      if (!beforeIds) throw new Error(`FLOW_DB_BASELINE_MISSING:${expectation.tabelle}`);
      const created = (await tableIds(expectation.tabelle)).filter(id => !beforeIds.has(id));
      // A value assertion without wo/neu still needs one exact Action-created row.
      // Never pick a stale row or arbitrarily choose among several new rows.
      expect(created, `one unambiguous new ${expectation.tabelle} assertion target`).toHaveLength(1);
      state.rows.set(expectation.tabelle, await readStorageRow(expectation.tabelle, { id: created[0]! }));
      continue;
    }
    const before = state.before.get(expectation.tabelle);
    const beforeIds = state.beforeIds.get(expectation.tabelle);
    if (before === undefined || !beforeIds) throw new Error(`FLOW_DB_BASELINE_MISSING:${expectation.tabelle}`);
    if (expectation.neu > 0) await expect.poll(() => tableCount(expectation.tabelle), { timeout: 10_000 }).toBe(before + expectation.neu);
    const afterIds = await tableIds(expectation.tabelle);
    expect(afterIds.length - before).toBe(expectation.neu);
    const created = afterIds.filter((id) => !beforeIds.has(id));
    expect(created).toHaveLength(expectation.neu);
    const rows=await Promise.all(created.map(id=>readStorageRow(expectation.tabelle,{id})));
    state.createdRows.set(expectation.tabelle,rows);
    if (rows.length === 1) state.rows.set(expectation.tabelle,rows[0]!);
  }
}

async function storageValue(table: string, row: Record<string, unknown>, field: string) {
  const transform = storageMapping(table).transforms[field];
  const column = storageColumn(table, field);
  if (!Object.hasOwn(row, column)) throw new Error(`FLOW_DB_COLUMN_NOT_BUILT:${table}:${column}`);
  const value = row[column];
  if (transform === 'order_kind') return value === true ? 'kv' : 'auftrag';
  if (transform === 'handover') return value === 'pickup' ? 'abholung' : value === 'shipping' ? 'versand' : value;
  if (transform === 'payment_mode') return value === 'abholung' ? 'bar' : value;
  if (transform === 'berlin_date') {
    if (value === null) return null;
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('FLOW_DB_CALENDAR_DATE_INVALID');
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(value));
  }
  if (transform) throw new Error(`FLOW_DB_TRANSFORM_UNSUPPORTED:${transform}`);
  return value;
}

async function assertDbValues(expectation: FlowDbExpectation, state: FlowRunState, targetRow?: Record<string, unknown>) {
  if(!targetRow&&!expectation.wo&&typeof expectation.neu==="number"&&expectation.neu>1){
    const created=state.createdRows.get(expectation.tabelle);
    expect(created).toHaveLength(expectation.neu);
    for(const row of created!)await assertDbValues(expectation,state,row);
    return;
  }
  const where = resolveValue(expectation.wo, state) as Record<string, unknown> | undefined;
  const reference = state.rows.get(expectation.tabelle);
  const row = targetRow ?? (where ? await readStorageRow(expectation.tabelle, where)
    : reference ? await readStorageRow(expectation.tabelle, { id: reference.id }) : undefined);
  if (!row) throw new Error(`FLOW_DB_NEW_ROW_REQUIRED:${expectation.tabelle}`);
  const values = Object.entries(resolveValue(expectation.werte ?? {}, state) as Record<string, unknown>);
  for (const [key, expected] of values) {
    const contains = key.endsWith('_enthaelt');
    const field = contains ? key.slice(0, -'_enthaelt'.length) : key;
    const actual = await storageValue(expectation.tabelle, row, field);
    if (expected === VALUE_IS_SET) expect(actual).not.toBeNull();
    else if (contains) {
      if (Array.isArray(actual) || typeof actual === 'string') expect(actual).toContain(expected);
      else throw new Error(`FLOW_DB_CONTAINS_TYPE_INVALID:${expectation.tabelle}:${field}`);
    } else expect(actual).toEqual(expected);
  }
}

async function assertDb(expectations: FlowDbExpectation[], state: FlowRunState) {
  for (const expectation of expectations) {
    if (typeof expectation.neu === 'number') {
      const before = state.before.get(expectation.tabelle);
      if (before === undefined) throw new Error(`FLOW_DB_BASELINE_MISSING:${expectation.tabelle}`);
      expect((await tableCount(expectation.tabelle)) - before).toBe(expectation.neu);
    }
    if (Object.keys(expectation.werte ?? {}).length) await assertDbValues(expectation, state);
  }
}

export async function runGeneratedFlowCase(page: Page, flowCase: FlowCase) {
  try { await runGeneratedFlowCaseBody(page,flowCase); }
  catch(error){
    if(process.env.FLOW_DIAGNOSTICS==="1")try{
      writeFileSync(path.resolve(".git",`flow-${flowCase.id}.txt`),await page.locator("body").innerText({timeout:1_000}),"utf8");
      await page.screenshot({path:path.resolve(".git",`flow-${flowCase.id}.png`),timeout:3_000});
    }catch(diagnosticError){console.error("[FLOW_FAILURE_DIAGNOSTICS_FAILED]",diagnosticError);}
    throw error;
  }
}

async function runGeneratedFlowCaseBody(page: Page, flowCase: FlowCase) {
  testTimeoutGuard(flowCase);
  const sourceWasMaterialized = await materializeCanonicalOrderSource(page);
  const dbExpectations = flowCase.dann?.db ?? [];
  const state: FlowRunState = {
    before: new Map<string, number>(),
    beforeIds: new Map<string, Set<string>>(),
    rows: new Map<string, Record<string, unknown>>(),
    createdRows: new Map<string, Record<string, unknown>[]>(),
    restoreOnlineAfterWrite: false,
    loginId: generatedFlowRuntime.logins[flowCase.gegeben.login].id,
  };
  for (const name of selectedFixtureNames(flowCase.gegeben.datenlagen)) {
    const fixture = generatedFixtures[name]!;
    if (["orders", "customers", "complaint"].includes(fixture.tabelle) && !state.rows.has(fixture.tabelle)) {
      state.rows.set(fixture.tabelle, resolvedFixture(fixture));
    }
  }
  const stepExpectations = [
    ...(Array.isArray(flowCase.gegeben.aufruf.weg) ? flowCase.gegeben.aufruf.weg : []),
    ...(flowCase.wenn ?? []),
  ].filter((step) => step.aktion === "erwarten").flatMap((step) => step.db ?? []);
  for (const expectation of [...dbExpectations, ...stepExpectations]) {
    const needsNewRowReference = !expectation.wo && !state.rows.has(expectation.tabelle) && Object.keys(expectation.werte ?? {}).length > 0;
    if ((typeof expectation.neu === "number" || needsNewRowReference) && !state.before.has(expectation.tabelle)) {
      state.before.set(expectation.tabelle, await tableCount(expectation.tabelle));
      state.beforeIds.set(expectation.tabelle, new Set(await tableIds(expectation.tabelle)));
    }
  }
  if (!sourceWasMaterialized || flowCase.gegeben.login !== "login_meister") await login(page, flowCase.gegeben.login);
  await page.addInitScript(() => {
    const scope = window as unknown as Record<string, unknown>;
    scope.__flowPrintCount = 0;
    window.print = () => { scope.__flowPrintCount = Number(scope.__flowPrintCount) + 1; };
  });
  await page.evaluate(() => {
    const scope = window as unknown as Record<string, unknown>;
    scope.__flowPrintCount = 0;
    window.print = () => { scope.__flowPrintCount = Number(scope.__flowPrintCount) + 1; };
  });
  const route = flowCase.gegeben.aufruf;
  if (route.weg === "oeffne") {
    await openTarget(page, route.seite, resolveValue(route.arg, state));
  } else {
    for (const step of route.weg ?? []) await executeStep(page, step, state);
  }
  for (const step of flowCase.wenn ?? []) await executeStep(page, step, state);
  await captureDbResults(dbExpectations, state);
  await assertExpectations(page, flowCase.dann?.anzeige ?? [], state);
  await assertDb(dbExpectations, state);
}

function testTimeoutGuard(flowCase: FlowCase) {
  if (!flowCase.id || !flowCase.titel || !flowCase.gegeben?.login) throw new Error("FLOW_CASE_CONTRACT_INVALID");
}
