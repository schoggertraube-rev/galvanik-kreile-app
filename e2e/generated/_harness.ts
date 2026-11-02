import { expect, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createPinLoginHandle } from "../../src/lib/server/pinLoginHandle";
import { generatedFlowRuntime } from "./_model";

export type FlowExpectation = {
  id?: string;
  nr?: number;
  erwartung?: string;
  wert?: unknown;
  text?: string;
  oben?: string;
  dialoge?: number;
  toast?: string;
};

export type FlowStep = {
  id?: string;
  nr?: number;
  aktion: string;
  wert?: unknown;
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
  rows: Map<string, Record<string, unknown>>;
};

const TENANT = "galvanik-kreile";
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("FLOW_HARNESS_DATABASE_URL_REQUIRED");
if (!/^postgresql?:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/.test(databaseUrl)) {
  throw new Error("FLOW_HARNESS_LOCAL_REPLAY_DATABASE_REQUIRED");
}
const sql = postgres(databaseUrl, { max: 1, prepare: false });

export async function prepareGeneratedSeed() {
  const seed = readFileSync(path.resolve(process.cwd(), "e2e/generated/_seed.sql"), "utf8");
  await sql.unsafe(seed);
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
  const tag = await locator.evaluate((element) => element.tagName.toLowerCase());
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
  await page.waitForTimeout(250);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

function addWorkdays(date: Date, delta: number) {
  const direction = delta < 0 ? -1 : 1;
  let remaining = Math.abs(delta);
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + direction);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date;
}

function dateIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function runtimeValue(name: string, state?: FlowRunState): string | null {
  const row = name === "auftrag" ? state?.rows.get("orders")
    : name === "kunde" ? state?.rows.get("customers")
      : name === "kv" ? state?.rows.get("orders")
        : undefined;
  if (!row) return null;
  const key = name === "auftrag" ? "order_number" : name === "kunde" ? "customer_number" : "order_number";
  return typeof row[key] === "string" ? row[key] : null;
}

