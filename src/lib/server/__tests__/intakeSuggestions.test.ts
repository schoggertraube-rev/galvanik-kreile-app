import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: vi.fn() }));

import { plusWorkingDays, workingDaysBetween } from "@/lib/domain/workingDays";
import { calculateTermSuggestion, choosePriceSuggestion, readIntakeSuggestions } from "@/lib/server/intakeSuggestions";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const position = {
  key: "position-1",
  catalogServiceId: null,
  name: "Flansch groß",
  quantity: 2,
  surfaceRequested: "Verzinken",
  unit: "Stück",
  unitPriceCents: null,
};
const catalogId='11111111-1111-4111-8111-111111111112';
const catalog={id:catalogId,name:position.name,surface:'verzinken',unit:'Stück',net_price_cents:1200,standard_lead_time_working_days:3};

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
    const result = calculateTermSuggestion({
      today: "2026-10-26",
      wishDate: "2026-10-30",
      positions: [{ ...position, catalogServiceId:catalogId, unitPriceCents: 80_000 }],
      catalogById: new Map([[catalogId,catalog]]),
      dailyOutputEur: 800,
      settings:{handoverBufferDays:0,fitsPercent:80,tightPercent:100,priorityPercent:110},openOrders:[],priority:false,processingWeeks:1,
    });

    expect(result).toMatchObject({
      achievableDate: "2026-11-03",
      wishDate: "2026-10-30",
      rating: "nicht_machbar",
      bufferWorkingDays: -2,
    });
  });

  it('meldet beim Freitext die fehlende Durchlaufzeit und behält den belegten Preisvorschlag',async()=>{
    // Synthetische DB-Zeilen, der vorhandene Leser und beide Ableitungen laufen echt.
    const customerId='11111111-1111-4111-8111-111111111111';
    const execute=vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{
      customer_id:customerId,customer_name:'TEST Kunde GmbH',item_name:position.name,catalog_service_id:null,
      surface_requested:position.surfaceRequested,unit:position.unit,quantity:2,unit_price_cents:1200,invoice_date:'2026-10-01',
    }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{vorrang:false}]);
    vi.mocked(withPrivilegedTenantTransaction).mockImplementationOnce(async (_auth,work)=>work({execute,select:vi.fn(),update:vi.fn()}));
    const result=await readIntakeSuggestions({tenantId:'TEST-Freitext',userId:customerId,active:true,role:'buero',
      displayName:'TEST Login',areas:['preise'],permissions:['perm_view_prices']},
      {kind:'ORDER',customerId,wishDate:null,handoverMode:'pickup',positions:[position]},
      async()=>({versandpufferArbeitstage:0,terminKapazitaet:null}));
    expect(result).toEqual({term:null,missingLeadTimes:[{positionKey:position.key,catalogServiceId:null,
      message:'Durchlaufzeit für Flansch groß fehlt'}],prices:[expect.objectContaining({source:'gleich',unitPriceCents:1200,lineTotalCents:2400})]});
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
