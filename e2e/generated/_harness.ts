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
  daten?: Record<string, unknown>;
  tabelle?: string;
  wo?: Record<string, unknown>;
  werte?: Record<string, unknown>;
  anzeige?: FlowExpectation[];
  db?: FlowDbExpectation[];
  server?: { fehler?: string };
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
  dann?: { anzeige?: FlowExpectation[]; db?: FlowDbExpectation[]; server?: { fehler?: string } };
};

type FlowRunState = {
  before: Map<string, number>;
  beforeIds: Map<string, Set<string>>;
  rows: Map<string, Record<string, unknown>>;
  createdRows: Map<string, Record<string, unknown>[]>;
  restoreOnlineAfterWrite: boolean;
  interruptionObserved?: Promise<boolean>;
  loginId: string;
  loginName: keyof typeof generatedFlowRuntime.logins;
  serverResult?: { code?: unknown; message?: unknown };
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

/**
 * The isolated replay database may start without operational invoice master
 * data. Browser flows that explicitly exercise a real invoice must not turn
 * that infrastructure gap into a product false negative. These values exist
 * only in the generated replay seed and are deliberately recognisable as
 * synthetic; an explicit `company_settings` fixture can still replace them
 * for a fail-closed master-data case.
 */
function completeSyntheticReplaySettings(row: Record<string, unknown>) {
  const text = (key: string, fallback: string) => {
    const value = row[key];
    return typeof value === "string" && value.trim().length > 0 ? value : fallback;
  };
  const paymentTerm = row.invoice_payment_term_days;
  const vatRate = row.invoice_vat_rate_basis_points;
  return {
    ...row,
    company_name: text("company_name", "SYNTHETISCH Replay-Betrieb"),
    street: text("street", "Replaystraße 1"),
    zip: text("zip", "99099"),
    city: text("city", "Replaystadt"),
    country: text("country", "DE"),
    tax_id: text("tax_id", "DE999999999"),
    iban: text("iban", "DE89370400440532013000"),
    bic: text("bic", "COBADEFFXXX"),
    bank_name: text("bank_name", "SYNTHETISCH Replaybank"),
    invoice_vat_rate_basis_points: vatRate === 700 || vatRate === 1900 ? vatRate : 1900,
    invoice_payment_term_days: typeof paymentTerm === "number" && Number.isInteger(paymentTerm) && paymentTerm >= 1 && paymentTerm <= 365
      ? paymentTerm
      : 30,
  };
}

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
    baselineSettings = rows.map((row) => completeSyntheticReplaySettings(row.row));
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
    before: new Map(), beforeIds: new Map(), rows: new Map(), createdRows: new Map(), restoreOnlineAfterWrite: false,
    loginId, loginName: "login_meister",
  }) as GeneratedFixture;
}

function unitLabel(value: unknown) {
  return value === "stueck" ? "Stück" : value === "dm2" ? "dm²" : value;
}