function resolveString(value: string, state?: FlowRunState): string {
  let result = value;
  result = result.replace(/\{neu:([a-z_]+)\}/g, (match, table) => {
    const id = state?.rows.get(table)?.id;
    if (typeof id !== "string") throw new Error(`FLOW_RUNTIME_REFERENCE_UNRESOLVED:${match}`);
    return id;
  });
  result = result.replace(/\{(auftrag|kunde|kv)\}/g, (match, name) => {
    const resolved = runtimeValue(name, state);
    if (!resolved) return match;
    return resolved;
  });
  result = result.replace(/\{arbeitstag:([+-]\d+)(\|TT\.MM\.)?\}/g, (_, raw, short) => {
    const date = addWorkdays(new Date(), Number(raw));
    return short ? `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.` : dateIso(date);
  });
  result = result.replace(/\{heute:([+-]\d+)\}/g, (_, raw) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + Number(raw));
    return dateIso(date);
  });
  result = result.replace(/\{([a-z_]+)(?:\.([a-z_]+))?\}/g, (match, fixtureName, field) => {
    const fixture = generatedFlowRuntime.datenlagen[fixtureName as keyof typeof generatedFlowRuntime.datenlagen];
    if (!fixture) return match;
    const resolved = field ? fixture[field as keyof typeof fixture] : fixture.id;
    return resolved === null || resolved === undefined ? "" : String(resolved);
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
  else await locator.locator("button").filter({ hasText: label }).first().click({ timeout: 5_000 });
}

async function interruptNextServerAction(page: Page) {
  await page.context().setOffline(true);
  void page.locator('[data-spec-id="eingang.zustand.fehler"]').waitFor({ state: "visible", timeout: 10_000 })
    .catch(() => undefined)
    .then(() => page.context().setOffline(false).catch(() => undefined));
}

async function executeStep(page: Page, step: FlowStep, state: FlowRunState) {
  if (step.aktion === "erwarten") {
    await assertExpectations(page, step.anzeige ?? [], state);
    await assertDb(step.db ?? [], state);
    return;
  }
  if (step.aktion === "netz_unterbrechen") {
    await interruptNextServerAction(page);
    return;
  }
  const locator = step.id ? dataSpec(page, step.id, step.nr) : null;
  const value = resolveValue(step.wert, state);
  switch (step.aktion) {
    case "klicken":
      if (!locator) throw new Error("FLOW_STEP_ID_REQUIRED:klicken");
      await locator.click({ timeout: 5_000 });
      break;
    case "doppelklicken":
      if (!locator) throw new Error("FLOW_STEP_ID_REQUIRED:doppelklicken");
      await locator.dblclick({ timeout: 5_000 });
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

async function assertExpectation(page: Page, expectation: FlowExpectation, state: FlowRunState) {
  if (typeof expectation.dialoge === "number") {
    await expect(page.locator('[role="dialog"]:visible')).toHaveCount(expectation.dialoge);
    return;
  }
  if (expectation.oben) {
    const dialog = await topDialog(page);
    await expect(dialog.locator(`[data-spec-id="${expectation.oben}"]`)).toBeVisible();
    return;
  }
  if (expectation.toast) {
    await expect(page.getByRole("status").filter({ hasText: resolveString(expectation.toast, state) })).toBeVisible();
    return;
  }
  const value = resolveValue(expectation.wert ?? expectation.text, state);
  if (!expectation.id) {
    const dialog = await topDialog(page);
    if (expectation.erwartung === "toast") await expect(page.getByRole("status").last()).toBeVisible();
    else if (expectation.erwartung === "nicht_sichtbar") await expect(dialog.getByText(String(value), { exact: false })).toHaveCount(0);
    else if (expectation.erwartung === "text") await expect(dialog.getByText(String(value), { exact: true })).toBeVisible();
    else await expect(dialog.getByText(String(value), { exact: false })).toBeVisible();
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
      if (tag === "select") await expect(target.locator("option:checked")).toHaveText(String(value));
      else await expect(locator.locator("button").filter({ hasText: String(value) }).first()).toHaveAttribute("aria-pressed", "true");
      break;
    }
    case "optionen": {
      const target = await control(locator);
      const labels = Array.isArray(value) ? value.map(String) : [];
      const tag = await target.evaluate((element) => element.tagName.toLowerCase());
      const actual = tag === "select" ? await target.locator("option").allTextContents() : await locator.getByRole("button").allTextContents();
      expect(actual.map((entry) => entry.trim()).filter(Boolean)).toEqual(labels);
      break;
    }
    case "gesperrt": {
      const target = await control(locator);
      const option = target.locator("option:disabled").filter({ hasText: String(value) });
      await expect(option).toHaveCount(1);
      await expect(option).toHaveAttribute("disabled", "");
      break;
    }
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

async function tableCount(table: string) {
  if (!new Set(["orders", "items", "intake_item", "customers"]).has(table)) throw new Error(`FLOW_DB_TABLE_UNSUPPORTED:${table}`);
  const rows = await sql.unsafe<{ count: string }[]>(`SELECT count(*)::text AS count FROM public.${table} WHERE tenant_id = $1`, [TENANT]);
  return Number(rows[0]?.count ?? 0);
}

const newestRowQuery: Record<string, string> = {
  orders: `SELECT id, order_number, customer_id AS kunde,
    CASE WHEN coalesce(is_quote, false) THEN 'kv' ELSE 'auftrag' END AS art,
    promised_due_date::date::text AS liefertermin, intake_term_status AS terminstatus,
    CASE handover_mode WHEN 'pickup' THEN 'abholung' WHEN 'shipping' THEN 'versand' ELSE handover_mode END AS uebergabe,
    payment_mode AS zahlungsmodus, intake_source AS eingangsart,
    EXISTS (SELECT 1 FROM public.events event WHERE event.tenant_id = orders.tenant_id AND event.order_id = orders.id AND event.event_type = 'ORDER_INTAKE_CREATED_V1') AS geprueft
    FROM public.orders WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
  items: `SELECT id, order_id AS auftrag, name AS bezeichnung, quantity AS menge,
    CASE unit WHEN 'Stück' THEN 'stueck' WHEN 'dm²' THEN 'dm2' ELSE lower(coalesce(unit, '')) END AS einheit,
    surface_requested AS oberflaeche, execution_requested AS ausfuehrung
    FROM public.items WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
  intake_item: `SELECT id, kanal, richtung, kunde_id, vorgang_art, vorgang_id, einsatz, text
    FROM public.intake_item WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
  customers: "SELECT id, customer_number FROM public.customers WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1",
};

async function captureNewestRow(table: string) {
  const query = newestRowQuery[table];
  if (!query) throw new Error(`FLOW_DB_VALUE_TABLE_UNSUPPORTED:${table}`);
  const rows = await sql.unsafe<Record<string, unknown>[]>(query, [TENANT]);
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

async function captureDbResults(expectations: FlowDbExpectation[], state: FlowRunState) {
  for (const expectation of expectations) {
    if (typeof expectation.neu !== "number") continue;
    const after = await tableCount(expectation.tabelle);
    expect(after - (state.before.get(expectation.tabelle) ?? after)).toBe(expectation.neu);
    if (expectation.neu > 0) {
      if (expectation.neu !== 1 && expectation.werte && Object.keys(expectation.werte).length > 0) {
        throw new Error(`FLOW_DB_VALUE_NEW_ROW_AMBIGUOUS:${expectation.tabelle}`);
      }
      state.rows.set(expectation.tabelle, await captureNewestRow(expectation.tabelle));
    }
  }
}

async function assertDb(expectations: FlowDbExpectation[], state: FlowRunState) {
  for (const expectation of expectations) {
    if (typeof expectation.neu === "number") {
      const after = await tableCount(expectation.tabelle);
      expect(after - (state.before.get(expectation.tabelle) ?? after)).toBe(expectation.neu);
    }
    if (expectation.werte && Object.keys(expectation.werte).length > 0) await assertDbValues(expectation, state);
  }
}

const customerColumns: Record<string, string> = {
  zahlungsbedingung: "payment_preference",
  handover_preference: "shipping_preference",
  customer_type: "type",
  company_name: "company_name",
  address_status: "address_status",
  name: "name",
  salutation: "salutation",
  first_name: "first_name",
  last_name: "last_name",
  contact_role: "contact_role",
  email: "email",
  street: "street",
  house_number: "house_number",
  zip_code: "zip_code",
  city: "city",
  country: "country",
  notiz: "internal_notes",
  billing_email: "billing_email",
};

async function assertCustomerDbValues(expectation: FlowDbExpectation, state: FlowRunState) {
  const where = resolveValue(expectation.wo ?? {}, state) as Record<string, unknown>;
  const whereEntries = Object.entries(where);
  if (whereEntries.some(([key]) => key !== "id")) throw new Error(`FLOW_DB_WHERE_UNSUPPORTED:${whereEntries.map(([key]) => key).join(",")}`);
  const values = Object.entries(resolveValue(expectation.werte ?? {}, state) as Record<string, unknown>);
  const columns = values.map(([key]) => customerColumns[key] ?? "");
  if (columns.some((column) => !column)) throw new Error(`FLOW_DB_COLUMNS_UNSUPPORTED:${values.map(([key]) => key).join(",")}`);
  const params: string[] = [TENANT];
  let whereSql = "tenant_id = $1";
  if (where.id !== undefined) {
    params.push(String(where.id));
    whereSql += ` AND id = $${params.length}`;
  }
  const rows = await sql.unsafe<Record<string, unknown>[]>(
    `SELECT ${columns.join(", ")} FROM public.customers WHERE ${whereSql} ORDER BY created_at DESC LIMIT 1`,
    params,
  );
  expect(rows).toHaveLength(1);
  for (let index = 0; index < values.length; index += 1) {
    expect(rows[0]?.[columns[index]!]).toEqual(values[index]?.[1]);
  }
}

async function assertDbValues(expectation: FlowDbExpectation, state: FlowRunState) {
  if (expectation.tabelle === "customers" && expectation.wo) {
    await assertCustomerDbValues(expectation, state);
    return;
  }
  const row = state.rows.get(expectation.tabelle);
  if (!row) throw new Error(`FLOW_DB_NEW_ROW_REQUIRED:${expectation.tabelle}`);
  const values = Object.entries(resolveValue(expectation.werte ?? {}, state) as Record<string, unknown>);
  for (const [key, value] of values) {
    if (!Object.hasOwn(row, key)) throw new Error(`FLOW_DB_COLUMNS_UNSUPPORTED:${expectation.tabelle}:${key}`);
    expect(row[key]).toEqual(value);
  }
}

export async function runGeneratedFlowCase(page: Page, flowCase: FlowCase) {
  testTimeoutGuard(flowCase);
  const dbExpectations = flowCase.dann?.db ?? [];
  const state: FlowRunState = { before: new Map<string, number>(), rows: new Map<string, Record<string, unknown>>() };
  const stepExpectations = [
    ...(Array.isArray(flowCase.gegeben.aufruf.weg) ? flowCase.gegeben.aufruf.weg : []),
    ...(flowCase.wenn ?? []),
  ].filter((step) => step.aktion === "erwarten").flatMap((step) => step.db ?? []);
  for (const expectation of [...dbExpectations, ...stepExpectations]) {
    if (typeof expectation.neu === "number" && !state.before.has(expectation.tabelle)) {
      state.before.set(expectation.tabelle, await tableCount(expectation.tabelle));
    }
  }
  await login(page, flowCase.gegeben.login);
  const route = flowCase.gegeben.aufruf;
  if (route.weg === "oeffne") {
    if (route.seite !== "kundebearbeiten") throw new Error(`FLOW_OPEN_TARGET_UNSUPPORTED:${route.seite}`);
    const [customerId, fragment] = String(resolveValue(route.arg ?? "", state)).split("#", 2);
    if (!customerId) throw new Error("FLOW_OPEN_CUSTOMER_REQUIRED");
    await page.goto(`/customers/${encodeURIComponent(customerId)}${fragment ? `#${encodeURIComponent(fragment)}` : ""}`);
    await dataSpec(page, "kundebearbeiten.oeffnen").click({ timeout: 5_000 });
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
