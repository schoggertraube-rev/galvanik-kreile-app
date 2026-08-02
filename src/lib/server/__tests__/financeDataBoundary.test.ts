import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => {
  const results = new Map<unknown, unknown[]>();
  const queriedTables: unknown[] = [];
  const selectedFieldSets: string[][] = [];
  const eqCalls: Array<[unknown, unknown]> = [];
  const supabaseResults = new Map<string, unknown>();
  const supabaseTables: string[] = [];

  const makeQuery = (table: unknown) => {
    const tableName =
      typeof table === "object" &&
      table !== null &&
      "__table" in table &&
      typeof table.__table === "string"
        ? table.__table
        : table;
    queriedTables.push(tableName);
    const query = {
      leftJoin: vi.fn(() => query),
      where: vi.fn(() => query),
      orderBy: vi.fn(() => Promise.resolve(results.get(tableName) ?? [])),
      limit: vi.fn(() => Promise.resolve(results.get(tableName) ?? [])),
      then: (
        onFulfilled: (value: unknown[]) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(results.get(tableName) ?? []).then(onFulfilled, onRejected),
    };
    return query;
  };

  return {
    results,
    queriedTables,
    selectedFieldSets,
    eqCalls,
    supabaseResults,
    supabaseTables,
    supabaseFrom: vi.fn((table: string) => {
      supabaseTables.push(table);
      const response = () => ({
        data: supabaseResults.get(table) ?? [],
        error: null,
      });
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        gte: vi.fn(() => query),
        single: vi.fn(async () => response()),
        then: (
          onFulfilled: (value: { data: unknown; error: null }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(response()).then(onFulfilled, onRejected),
      };
      return query;
    }),
    select: vi.fn((fields?: Record<string, unknown>) => {
      selectedFieldSets.push(Object.keys(fields ?? {}));
      return { from: (table: unknown) => makeQuery(table) };
    }),
    resolveAuthorization: vi.fn(),
    checkAppAuth: vi.fn(),
  };
});

vi.mock("@/db", () => ({
  db: { select: mocks.select },
}));

vi.mock("@/db/schema", () => {
  const table = (name: string) =>
    new Proxy(
      { __table: name },
      {
        get(target, property) {
          if (property === "__table") return target.__table;
          return `${name}.${String(property)}`;
        },
      },
    );

  return {
    arbeitszeitBuchung: table("arbeitszeit_buchung"),
    customers: table("customers"),
    priceAgreements: table("price_agreements"),
    orders: table("orders"),
    items: table("items"),
    events: table("events"),
    priceLines: table("price_lines"),
    payments: table("payments"),
    communications: table("communications"),
    qs: table("qs"),
  };
});

vi.mock("@/db/schema_buchhaltung", () => ({
  ausgangsrechnung: new Proxy(
    { __table: "ausgangsrechnung" },
    {
      get(target, property) {
        if (property === "__table") return target.__table;
        return `ausgangsrechnung.${String(property)}`;
      },
    },
  ),
}));

vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: mocks.resolveAuthorization,
}));

vi.mock("@/lib/server/authHelper", () => ({
  checkAppAuth: mocks.checkAppAuth,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mocks.supabaseFrom })),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  asc: vi.fn((value: unknown) => value),
  desc: vi.fn((value: unknown) => value),
  eq: vi.fn((left: unknown, right: unknown) => {
    mocks.eqCalls.push([left, right]);
    return [left, right];
  }),
  inArray: vi.fn((left: unknown, right: unknown) => [left, right]),
  notInArray: vi.fn((left: unknown, right: unknown) => [left, right]),
  or: vi.fn((...conditions: unknown[]) => conditions),
  sql: vi.fn(),
}));

const WORKSHOP_AUTH = {
  ok: true as const,
  data: {
    userId: "user-workshop",
    tenantId: "galvanik-kreile",
    displayName: "Philipp",
    role: "werkstatt" as const,
    permissions: ["perm_view_customers", "perm_view_leitstand"],
    active: true as const,
  },
};

const READONLY_AUTH = {
  ok: true as const,
  data: {
    userId: "user-readonly",
    tenantId: "galvanik-kreile",
    displayName: "Lesender Benutzer",
    role: "readonly" as const,
    permissions: ["perm_view_customers", "perm_view_leitstand"],
    active: true as const,
  },
};

