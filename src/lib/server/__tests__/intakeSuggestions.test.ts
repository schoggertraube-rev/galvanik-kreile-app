import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: vi.fn() }));

import { plusWorkingDays, workingDaysBetween } from "@/lib/domain/workingDays";
import { calculateTermSuggestion, choosePriceSuggestion, readIntakeSuggestions } from "@/lib/server/intakeSuggestions";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const position = {
  key: "position-1",
  catalogServiceId: null,
  name: "Flansch groß",
  quantity: 2,
  surfaceRequested: "Verzinken",
  unit: "Stück",
  unitPriceCents: null,
};

const history = (overrides: Partial<{
  customerId: string;
  customerName: string;
  name: string;
  catalogServiceId: string | null;
  surface: string;
  unit: string | null;
  quantity: number;
  unitPriceCents: number;
  invoiceDate: string;
}> = {}) => ({
  customerId: "11111111-1111-4111-8111-111111111111",
  customerName: "TEST Kunde GmbH",
  name: "Flansch groß",
  catalogServiceId: null,
  surface: "Verzinken",
  unit: "Stück",
  quantity: 2,
  unitPriceCents: 1_200,
  invoiceDate: "2026-10-01",
  ...overrides,
});

describe("intake suggestions", () => {
  it('uses only the catalogue or matching customer prices for a documented proposal', () => {
    const codedPosition={...position,catalogServiceId:catalogId};
    const comparison=Array.from({length:3},()=>history({catalogServiceId:catalogId,unitPriceCents:900}));
    expect(choosePriceSuggestion(codedPosition,null,comparison,catalog)?.source).toBe('aehnlich');
    expect(choosePriceSuggestion(codedPosition,null,comparison,catalog,true)).toMatchObject({source:'katalog',unitPriceCents:1200});
    expect(choosePriceSuggestion(codedPosition,null,comparison,null,true)).toBeNull();
    expect(choosePriceSuggestion(codedPosition,comparison[0].customerId,comparison,catalog,true)).toMatchObject({source:'gleich',unitPriceCents:900});
  });

  it("uses the shared German working-day calendar", () => {
    expect(plusWorkingDays("2026-12-23", 1)).toBe("2026-12-24");
    expect(plusWorkingDays("2026-12-24", 1)).toBe("2026-12-28");
    expect(workingDaysBetween("2026-12-24", "2026-12-28")).toBe(1);
  });

  it("calculates an achievable date and rates the customer wish", () => {
    const eingabe = {
      today: "2026-10-26",
      wishDate: "2026-10-30",
      handoverMode: "pickup",
      positions: [{ ...position, catalogServiceId: "TEST-Leistung", unitPriceCents: 80_000 }],
      catalogById: new Map(),
      dailyOutputEur: 800,
      settings:{handoverBufferDays:0,fitsPercent:80,tightPercent:100,priorityPercent:110,betriebsruhe:new Set(),knappAbArbeitstagen:2},openOrders:[],priority:false,processingWeeks:1,
    } satisfies Parameters<typeof calculateTermSuggestion>[0];
    expect(calculateTermSuggestion(eingabe)).toBeNull();
    const result = calculateTermSuggestion({ ...eingabe, catalogById: new Map([["TEST-Leistung", {
      id: "TEST-Leistung", name: "TEST Verzinken", surface: "verzinken", unit: "Stück",
      net_price_cents: 80_000, standard_lead_time_working_days: 3,
    }]]) });

    expect(result).toMatchObject({
      achievableDate: "2026-11-03",
      wishDate: "2026-10-30",
      rating: "nicht_machbar",
      bufferWorkingDays: -2,
    });
  });

  it("uses the configured close-to-deadline threshold for a shipping proposal", () => {
    const input = {
      today: "2026-10-26",
      wishDate: "2026-11-03",
      handoverMode: "shipping",
      positions: [{ ...position, catalogServiceId: "TEST-Leistung", unitPriceCents: 500 }],
      catalogById: new Map([["TEST-Leistung", {
        id: "TEST-Leistung", name: "TEST Verzinken", surface: "verzinken", unit: "Stück",
        net_price_cents: 500, standard_lead_time_working_days: 0,
      }]]),
      dailyOutputEur: 800,
      settings: {
        handoverBufferDays: 2, fitsPercent: 80, tightPercent: 100, priorityPercent: 110,
        betriebsruhe: new Set<string>(), knappAbArbeitstagen: 1,
      },
      openOrders: [],
      priority: false,
      processingWeeks: 1,
    } satisfies Parameters<typeof calculateTermSuggestion>[0];

    expect(calculateTermSuggestion(input)).toMatchObject({
      achievableDate: "2026-11-02", bufferWorkingDays: 1, rating: "knapp",
    });
    expect(calculateTermSuggestion({ ...input, settings: { ...input.settings, knappAbArbeitstagen: 0 } }))
      .toMatchObject({ bufferWorkingDays: 1, rating: "passt" });
    expect(calculateTermSuggestion({ ...input, settings: { ...input.settings, knappAbArbeitstagen: null } }))
      .toMatchObject({ rating: null, unavailableReason: expect.stringMatching(/Terminschwelle/) });
  });

  it("meldet die fehlende Durchlaufzeit einer Freitextposition und erhält ihren Preisvorschlag", async () => {
    const beispielfall = history();
    const execute = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        customer_id: beispielfall.customerId,
        customer_name: beispielfall.customerName,
        item_name: beispielfall.name,
        catalog_service_id: null,
        surface_requested: beispielfall.surface,
        unit: beispielfall.unit,
        quantity: beispielfall.quantity,
        unit_price_cents: beispielfall.unitPriceCents,
        invoice_date: beispielfall.invoiceDate,
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ vorrang: false }]);
    vi.mocked(withPrivilegedTenantTransaction).mockImplementationOnce((_, read) =>
      read({ execute } as unknown as PrivilegedTenantTransaction),
    );

    const result = await readIntakeSuggestions({
      userId: "TEST Preise", tenantId: "TEST Einkauf", displayName: "TEST Preise",
      role: "admin", active: true, areas: ["preise"], permissions: [],
    }, {
      customerId: beispielfall.customerId,
      kind: "ORDER",
      wishDate: "2026-12-18",
      handoverMode: "pickup",
      positions: [position],
    }, async () => ({
      betriebsruhe: [], versandpufferArbeitstage: 2, knappAbArbeitstagen: 2,
      terminKapazitaet: null,
    }));

    expect(result).toMatchObject({
      term: null,
      missingLeadTimes: [{ positionKey: position.key, catalogServiceId: null, message: "Durchlaufzeit für Flansch groß fehlt" }],
      prices: [{ positionKey: position.key, source: "gleich", unitPriceCents: 1_200, lineTotalCents: 2_400 }],
    });
  });

  it.each([undefined, null] as const)("erhält die Terminberechnung für Übergabe %s", async handoverMode => {
    const catalogServiceId = "11111111-1111-4111-8111-111111111112";
    const execute = vi.fn().mockResolvedValueOnce([{
      id: catalogServiceId, name: position.name, surface: "verzinken", unit: "Stück",
      net_price_cents: 500, standard_lead_time_working_days: 1,
    }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    vi.mocked(withPrivilegedTenantTransaction).mockImplementationOnce((_, read) =>
      read({ execute } as unknown as PrivilegedTenantTransaction),
    );

    const result = await readIntakeSuggestions({
      userId: "TEST Preise", tenantId: "TEST Einkauf", displayName: "TEST Preise",
      role: "admin", active: true, areas: ["preise"], permissions: [],
    }, {
      customerId: null, kind: "ORDER", wishDate: null,
      ...(handoverMode === undefined ? {} : { handoverMode }),
      positions: [{ ...position, catalogServiceId, unitPriceCents: 500 }],
    }, async () => ({
      betriebsruhe: [], versandpufferArbeitstage: 2, knappAbArbeitstagen: 2,
      terminKapazitaet: { tagesleistungEur: 800, passtProzent: 80, knappProzent: 100, vorrangProzent: 110 },
    }));

    if (handoverMode === null) expect(result.term).toBeNull();
    else expect(result.term).toMatchObject({ achievableDate: expect.any(String) });
  });

  it("prefers the newest exact customer case", () => {
    const suggestion = choosePriceSuggestion(position, "11111111-1111-4111-8111-111111111111", [
      history({ unitPriceCents: 1_500, invoiceDate: "2026-10-20" }),
      history({ unitPriceCents: 1_200, invoiceDate: "2026-09-20" }),
    ], null);

    expect(suggestion).toMatchObject({ source: "gleich", unitPriceCents: 1_500, lineTotalCents: 3_000 });
  });

  it("uses the median of at least three similar cases", () => {
    const suggestion = choosePriceSuggestion(
      { ...position, name: "Flansch Sondermaß" },
      null,
      [history({ unitPriceCents: 900 }), history({ unitPriceCents: 1_400 }), history({ unitPriceCents: 1_100 })],
      null,
    );

    expect(suggestion).toMatchObject({ source: "aehnlich", unitPriceCents: 1_100, caseCount: 3 });
  });

  it("preserves three-decimal quantities and rounds the net line to the same cent as SQL", () => {
    const suggestion = choosePriceSuggestion({ ...position, quantity: 1.005, unit: "kg" }, null, [], {
      id: "11111111-1111-4111-8111-111111111112", name: position.name, surface: "verzinken", unit: "kg",
      net_price_cents: 100, standard_lead_time_working_days: 3,
    });
    expect(suggestion).toMatchObject({ unit: "kg", unitPriceCents: 100, lineTotalCents: 101 });
  });

  it("keeps a missing historic unit missing and does not invent Stück", () => {
    const suggestion = choosePriceSuggestion({ ...position, unit: null }, "11111111-1111-4111-8111-111111111111", [history({ unit: null })], null);
    expect(suggestion).toMatchObject({ source: "gleich", unit: null, lineTotalCents: 2400 });
  });
});