function fixtureUuid(seed: string) {
  const digest = createHash("sha256").update(`flow-replay:${seed}`).digest();
  digest[6] = (digest[6]! & 0x0f) | 0x40;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function seedOrderFixture(fixture: GeneratedFixture, orderIndex: number) {
  const value = resolvedFixture(fixture);
  const declaredPositions = Array.isArray(value.positionen) ? value.positionen as Array<Record<string, unknown>> : [];
  // A persisted order is only a valid product state with at least one intake
  // position. The BAUPLAN can omit positions when a flow only cares about the
  // delivery state, so complete that minimal *test-only* contract here.
  const positions = declaredPositions.length > 0
    ? declaredPositions
    : [{
        bezeichnung: "Flow-Prüfteil",
        menge: 1,
        material: null,
        oberflaeche: "offen",
        ausfuehrung: "offen",
        // A real invoice requires a persisted base-line price. This is only
        // for model cases that intentionally omit item details because their
        // assertion is about a later lifecycle step.
        einzelpreis: 10,
      }];
  const customerId = String(value.kunde ?? "");
  if (!customerId) throw new Error("FLOW_ORDER_CUSTOMER_REQUIRED");
  // The model names business states; the database stores the canonical station.
  const station = value.status === "fertig"
    ? "fertig"
    : value.status === "uebergeben"
      ? "abgeholt"
      : value.station === "in_arbeit"
        ? "galvanik"
        : String(value.station ?? "angenommen");
  const frozen = station === "fertig" || station === "abgeholt";
  const freezeVersion = frozen ? 2 : 1;
  // A non-catalog price becomes valid only through the existing immutable
  // price receipt, which follows the freeze and advances the order version.
  // Mirror that real lifecycle in this isolated direct fixture.
  const hasPersistedPrice = frozen && positions.some((position) => (
    typeof position.einzelpreis === "number"
    && Number.isFinite(position.einzelpreis)
    && position.einzelpreis > 0
  ));
  const orderVersion = hasPersistedPrice ? freezeVersion + 1 : freezeVersion;
  // The real intake contract validates its immutable receipt against the
  // canonical promised date. Some BAUPLAN flow states deliberately omit a
  // date because it is irrelevant to their assertion; complete that required
  // test-only contract field deterministically on both sides of the receipt.
  const dueDate = typeof value.liefertermin === "string" && value.liefertermin.trim()
    ? value.liefertermin
    : "2099-12-31";
  const geprueft = value.geprueft === true;
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
    status: value.status === "fertig" ? "fertig" : value.status === "uebergeben" ? "abgeholt" : station === "abgeschlossen" ? "completed" : "in_progress",
    version: orderVersion,
    parts: positions,
    intake_date: value.angenommen_am ?? new Date().toISOString(),
    due_date: dueDate,
    promised_due_date: dueDate,
    payment_mode: value.zahlungsmodus === "bar" || value.zahlungsmodus === "bar_karte" ? "abholung" : value.zahlungsmodus,
    handover_mode: value.uebergabe === "abholung" ? "pickup" : value.uebergabe === "versand" ? "shipping" : value.uebergabe,
    intake_term_status: value.terminstatus,
    intake_source: value.eingangsart,
    source: "F1_ORDER_INTAKE",
    source_ref: value.id,
    ware: value.ware,
    angenommen_am: value.angenommen_am,
    geprueft,
  });
  const snapshot: Array<Record<string, unknown>> = [];
  const priceEntries: Array<{ itemId: string; unitPriceCents: number }> = [];
  for (let positionIndex = 0; positionIndex < positions.length; positionIndex += 1) {
    const position = positions[positionIndex]!;
    const suffix = String(700000 + orderIndex * 100 + positionIndex).padStart(12, "0");
    const itemId = `30000000-0000-4000-8000-${suffix}`;
    const name = typeof position.bezeichnung === "string" && position.bezeichnung.trim().length >= 2
      ? position.bezeichnung.trim()
      : `Flow-Prüfteil ${positionIndex + 1}`;
    const quantity = typeof position.menge === "number" && Number.isInteger(position.menge) && position.menge > 0
      ? position.menge
      : 1;
    const material = typeof position.material === "string" && position.material.trim().length > 0
      ? position.material.trim()
      : null;
    const surfaceRequested = typeof position.oberflaeche === "string" && position.oberflaeche.trim().length >= 2
      ? position.oberflaeche.trim()
      : "offen";
    await upsertFixture("items", {
      id: itemId,
      tenant_id: TENANT,
      order_id: value.id,
      customer_id: customerId,
      name,
      quantity,
      current_station_id: station,
      material,
      surface_requested: surfaceRequested,
      execution_requested: position.ausfuehrung ?? "offen",
      unit: unitLabel(position.einheit),
      preis_netto: position.einzelpreis,
    });
    if (typeof position.einzelpreis === "number"
      && Number.isFinite(position.einzelpreis)
      && position.einzelpreis > 0) {
      priceEntries.push({ itemId, unitPriceCents: Math.round(position.einzelpreis * 100) });
    }
    snapshot.push({
      id: itemId,
      position: positionIndex + 1,
      name,
      quantity,
      material,
      surfaceRequested,
    });
  }

  const customers = await sql<{ name: string; company_name: string | null }[]>`
    SELECT name, company_name
    FROM public.customers
    WHERE tenant_id = ${TENANT} AND id = ${customerId}
    LIMIT 2
  `;
  const customer = customers[0];
  const customerDisplayName = customer?.company_name?.trim() || customer?.name?.trim();
  if (customers.length !== 1 || !customerDisplayName || customerDisplayName.length < 2) {
    throw new Error("FLOW_ORDER_CUSTOMER_READBACK_INVALID");
  }

  const intakeEventId = fixtureUuid(`${value.id}:intake:event`);
  const intakeClientEventId = fixtureUuid(`${value.id}:intake:client`);
  const intakeCorrelationId = fixtureUuid(`${value.id}:intake:correlation`);
  const intentSha256 = createHash("sha256").update(`flow-replay:intake:${value.id}`).digest("hex");
  await upsertFixture("events", {
    id: intakeEventId,
    tenant_id: TENANT,
    order_id: value.id,
    item_id: null,
    event_type: "ORDER_INTAKE_CREATED_V1",
    description: "Flow-Replay Auftrag angelegt",
    user_id: fixtureLoginId,
    payload: { intentSha256 },
    status: "success",
    station: "wareneingang",
    client_event_id: intakeClientEventId,
    event_schema_version: 1,
    correlation_id: intakeCorrelationId,
    aggregate_version: 1,
    from_station: null,
  });
  await upsertFixture("order_intake_receipts", {
    id: fixtureUuid(`${value.id}:intake:receipt`),
    event_id: intakeEventId,
    tenant_id: TENANT,
    order_id: value.id,
    customer_id: customerId,
    actor_id: fixtureLoginId,
    client_event_id: intakeClientEventId,
    correlation_id: intakeCorrelationId,
    intent_sha256: intentSha256,
    customer_mode: "EXISTING",
    order_number: value.order_number,
    customer_display_name: customerDisplayName,
    due_date: dueDate,
    note: null,
    geprueft,
    items_snapshot: snapshot,
  });

  if (!frozen) return;

  const rateId = fixtureUuid(`${value.id}:freeze:rate`);
  const freezeId = fixtureUuid(`${value.id}:freeze:id`);
  const freezeEventId = fixtureUuid(`${value.id}:freeze:event`);
  const freezeClientEventId = fixtureUuid(`${value.id}:freeze:client`);
  const freezeCorrelationId = fixtureUuid(`${value.id}:freeze:correlation`);
  const hourlyRateCents = 12_000;
  await upsertFixture("extra_work_hourly_rates", {
    id: rateId,
    tenant_id: TENANT,
    hourly_rate_cents: hourlyRateCents,
    version: 900_000 + orderIndex,
    created_by: fixtureLoginId,
    effective_at: new Date().toISOString(),
  });
  await upsertFixture("events", {
    id: freezeEventId,
    tenant_id: TENANT,
    order_id: value.id,
    item_id: null,
    event_type: "ORDER_FROZEN_V1",
    description: "Flow-Replay Auftrag fertiggestellt",
    user_id: fixtureLoginId,
    payload: {
      freezeId,
      rateId,
      hourlyRateCents,
      totalAmountCents: 0,
      lineCount: 0,
    },
    status: "success",
    station: "fertig",
    client_event_id: freezeClientEventId,
    event_schema_version: 1,
    correlation_id: freezeCorrelationId,
    aggregate_version: freezeVersion,
    from_station: "galvanik",
  });
  await upsertFixture("order_freezes", {
    id: freezeId,
    tenant_id: TENANT,
    order_id: value.id,
    event_id: freezeEventId,
    hourly_rate_id: rateId,
    hourly_rate_cents: hourlyRateCents,
    total_amount_cents: 0,
    line_count: 0,
    order_version: freezeVersion,
    frozen_by: fixtureLoginId,
  });

  if (!hasPersistedPrice || priceEntries.length === 0) return;

  const priceEventId = fixtureUuid(`${value.id}:price:event`);
  const priceClientEventId = fixtureUuid(`${value.id}:price:client`);
  const requestHash = createHash("sha256").update(`flow-replay:price:${value.id}`).digest("hex");
  await upsertFixture("events", {
    id: priceEventId,
    tenant_id: TENANT,
    order_id: value.id,
    item_id: null,
    event_type: "ORDER_INVOICE_PRICES_SET_V1",
    description: "Rechnungspreise ergänzt",
    user_id: fixtureLoginId,
    payload: { requestHash, prices: priceEntries },
    status: "success",
    station: "fertig",
    client_event_id: priceClientEventId,
    event_schema_version: 1,
    aggregate_version: orderVersion,
    from_station: null,
  });
}