describe("Finance data server boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.results.clear();
    mocks.queriedTables.length = 0;
    mocks.selectedFieldSets.length = 0;
    mocks.eqCalls.length = 0;
    mocks.supabaseResults.clear();
    mocks.supabaseTables.length = 0;
    mocks.resolveAuthorization.mockResolvedValue(WORKSHOP_AUTH);
    mocks.checkAppAuth.mockResolvedValue({ ok: true, data: "werkstatt" });
  });

  it("stops before database access without an authenticated scope", async () => {
    mocks.resolveAuthorization.mockResolvedValue({
      ok: false,
      reason: "NO_SESSION",
      message: "AUTH_ERROR: Nicht angemeldet",
    });

    const { getOrderWithDetails } = await import("@/lib/repositories/orderQueries");
    const result = await getOrderWithDetails("order-1");

    expect(result).toBeNull();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("does not serialize order finance fields for a workshop viewer", async () => {
    mocks.results.set("orders", [
      {
        id: "order-1",
        orderNumber: "A-2026-0001",
        customerId: "customer-1",
        title: "Stoßstange",
        task: "Verchromen",
        station: "galvanik",
        currentStationId: "galvanik",
        status: "in_progress",
        risk: "green",
        priority: "normal",
        statusText: "In Arbeit",
        dueDate: new Date("2026-08-12T10:00:00Z"),
        dbGeplant: "900.00",
        dbIst: "450.00",
        dbLetzteBerechnung: new Date("2026-08-01T10:00:00Z"),
        orders: {
          id: "order-1",
          tenantId: "galvanik-kreile",
          orderNumber: "A-2026-0001",
          customerId: "customer-1",
          title: "Stoßstange",
          station: "galvanik",
          status: "in_progress",
          dbGeplant: "900.00",
          dbIst: "450.00",
          dbLetzteBerechnung: new Date("2026-08-01T10:00:00Z"),
        },
        customers: {
          id: "customer-1",
          tenantId: "galvanik-kreile",
          name: "Kunde Eins",
          paymentProfile: { paymentBehavior: "slow" },
        },
      },
    ]);
    mocks.results.set("customers", [
      {
        id: "customer-1",
        customerNumber: "K-001",
        name: "Kunde Eins",
        email: "kunde@example.com",
      },
    ]);
    mocks.results.set("items", []);
    mocks.results.set("events", []);
    mocks.results.set("price_lines", [
      { id: "price-1", unitPriceEur: "900.00", unitTotalEur: "900.00" },
    ]);
    mocks.results.set("payments", [
      { id: "payment-1", amountEur: "900.00", providerIntentId: "secret-intent" },
    ]);
    mocks.results.set("communications", []);
    mocks.results.set("ausgangsrechnung", [{ value: 1800 }]);

    const { getOrderWithDetails } = await import("@/lib/repositories/orderQueries");
    const result = await getOrderWithDetails("order-1");
    const payload = JSON.stringify(result);

    expect(result).toMatchObject({
      id: "order-1",
      orderNumber: "A-2026-0001",
      title: "Stoßstange",
      capabilities: { canViewFinance: false },
    });
    expect(payload).not.toContain("dbGeplant");
    expect(payload).not.toContain("dbIst");
    expect(payload).not.toContain("dbLetzteBerechnung");
    expect(payload).not.toContain("priceLines");
    expect(payload).not.toContain("payments");
    expect(payload).not.toContain("customerKpis");
    expect(payload).not.toContain("paymentProfile");
    expect(payload).not.toContain("secret-intent");
    expect(mocks.queriedTables).not.toContain("price_lines");
    expect(mocks.queriedTables).not.toContain("payments");
    expect(mocks.queriedTables).not.toContain("ausgangsrechnung");
    const selectedFields = mocks.selectedFieldSets.flat();
    expect(selectedFields).not.toContain("dbGeplant");
    expect(selectedFields).not.toContain("dbIst");
    expect(selectedFields).not.toContain("dbLetzteBerechnung");
    expect(mocks.eqCalls).toEqual(
      expect.arrayContaining([
        ["orders.tenantId", "galvanik-kreile"],
        ["customers.tenantId", "galvanik-kreile"],
        ["items.tenantId", "galvanik-kreile"],
        ["events.tenantId", "galvanik-kreile"],
      ]),
    );
  });

  it("does not serialize customer finance or QA collections without permissions", async () => {
    mocks.results.set("customers", [
      {
        id: "customer-1",
        tenantId: "galvanik-kreile",
        customerNumber: "K-001",
        name: "Kunde Eins",
        type: "business",
        paymentProfile: { paymentBehavior: "slow" },
        creditRating: "C",
        createdAt: new Date("2020-01-01T00:00:00Z"),
        updatedAt: new Date("2026-08-01T00:00:00Z"),
      },
    ]);
    mocks.results.set("price_agreements", [
      { id: "agreement-1", customerId: "customer-1", rate: "99.00" },
    ]);
    mocks.results.set("orders", [
      {
        id: "order-1",
        orderNumber: "A-2026-0001",
        customerId: "customer-1",
        title: "Stoßstange",
        station: "galvanik",
        status: "in_progress",
        parts: [
          {
            name: "Stoßstange",
            quantity: 1,
            unitPriceEur: "900.00",
            internalCalculation: "must-not-leave-server",
          },
        ],
        createdAt: new Date("2026-08-01T00:00:00Z"),
      },
    ]);
    mocks.results.set("ausgangsrechnung", [
      { id: "invoice-1", brutto: "1071.00", status: "offen" },
    ]);
    mocks.results.set("qs", [
      { id: "qa-1", tenantId: "galvanik-kreile", orderId: "order-1", ergebnis: "nacharbeit" },
    ]);

    const { getCustomerDetailsAction } = await import("@/app/customers/[id]/actions");
    const result = await getCustomerDetailsAction("customer-1");
    const payload = JSON.stringify(result);

    expect(result).toMatchObject({
      ok: true,
      data: {
        customer: { id: "customer-1", name: "Kunde Eins" },
        capabilities: { canViewFinance: false, canViewQuality: false },
      },
    });
    expect(payload).not.toContain("agreements");
    expect(payload).not.toContain("rechnungen");
    expect(payload).not.toContain("paymentProfile");
    expect(payload).not.toContain("creditRating");
    expect(payload).not.toContain("dbGeplant");
    expect(payload).not.toContain("complaints");
    expect(payload).not.toContain("unitPriceEur");
    expect(payload).not.toContain("internalCalculation");
    expect(mocks.queriedTables).not.toContain("price_agreements");
    expect(mocks.queriedTables).not.toContain("ausgangsrechnung");
    expect(mocks.queriedTables).not.toContain("qs");
    expect(mocks.eqCalls).toEqual(
      expect.arrayContaining([
        ["customers.tenantId", "galvanik-kreile"],
        ["orders.tenantId", "galvanik-kreile"],
      ]),
    );
  });

  it("preserves authorized customer finance and quality collections", async () => {
    mocks.resolveAuthorization.mockResolvedValue({
      ok: true,
      data: {
        userId: "user-admin",
        tenantId: "galvanik-kreile",
        displayName: "Rolf",
        role: "admin",
        permissions: [
          "perm_view_customers",
          "perm_view_prices",
          "perm_op_qa",
        ],
        active: true,
      },
    });
    mocks.results.set("customers", [
      {
        id: "customer-1",
        customerNumber: "K-001",
        name: "Kunde Eins",
        type: "business",
        tags: [],
        createdAt: new Date("2020-01-01T00:00:00Z"),
        updatedAt: new Date("2026-08-01T00:00:00Z"),
      },
    ]);
    mocks.results.set("orders", [
      {
        id: "order-1",
        orderNumber: "A-2026-0001",
        customerId: "customer-1",
        title: "Stoßstange",
        task: "Verchromen",
        station: "galvanik",
        currentStationId: "galvanik",
        status: "in_progress",
        risk: "green",
        parts: [],
        statusText: "In Arbeit",
        createdAt: new Date("2026-08-01T00:00:00Z"),
      },
    ]);
    mocks.results.set("price_agreements", [
      {
        id: "agreement-1",
        customerId: "customer-1",
        scope: "Chrom",
        rate: "99.00",
        date: new Date("2026-01-01T00:00:00Z"),
        internalSecret: "omit-me",
      },
    ]);
    mocks.results.set("ausgangsrechnung", [
      {
        id: "invoice-1",
        number: "RE-2026-0001",
        date: "2026-08-01",
        dueDate: "2026-08-15",
        gross: "117.81",
        status: "offen",
        erechnungXml: "omit-me",
      },
    ]);
    mocks.results.set("qs", [
      {
        id: "qa-1",
        orderId: "order-1",
        result: "bestanden",
        note: "ohne Befund",
        date: new Date("2026-08-02T00:00:00Z"),
        createdAt: new Date("2026-08-02T00:00:00Z"),
      },
    ]);

    const { getCustomerDetailsAction } = await import("@/app/customers/[id]/actions");
    const result = await getCustomerDetailsAction("customer-1");
    const payload = JSON.stringify(result);

    expect(result).toMatchObject({
      ok: true,
      data: {
        capabilities: { canViewFinance: true, canViewQuality: true },
        agreements: [{ id: "agreement-1", price: 99 }],
        invoices: [{ id: "invoice-1", gross: 117.81 }],
        complaints: [{ id: "qa-1", result: "bestanden" }],
      },
    });
    expect(payload).not.toContain("internalSecret");
    expect(payload).not.toContain("erechnungXml");
    expect(mocks.queriedTables).toContain("price_agreements");
    expect(mocks.queriedTables).toContain("ausgangsrechnung");
    expect(mocks.queriedTables).toContain("qs");
  });

  it("preserves finance data for a viewer with price permission", async () => {
    mocks.resolveAuthorization.mockResolvedValue({
      ok: true,
      data: {
        userId: "user-office",
        tenantId: "galvanik-kreile",
        displayName: "Michael",
        role: "buero",
        permissions: [
          "perm_data_orders",
          "perm_view_leitstand",
          "perm_view_customers",
          "perm_view_prices",
        ],
        active: true,
      },
    });
    mocks.results.set("orders", [
      {
        id: "order-1",
        orderNumber: "A-2026-0001",
        customerId: "customer-1",
        title: "Stoßstange",
        task: "Verchromen",
        station: "galvanik",
        currentStationId: "galvanik",
        status: "in_progress",
        risk: "green",
        priority: "normal",
        statusText: "In Arbeit",
        dueDate: new Date("2026-08-12T10:00:00Z"),
        dbGeplant: "900.00",
        dbIst: "450.00",
        dbLetzteBerechnung: new Date("2026-08-01T10:00:00Z"),
      },
    ]);
    mocks.results.set("customers", [
      {
        id: "customer-1",
        customerNumber: "K-001",
        name: "Kunde Eins",
        email: "kunde@example.com",
      },
    ]);
    mocks.results.set("items", []);
    mocks.results.set("events", []);
    mocks.results.set("price_lines", [
      {
        id: "price-1",
        orderId: "order-1",
        itemId: null,
        positionText: "Verchromen",
        qty: "1",
        unitPriceEur: "900.00",
        unitTotalEur: "900.00",
        sortOrder: 1,
      },
    ]);
    mocks.results.set("payments", [
      {
        id: "payment-1",
        orderId: "order-1",
        amountEur: "900.00",
        status: "completed",
        provider: "mollie",
        providerIntentId: "must-not-leave-server",
        mollieStatus: "paid",
        mollieMethod: "card",
        receiptUrl: null,
        createdAt: new Date("2026-08-02T10:00:00Z"),
      },
    ]);
    mocks.results.set("ausgangsrechnung", [{ value: 1800 }]);

    const { getOrderWithDetails } = await import("@/lib/repositories/orderQueries");
    const result = await getOrderWithDetails("order-1");
    const payload = JSON.stringify(result);

    expect(result).toMatchObject({
      id: "order-1",
      dbGeplant: "900.00",
      dbIst: "450.00",
      priceLines: [{ id: "price-1", unitTotalEur: "900.00" }],
      payments: [{ id: "payment-1", amountEur: "900.00" }],
      capabilities: { canViewFinance: true },
    });
    expect(payload).not.toContain("providerIntentId");
    expect(payload).not.toContain("must-not-leave-server");
    expect(mocks.queriedTables).toContain("price_lines");
    expect(mocks.queriedTables).toContain("payments");
    expect(mocks.queriedTables).toContain("ausgangsrechnung");
  });

  it("keeps dossier payments outside a non-finance server response", async () => {
    mocks.resolveAuthorization.mockResolvedValue(READONLY_AUTH);
    mocks.results.set("customers", [
      {
        id: "customer-1",
        name: "Kunde Eins",
        phone: null,
        email: "kunde@example.com",
        address: null,
        street: "Werkstraße 1",
        city: "Frankfurt",
        prefComm: "E-Mail",
        type: "business",
        risk: "Niedrig",
        notes: null,
        tags: [],
        createdAt: new Date("2020-01-01T00:00:00Z"),
      },
    ]);
    mocks.results.set("orders", []);
    mocks.results.set("communications", []);
    mocks.results.set("payments", [
      { id: "payment-1", amountEur: "900.00", status: "pending" },
    ]);

    const { getClientDossierAction } = await import(
      "@/components/kommunikation/kommandozentrale/clientDossier.actions"
    );
    const result = await getClientDossierAction("customer-1");

    expect(result).toMatchObject({
      ok: true,
      data: {
        customer: { id: "customer-1", name: "Kunde Eins" },
        capabilities: { canViewFinance: false },
      },
    });
    expect(JSON.stringify(result)).not.toContain("payments");
    expect(mocks.queriedTables).not.toContain("payments");
    expect(mocks.eqCalls).toEqual(
      expect.arrayContaining([
        ["customers.tenantId", "galvanik-kreile"],
        ["orders.tenantId", "galvanik-kreile"],
        ["communications.tenantId", "galvanik-kreile"],
      ]),
    );
  });

  it("denies the station-cost child actions to a non-finance viewer", async () => {
    const {
      bookStationCosts,
      getBenchmarkData,
      getStationCostSummary,
    } = await import("@/features/orders/orderCost.actions");

    const benchmark = await getBenchmarkData("galvanik");
    const summary = await getStationCostSummary("order-1");
    const booking = await bookStationCosts({
      orderId: "order-1",
      station: "galvanik",
      workEntries: [],
      consumableEntries: [],
      extraCostEvents: [],
      employeeId: "attacker-controlled-user",
      kostenstelleKuerzel: "galvanik",
    });

    expect(benchmark).toEqual({
      zeitVorlagen: [],
      verbrauchVorlagen: [],
      kostensatzEurProStunde: null,
    });
    expect(summary).toEqual({
      stations: {},
      totals: {
        zeitMin: 0,
        zeitEur: 0,
        matEur: 0,
        extraEur: 0,
        gesamtEur: 0,
      },
    });
    expect(booking).toMatchObject({ success: false });
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("preserves sanitized benchmark data for an authorized office viewer", async () => {
    mocks.resolveAuthorization.mockResolvedValue({
      ok: true,
      data: {
        userId: "user-office",
        tenantId: "galvanik-kreile",
        displayName: "Michael",
        role: "buero",
        permissions: [
          "perm_data_orders",
          "perm_view_leitstand",
          "perm_view_prices",
        ],
        active: true,
      },
    });
    mocks.supabaseResults.set("vorlage_zeit", [
      { id: "time-1", taetigkeit: "Polieren", dauer_median_minuten: 30 },
    ]);
    mocks.supabaseResults.set("vorlage_verbrauch", [
      { id: "material-1", artikel_name: "Nickel", einzelpreis_eur: 4.5 },
    ]);
    mocks.supabaseResults.set("kostenstelle", {
      kuerzel: "galvanik",
      kostensatz_plan_eur_pro_stunde: 70,
    });

    const { getBenchmarkData } = await import(
      "@/features/orders/orderCost.actions"
    );
    const benchmark = await getBenchmarkData("galvanik");

    expect(benchmark).toMatchObject({
      zeitVorlagen: [{ id: "time-1" }],
      verbrauchVorlagen: [{ id: "material-1", einzelpreis_eur: 4.5 }],
      kostensatzEurProStunde: 70,
    });
    expect(mocks.supabaseTables).toEqual([
      "vorlage_zeit",
      "vorlage_verbrauch",
      "kostenstelle",
    ]);
  });
});

describe("Finance data browser boundary", () => {
  it("contains no browser subscriptions to finance-bearing relations or browser select-star dossier reads", () => {
    const files = [
      "src/lib/useOrderLive.ts",
      "src/components/layout/RealtimeSyncManager.tsx",
      "src/components/kommunikation/kommandozentrale/hooks/useClientDossier.ts",
      "src/components/kommunikation/kommandozentrale/Kommandozentrale.tsx",
      "src/components/orders/StationContextBlock.tsx",
      "src/components/orders/variants/WareneingangReadOnly.tsx",
    ];
    const source = files
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/table:\s*["'](?:orders|payments|price_lines)["']/);
    expect(source).not.toMatch(/\.select\(\s*["']\*["']\s*\)/);
    expect(source).toMatch(/variant === ['"]erfassung['"] && canViewFinance/);
    expect(source).toMatch(/tile\.key !== "zahlung" \|\| dossier\.capabilities\.canViewFinance/);
    expect(source).not.toContain("23 €");
  });
});
