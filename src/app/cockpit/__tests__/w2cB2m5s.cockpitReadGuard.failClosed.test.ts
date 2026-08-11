import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const denial = "NOT_AVAILABLE: Cockpit-Datenzugriff erfordert kanonische Admin- oder Entwickler-Autorisierung.";
const readNames = [
  "getCockpitKpis", "getTopKunden", "getInaktiveKunden", "getEngpassDaten",
  "getAgingDaten", "getAuftragDbRanking", "getWhatIfKontext", "getEngpassDetails",
  "getAuftragDbDetails", "getForecastDaten", "getKundenDetails", "getAgingRechnungen",
  "getAktiveWarnungen", "getAktiverJahresplan",
] as const;

const ports = vi.hoisted(() => {
  const from = vi.fn();
  const query = {
    select: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(), neq: vi.fn(),
    eq: vi.fn(), gte: vi.fn(), lt: vi.fn(), or: vi.fn(), in: vi.fn(), not: vi.fn(),
    is: vi.fn(), single: vi.fn(), then: vi.fn(),
  };
  for (const method of Object.values(query)) method.mockReturnValue(query);
  query.then.mockImplementation((resolve: (value: { data: never[]; error: null }) => unknown) =>
    resolve({ data: [], error: null }),
  );
  query.single.mockImplementation(() => ({
    then: (resolve: (value: { data: null; error: null }) => unknown) => resolve({ data: null, error: null }),
  }));
  from.mockReturnValue(query);
  return {
    resolveAuthorization: vi.fn(), createClient: vi.fn(async () => ({ from })),
    createAuthorizedDataClient: vi.fn(async () => ({ from })), from, query,
  };
});

vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: ports.resolveAuthorization }));
vi.mock("@/lib/server/appSession", () => ({ APP_TENANT_ID: "galvanik-kreile" }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: ports.createClient,
  createAuthorizedDataClient: ports.createAuthorizedDataClient,
}));

function allowed(role: "admin" | "developer") {
  return { ok: true, data: { tenantId: "galvanik-kreile", role } };
}

function source() {
  return readFileSync(resolve(process.cwd(), "src/app/cockpit/actions.ts"), "utf8");
}

function exportedFunctionBody(text: string, name: string) {
  const start = text.indexOf(`export async function ${name}(`);
  expect(start, `${name} must be exported`).toBeGreaterThanOrEqual(0);
  let signatureDepth = 0;
  let signatureEnd = -1;
  for (let index = text.indexOf("(", start); index < text.length; index += 1) {
    if (text[index] === "(") signatureDepth += 1;
    if (text[index] === ")" && --signatureDepth === 0) {
      signatureEnd = index;
      break;
    }
  }
  const open = text.indexOf(" {\n", signatureEnd) + 1;
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}" && --depth === 0) return text.slice(start, index + 1);
  }
  throw new Error(`${name} body is not balanced`);
}

function invokeAll(actions: typeof import("../actions")) {
  return [
    actions.getCockpitKpis(), actions.getTopKunden(2), actions.getInaktiveKunden(),
    actions.getEngpassDaten(), actions.getAgingDaten(), actions.getAuftragDbRanking(2),
    actions.getWhatIfKontext(), actions.getEngpassDetails("E1"), actions.getAuftragDbDetails("order-1"),
    actions.getForecastDaten(), actions.getKundenDetails("customer-1"), actions.getAgingRechnungen(">90"),
    actions.getAktiveWarnungen(), actions.getAktiverJahresplan(2026),
  ];
}

function expectNoDataPort() {
  expect(ports.createClient).not.toHaveBeenCalled();
  expect(ports.createAuthorizedDataClient).not.toHaveBeenCalled();
  expect(ports.from).not.toHaveBeenCalled();
  for (const method of Object.values(ports.query)) expect(method).not.toHaveBeenCalled();
}

afterEach(() => vi.clearAllMocks());

describe("W2C-B2M5S Cockpit Read Guard", () => {
  it.each([
    ["no session", { ok: false, error: "NO_SESSION" }],
    ["authorization error", { ok: false, error: "ROLE_MISMATCH" }],
    ["wrong tenant", { ok: true, data: { tenantId: "other-tenant", role: "admin" } }],
    ["operator", { ok: true, data: { tenantId: "galvanik-kreile", role: "operator" } }],
    ["inhaber is not an AppRole", { ok: true, data: { tenantId: "galvanik-kreile", role: "inhaber" } }],
  ])("denies %s before every data, event, realtime, clock, or revalidation port", async (_caseName, result) => {
    ports.resolveAuthorization.mockResolvedValue(result);
    const actions = await import("../actions");

    const settled = await Promise.allSettled(invokeAll(actions));
    expect(settled).toHaveLength(readNames.length);
    for (const outcome of settled) {
      expect(outcome.status).toBe("rejected");
      if (outcome.status === "rejected") expect(outcome.reason).toEqual(new Error(denial));
    }
    expect(ports.resolveAuthorization).toHaveBeenCalledTimes(readNames.length);
    expectNoDataPort();
  });

  it("has an exact, complete read inventory with the guard before every port", () => {
    const text = source();
    const inventory = [...text.matchAll(/^export async function (get\w+)\(/gm)].map((match) => match[1]);
    expect(inventory).toEqual(readNames);

    for (const name of readNames) {
      const body = exportedFunctionBody(text, name);
      const guard = body.indexOf("await requireCockpitRead();");
      expect(guard, `${name} must guard before all execution`).toBeGreaterThan(-1);
      expect(body.slice(body.indexOf(" {\n") + 3).trimStart(), `${name} must call the guard first`).toMatch(/^await requireCockpitRead\(\);/);
      const dataPort = body.search(/\b(createClient|createAuthorizedDataClient)\s*\(/);
      expect(dataPort, `${name} must retain a data port after its guard`).toBeGreaterThan(guard);
    }
  });

  it("allows the canonical admin and developer snapshots and preserves existing read shapes and ports", async () => {
    const actions = await import("../actions");
    ports.resolveAuthorization.mockResolvedValueOnce(allowed("admin"));
    await expect(actions.getEngpassDetails("E1")).resolves.toEqual({ waitingOrders: [] });
    ports.resolveAuthorization.mockResolvedValueOnce(allowed("developer"));
    await expect(actions.getAuftragDbDetails("order-1")).resolves.toBeNull();
    ports.resolveAuthorization.mockResolvedValueOnce(allowed("admin"));
    await expect(actions.getTopKunden(2)).resolves.toEqual([]);
    ports.resolveAuthorization.mockResolvedValueOnce(allowed("developer"));
    await expect(actions.getAktiveWarnungen()).resolves.toEqual([]);

    expect(ports.createClient).toHaveBeenCalledTimes(3);
    expect(ports.createAuthorizedDataClient).toHaveBeenCalledWith("read");
    expect(ports.from).toHaveBeenCalledWith("orders");
    expect(ports.from).toHaveBeenCalledWith("v_auftrag_db");
    expect(ports.from).toHaveBeenCalledWith("v_kunde_clv");
    expect(ports.from).toHaveBeenCalledWith("warning_event");
  });

  it("does not include or alter the four existing writers", () => {
    const text = source();
    for (const name of ["dismissWarnung", "refreshWarnungen", "speichereJahresplan", "savePhoneNote"]) {
      const body = exportedFunctionBody(text, name);
      expect(readNames).not.toContain(name as never);
      expect(body).not.toContain("requireCockpitRead");
      expect(body).toContain("NOT_AVAILABLE:");
    }
  });
});