const agreementLabel = (type: unknown) => type === "ausgabe_ohne_zahlung"
  ? "Übergabe ohne Zahlung · Rechnung folgt"
  : type === "sammelrechnung"
    ? "Sammelrechnung monatlich"
    : type === "zahlungsziel"
      ? "Zahlungsziel in Tagen"
      : null;

async function nextAgreementPosition(customerId: string): Promise<number> {
  const rows = await sql<{ position: number }[]>`
    SELECT candidate::integer AS position
    FROM generate_series(1, 20) AS candidate
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.customer_agreements agreement
      WHERE agreement.tenant_id = ${TENANT}
        AND agreement.customer_id = ${customerId}
        AND agreement.position = candidate
        AND agreement.widerrufen_am IS NULL
    )
    ORDER BY candidate
    LIMIT 1
  `;
  if (rows.length !== 1) throw new Error("FLOW_AGREEMENT_POSITION_UNAVAILABLE");
  return rows[0]!.position;
}

async function seedAgreementFixture(fixture: GeneratedFixture) {
  const value = resolvedFixture(fixture);
  const customerId = typeof value.kunde === "string" ? value.kunde : "";
  const type = typeof value.typ === "string" ? value.typ : null;
  const label = agreementLabel(type);
  if (!customerId || (type !== null && !label)) throw new Error("FLOW_AGREEMENT_FIXTURE_INVALID");
  const targetDays = typeof value.ziel_tage === "number" ? value.ziel_tage : null;
  await upsertFixture("customer_agreements", {
    id: value.id,
    tenant_id: TENANT,
    customer_id: customerId,
    position: await nextAgreementPosition(customerId),
    bezeichnung: typeof value.bezeichnung === "string" ? value.bezeichnung : label ?? `Freitext ${String(value.id).slice(-4)}`,
    wert: value.wert ?? (targetDays === null ? null : `${targetDays} Tage`),
    geld: typeof value.geld === "boolean" ? value.geld : type !== null,
    hinweis: typeof value.hinweis === "boolean" ? value.hinweis : false,
    gueltig_bis: value.gueltig_bis ?? null,
    typ: type,
    order_id: value.order_id ?? null,
    ziel_tage: targetDays,
    grund: value.grund ?? null,
    version: typeof value.version === "number" ? value.version : 1,
    client_key: null,
    created_by: fixtureLoginId,
  });
}

async function seedInvoiceCollectionFixture(fixture: GeneratedFixture) {
  const value = resolvedFixture(fixture);
  const customerId = typeof value.kunde === "string" ? value.kunde : "";
  const month = typeof value.monat === "string" ? value.monat : "";
  const targetDays = typeof value.ziel_tage === "number" ? value.ziel_tage : null;
  const orderIds = Array.isArray(value.auftraege) && value.auftraege.every((orderId) => typeof orderId === "string")
    ? value.auftraege as string[]
    : [];
  if (!customerId || !month || targetDays === null || orderIds.length === 0) throw new Error("FLOW_COLLECTION_FIXTURE_INVALID");
  await upsertFixture("invoice_collections", {
    id: value.id,
    tenant_id: TENANT,
    customer_id: customerId,
    monat: month,
    ziel_tage: targetDays,
    status: value.status ?? "offen",
    invoice_id: value.invoice_id ?? null,
    version: typeof value.version === "number" ? value.version : 1,
    created_by: fixtureLoginId,
  });
  for (const orderId of orderIds) {
    await sql`
      INSERT INTO public.invoice_collection_orders (collection_id, tenant_id, order_id)
      VALUES (${String(value.id)}::uuid, ${TENANT}, ${orderId})
      ON CONFLICT (order_id) DO UPDATE SET collection_id = EXCLUDED.collection_id
    `;
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
    ...file,tenant_id:TENANT,client_key:file.client_key??file.id,art:file.art??'anhang',mime:file.mime??content.mime,
    bytes:content.bytes.length,sha256,speicherpfad:storagePath,aufgenommen_am:new Date().toISOString(),
    aufgenommen_von:fixtureLoginId,reihenfolge:sequence,lesbar:file.lesbar??true,
    geoeffnet:file.geoeffnet??false,erkennung_status:file.erkennung_status??'fertig',
  });
  await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
    SELECT ${TENANT},${String(file.item_id)}::uuid,'original_gespeichert',${String(file.id)}::uuid,${fixtureLoginId},${sql.json({fileId:String(file.id),sha256,bytes:content.bytes.length})}
    WHERE NOT EXISTS(SELECT 1 FROM public.intake_event WHERE tenant_id=${TENANT} AND item_id=${String(file.item_id)}::uuid AND art='original_gespeichert' AND befehl_id=${String(file.id)}::uuid)`;
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
    if (fixture.tabelle === "customer_agreements") {
      await seedAgreementFixture(fixture);
      continue;
    }
    if (fixture.tabelle === "invoice_collections") {
      await seedInvoiceCollectionFixture(fixture);
      continue;
    }
    const value = resolvedFixture(fixture);
    if(fixture.tabelle==='intake_file'){
      await seedOriginalFixture(value,1);
      continue;
    }
    if(fixture.tabelle==='supplier_invoice'){
      // The model supplies a nested source/original for an already recorded invoice.
      // Materialize that relationship in the real Replay DB and Storage, without changing its assertions.
      if(!value.eingang||typeof value.eingang!=='object'||Array.isArray(value.eingang))throw Error('FLOW_INVOICE_SOURCE_NOT_SUPPLIED');
      const digest=createHash('sha256').update('synthetic-replay-invoice-source:'+value.id).digest();digest[6]=(digest[6]&15)|64;digest[8]=(digest[8]&63)|128;
      const hex=digest.subarray(0,16).toString('hex'),itemId=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
      const nested=value.eingang as Record<string,unknown>;
      await seedIntakeFixture({id:itemId,tabelle:'intake_item',...nested,kunde_id:value.lieferant_id,zuordnung:'hand',vorgang_art:'rechnung',vorgang_id:value.id},fixtureIndex+1000);
      const files=await sql<{id:string}[]>`SELECT id::text FROM public.intake_file WHERE tenant_id=${TENANT} AND item_id=${itemId}::uuid ORDER BY reihenfolge,id`;
      if(!files.length)throw Error('FLOW_INVOICE_ORIGINAL_NOT_SUPPLIED');
      await upsertFixture('supplier_invoice',{...value,tenant_id:TENANT,nummer_intern:'ER-'+new Date().getUTCFullYear()+'-'+String(8000+fixtureIndex),item_id:itemId,file_id:files[0]!.id,erfasst_von:fixtureLoginId,version:1});
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
    if(fixture.tabelle==='task'){
      await upsertFixture('tasks',{client_key:value.id,erstellt_von:generatedFlowRuntime.logins.login_meister.id,version:1,...value,id:value.id,tenant_id:TENANT});
      if(value.art==='rechnung'&&value.bezug_typ==='eingangsrechnung')await sql`UPDATE public.supplier_invoice SET aufgabe_id=${value.id}::uuid WHERE tenant_id=${TENANT} AND id=${String(value.bezug_id)}::uuid`;
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
  if (format === "TT.MM.JJJJ") return `${short}${date.getUTCFullYear()}`;
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
  result = result.replace(/\{arbeitstag:([+-]\d+)(?:\|(TT\.MM\.JJJJ|TT\.MM\.|WT TT\.MM\.))?\}/g, (_, raw, format) => {
    const date = addWorkdays(today(), Number(raw));
    return formattedDate(date, format);
  });
  result = result.replace(/\{heute:([+-]\d+)(?:\|(TT\.MM\.JJJJ|TT\.MM\.|WT TT\.MM\.))?\}/g, (_, raw, format) => {
    const date = today();
    date.setUTCDate(date.getUTCDate() + Number(raw));
    return formattedDate(date, format);
  });
  result = result.replace(/\{jetzt:([+-]\d+)min\}/g, (_, raw) => {
    return new Date(Date.now() + Number(raw) * 60_000).toISOString();
  });
  result = result.replace(/\{monat:([+-]\d+)\}/g, (_, raw) => {
    const date = today();
    date.setUTCMonth(date.getUTCMonth() + Number(raw), 1);
    return dateIso(date);
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

function interruptedActionId(controlId: string | undefined): string | undefined {
  const actions: Record<string, { exportedName: string; filename: string }> = {
    "nachrichten.vorschlag-ja": { exportedName: "assignIntakeCustomerAction", filename: "src/app/actions/eingang.actions.ts" },
    "aufgabe.speichern": { exportedName: "saveIntakeTaskAction", filename: "src/app/actions/eingang.actions.ts" },
    "kundebearbeiten.speichern": { exportedName: "updateCustomerAction", filename: "src/app/actions/customers.actions.ts" },
  };
  const target = controlId ? actions[controlId] : undefined;
  if (!target) return undefined;
  const manifest = JSON.parse(readFileSync(path.join(process.cwd(), ".next/server/server-reference-manifest.json"), "utf8")) as {
    node: Record<string, { workers: Record<string, { exportedName?: string; filename?: string }> }>;
  };
  const matches = Object.entries(manifest.node).filter(([, action]) => Object.values(action.workers).some(
    (worker) => worker.exportedName === target.exportedName && worker.filename === target.filename,
  ));
  if (matches.length !== 1) throw new Error(`FLOW_WRITE_ACTION_ID_AMBIGUOUS:${controlId}:${matches.length}`);
  return matches[0][0];
}

async function interruptNextServerAction(page: Page, state: FlowRunState, controlId?: string) {
  const targetAction = interruptedActionId(controlId);
  state.interruptionObserved=page.waitForEvent("requestfailed",{
    predicate:request=>request.method()==="POST"&&Boolean(request.headers()["next-action"])&&(!targetAction||request.headers()["next-action"]===targetAction),timeout:5_000,
  }).then(()=>true,()=>false);
  const matcher="**/*";
  let interrupted=false;
  const handler=async(route:import("@playwright/test").Route)=>{
    const request=route.request();
    if(!interrupted&&request.method()==="POST"&&request.headers()["next-action"]&&(!targetAction||request.headers()["next-action"]===targetAction)){
      interrupted=true;
      await route.abort("failed");
      await page.unroute(matcher,handler);
      return;
    }
    await route.continue();
  };
  await page.route(matcher,handler);
}

async function interruptNextLoad(page: Page) {
  const matcher = "**/*";
  let handled = false;
  const handler = async (route: import("@playwright/test").Route) => {
    const request = route.request();
    // App Router also transports read Server Actions with POST + Next-Action.
    // Keep App Router navigation/asset requests online; fail the actual data read.
    const isLoad = request.method() === "POST" && Boolean(request.headers()["next-action"])
      || ["fetch", "xhr"].includes(request.resourceType()) && request.method() === "GET" && !request.headers().rsc;
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
  "original.am-original-geprueft","original.erneut-lesen","nachrichten.vorschlag-ja","nachrichten.erneut",
  "nachrichten.erledigt","nachrichten.nur-info","nachrichten.wieder-speichern",
  "rechnungein.offen","rechnungein.unklar-speichern","rechnungein.bezahlt-speichern","rechnungein.als-bezahlt","rechnungein.klaerung-speichern","rechnungein.doppelt-ablegen"]);

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
  if(id.startsWith('nachrichten.'))await expect.poll(async()=>page.locator('[data-spec-id="nachrichten"]').getAttribute('aria-busy'),{timeout:15_000}).not.toBe('true');
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

function readFlightActionResult(text: string): { code?: unknown; message?: unknown } {
  for (const line of text.split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    try {
      const value = JSON.parse(line.slice(separator + 1)) as unknown;
      if (value && typeof value === "object" && "code" in value) {
        const record = value as { code?: unknown; message?: unknown };
        return { code: record.code, message: record.message };
      }
    } catch {
      // React Flight carries non-JSON instruction lines beside the action value.
    }
  }
  throw new Error("FLOW_COMMAND_RESPONSE_UNREADABLE");
}

async function executeServerCommand(page: Page, step: FlowStep, state: FlowRunState) {
  const command = resolveString(String(step.wert ?? ""), state);
  const data = resolveValue(step.daten ?? {}, state);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("FLOW_COMMAND_DATA_INVALID");
  if (command !== "absprache.speichern") throw new Error(`FLOW_COMMAND_UNSUPPORTED:${command}`);
  const inputData = data as Record<string, unknown>;
  const customerId = typeof inputData.customer_id === "string" ? inputData.customer_id : "";
  const type = typeof inputData.typ === "string" ? inputData.typ : "";
  const reason = typeof inputData.grund === "string" ? inputData.grund : "";
  const targetDays = typeof inputData.ziel_tage === "number" ? inputData.ziel_tage : null;
  const validUntil = typeof inputData.gueltig_bis === "string" ? inputData.gueltig_bis : null;
  const orderId = typeof inputData.order_id === "string" ? inputData.order_id : null;
  if (!customerId || !["ausgabe_ohne_zahlung", "sammelrechnung", "zahlungsziel"].includes(type) || !reason) {
    throw new Error("FLOW_COMMAND_INPUT_INVALID");
  }
  const input = {
    clientKey: randomUUID(),
    customerId,
    orderId,
    type: type as "ausgabe_ohne_zahlung" | "sammelrechnung" | "zahlungsziel",
    targetDays,
    validUntil,
    reason,
    version: null,
  };
  const manifest = JSON.parse(readFileSync(path.join(process.cwd(), ".next/server/server-reference-manifest.json"), "utf8")) as {
    node: Record<string, { workers: Record<string, { exportedName?: string; filename?: string }> }>;
  };
  const actions = Object.entries(manifest.node).filter(([, action]) => Object.values(action.workers).some(
    worker => worker.exportedName === "saveCustomerAgreementAction" && worker.filename === "src/app/actions/customers.actions.ts",
  ));
  if (actions.length !== 1) throw new Error("FLOW_COMMAND_ACTION_AMBIGUOUS");
  const response = await page.evaluate(async ({ actionId, input }) => {
    const reply = await fetch("/", {
      method: "POST",
      headers: { "Next-Action": actionId, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
      body: JSON.stringify([input]),
    });
    return { status: reply.status, text: await reply.text() };
  }, { actionId: actions[0]![0], input });
  if (response.status !== 200) throw new Error(`FLOW_COMMAND_HTTP_${response.status}`);
  state.serverResult = readFlightActionResult(response.text);
}

async function executeStep(page: Page, step: FlowStep, state: FlowRunState) {
  if (!step.aktion && step.erwartung) {
    await assertExpectation(page, step, state);
    return;
  }
  if (step.aktion === "oeffne") {
    await openTarget(page, String(step.wert), resolveValue(step.arg, state),state);
    return;
  }
  if (step.aktion === "erwarten") {
    await captureDbResults(step.db??[],state);
    await assertExpectations(page, step.anzeige ?? [], state);
    await assertDb(step.db ?? [], state);
    assertServer(step.server, state);
    return;
  }
  if (step.aktion === "netz_unterbrechen") {
    state.restoreOnlineAfterWrite = true;
    return;
  }
  if (step.aktion === "netz_laden") {
    await interruptNextLoad(page);
    return;
  }
  if (step.aktion === "db_setzen") {
    await setReplayDbRow(step, state);
    return;
  }
  if (step.aktion === "befehl") {
    await executeServerCommand(page, step, state);
    return;
  }
  const locator = step.id ? dataSpec(page, step.id, step.nr) : null;
  const value = resolveValue(step.wert, state);
  if(locator&&step.aktion&&["datei","klicken","doppelklicken","tippen","waehlen","verlassen","taste"].includes(step.aktion))await revealForInteraction(locator);
  // Arm only after the actual control has loaded; unrelated RSC/asset reads stay online.
  if(state.restoreOnlineAfterWrite&&["datei","klicken","doppelklicken"].includes(step.aktion??""))await interruptNextServerAction(page,state,step.id);
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
        state.restoreOnlineAfterWrite=false;
      }
      break;
    }
    case "klicken":
      if (!locator) throw new Error("FLOW_STEP_ID_REQUIRED:klicken");
      await locator.click({ timeout: 5_000 });
      if (step.id && settledServerActions.has(step.id)) await waitForServerAction(page, step.id);
      if (state.restoreOnlineAfterWrite) {
        expect(await state.interruptionObserved,"write really encountered the requested server interruption").toBe(true);
        state.restoreOnlineAfterWrite = false;
      }
      break;
    case "doppelklicken":
      if (!locator) throw new Error("FLOW_STEP_ID_REQUIRED:doppelklicken");
      await locator.dblclick({ timeout: 5_000 });
      if (step.id && settledServerActions.has(step.id)) await waitForServerAction(page, step.id);
      if (state.restoreOnlineAfterWrite) {
        expect(await state.interruptionObserved,"write really encountered the requested server interruption").toBe(true);
        state.restoreOnlineAfterWrite = false;
      }
      break;
    case "tippen":
      if (!locator) throw new Error("FLOW_STEP_ID_REQUIRED:tippen");
      {
        const target = await control(locator);
        const inputType = await target.getAttribute("type");
        const text = String(value ?? "");
        // The BAUPLAN models German calendar text; Playwright requires ISO for
        // a native date input. This normalizes only the browser transport.
        const date = inputType === "date" ? /^(\d{2})\.(\d{2})\.(\d{4})$/u.exec(text) : null;
        await target.fill(date ? `${date[3]}-${date[2]}-${date[1]}` : text, { timeout: 5_000 });
      }
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

async function openTarget(page: Page, target: string, arg: unknown, state?:FlowRunState) {
  if (target === "kundebearbeiten") {
    const [customerId, fragment] = String(arg ?? "").split("#", 2);
    if (!customerId) throw new Error("FLOW_OPEN_CUSTOMER_REQUIRED");
    if (fragment && !["fehlend", "uebernahme", "bearbeiten"].includes(fragment)) throw new Error(`FLOW_CUSTOMER_MODE_UNSUPPORTED:${fragment}`);
  }
  // The UI knows its source channel. Carry the same real fixture metadata; no model/assertion changes.
  const sourceId=typeof arg==='string'?arg.split('#',1)[0]:null;
  const source=sourceId?([...(state?.rows.values()??[])].find(row=>row.id===sourceId)??Object.values(generatedFixtures).find(row=>row.id===sourceId)):undefined;
  const sourceChannel=typeof source?.kanal==='string'?source.kanal:undefined;
  // „rauspruefen“ is the goods-out state of the one canonical order card,
  // and „absprache“ is its existing customer-card dialog. Neither is a
  // second route, so open the one canonical surface and its real entry point.
  const ziel = target === "rauspruefen" ? "auftrag" : target === "absprache" ? "kunde" : target;
  await page.evaluate(({ ziel, argument,sourceChannel }) => {
    window.dispatchEvent(new CustomEvent("kreile:oeffne", { detail: { ziel, arg: argument,sourceChannel } }));
  }, { ziel, argument: arg ?? null,sourceChannel });
  if (target === "rauspruefen") {
    const card = page.getByRole("dialog", { name: /^Auftragskarte / });
    await card.getByRole("button", { name: "Ware raus", exact: true }).last().click({ timeout: 15_000 });
  }
  if (target === "absprache") {
    const entry = dataSpec(page, "kunde.absprache");
    await revealForInteraction(entry);
    await entry.click({ timeout: 15_000 });
  }
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
        const option = await target.evaluate((element) => element.tagName.toLowerCase()) === "button"
          ? target
          : locator.getByRole("button", { name: label, exact: false });
        await expect(option).toBeDisabled();
        const reason = locator.getByText(String(value), { exact: false });
        await expect(reason).toBeVisible();
      }
      break;
    }
    case "aktiv":
    case "aktiviert": await expect(await control(locator)).toBeEnabled(); break;
    case "fokus": {
      const target = await control(locator);
      const active = await target.evaluate((element) => {
        const current = element.ownerDocument.activeElement;
        if (!(current instanceof HTMLElement)) return String(current);
        return `${current.tagName.toLowerCase()}[data-spec-id=${current.dataset.specId ?? ""}]`;
      });
      await expect(target, `active element before focus assertion: ${active}`).toBeFocused();
      break;
    }
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
  const identity = storageColumn(table, "id");
  const rows = await sql.unsafe<{ id: string }[]>(`SELECT "${identity}"::text AS id FROM ${qualifiedStorageTable(actual)} WHERE tenant_id = $1`, [TENANT]);
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

/** Test-model concurrency step; executed only against the locked loopback Replay DB. */
async function setReplayDbRow(step: FlowStep, state: FlowRunState) {
  if (!step.tabelle || !step.wo || !step.werte) throw new Error("FLOW_DB_SET_CONTRACT_INVALID");
  const table = step.tabelle;
  const where = resolveValue(step.wo, state) as Record<string, unknown>;
  const values = resolveValue(step.werte, state) as Record<string, unknown>;
  if (!where || !values || Object.keys(values).length === 0) throw new Error("FLOW_DB_SET_VALUES_INVALID");
  const actual = storageMapping(table).table;
  const contractValues = { ...values };
  // The model names the concurrent state change, not the bookkeeping columns
  // required by the table's immutable revocation contract. Complete those
  // companions only for this Replay fixture mutation so it remains a valid
  // state that production readers could actually observe.
  if (table === "customer_agreements" && contractValues.widerrufen_am !== undefined && contractValues.widerrufen_am !== null) {
    contractValues.widerrufen_von ??= state.loginId;
    contractValues.widerruf_grund ??= "SYNTHETISCH: Replay-Widerruf";
  }
  const columns = Object.keys(contractValues).map((field) => storageColumn(table, field));
  const patch = Object.fromEntries(Object.entries(contractValues).map(([field, value]) => [storageColumn(table, field), value]));
  // postgres.js serializes a JavaScript object as JSON. Passing a pre-stringified
  // value would turn it into a JSON scalar, which `jsonb_populate_record` rightly
  // rejects. This is test-transport only; the model's row contract stays intact.
  const params: unknown[] = [patch, TENANT];
  const clauses = ["record.tenant_id = $2"];
  for (const [field, value] of Object.entries(where)) {
    params.push(storageColumn(table, field), JSON.stringify(value));
    clauses.push(`(to_jsonb(record) -> $${params.length - 1}::text) IS NOT DISTINCT FROM $${params.length}::text::jsonb`);
  }
  const quotedColumns = columns.map((column) => `"${column}"`);
  const tableName = qualifiedStorageTable(actual);
  const identity = storageColumn(table, "id");
  const rows = await sql.unsafe<{ id: string }[]>(`
    WITH patch AS (
      SELECT * FROM jsonb_populate_record(NULL::${tableName}, $1::jsonb)
    )
    UPDATE ${tableName} AS record
    SET ${quotedColumns.map((column) => `${column} = patch.${column}`).join(", ")}
    FROM patch
    WHERE ${clauses.join(" AND ")}
    RETURNING record."${identity}"::text AS id
  `, params as never[]);
  expect(rows, `one local replay ${table} row for db_setzen`).toHaveLength(1);
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
    // A case can create one agreement while independently asserting that an
    // existing agreement was changed in place. The latter is not a claim that
    // the table total stays zero; assert it through its explicit `wo` row.
    if (expectation.neu === 0 && expectations.some((other) => other.tabelle === expectation.tabelle && (other.neu ?? 0) > 0)) continue;
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
  const identity = storageColumn(expectation.tabelle, "id");
  const referenceId = reference?.[identity];
  const row = targetRow ?? (where ? await readStorageRow(expectation.tabelle, where)
    : reference && referenceId !== undefined ? await readStorageRow(expectation.tabelle, { id: referenceId }) : undefined);
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
      if (expectation.neu === 0 && expectations.some((other) => other.tabelle === expectation.tabelle && (other.neu ?? 0) > 0)) {
        if (Object.keys(expectation.werte ?? {}).length) await assertDbValues(expectation, state);
        continue;
      }
      const before = state.before.get(expectation.tabelle);
      if (before === undefined) throw new Error(`FLOW_DB_BASELINE_MISSING:${expectation.tabelle}`);
      expect((await tableCount(expectation.tabelle)) - before).toBe(expectation.neu);
    }
    if (Object.keys(expectation.werte ?? {}).length) await assertDbValues(expectation, state);
  }
}

function assertServer(expectation: { fehler?: string } | undefined, state: FlowRunState) {
  if (!expectation?.fehler) return;
  expect(state.serverResult, "server command result").toMatchObject({ code: expectation.fehler });
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
    loginName: flowCase.gegeben.login,
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
    await openTarget(page, route.seite, resolveValue(route.arg, state),state);
  } else {
    for (const step of route.weg ?? []) await executeStep(page, step, state);
  }
  for (const step of flowCase.wenn ?? []) await executeStep(page, step, state);
  await captureDbResults(dbExpectations, state);
  await assertExpectations(page, flowCase.dann?.anzeige ?? [], state);
  await assertDb(dbExpectations, state);
  assertServer(flowCase.dann?.server, state);
}

function testTimeoutGuard(flowCase: FlowCase) {
  if (!flowCase.id || !flowCase.titel || !flowCase.gegeben?.login) throw new Error("FLOW_CASE_CONTRACT_INVALID");
}
