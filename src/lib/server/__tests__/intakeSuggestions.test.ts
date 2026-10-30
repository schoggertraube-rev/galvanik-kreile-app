import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: vi.fn() }));

import { plusWorkingDays, workingDaysBetween } from "@/lib/domain/workingDays";
import { calculateTermSuggestion, choosePriceSuggestion } from "@/lib/server/intakeSuggestions";

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
  unit: string;
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
  it("uses the shared German working-day calendar", () => {
    expect(plusWorkingDays("2026-12-23", 1)).toBe("2026-12-24");
    expect(plusWorkingDays("2026-12-24", 1)).toBe("2026-12-28");
    expect(workingDaysBetween("2026-12-24", "2026-12-28")).toBe(1);
  });

  it("calculates an achievable date and rates the customer wish", () => {
    const result = calculateTermSuggestion({
      today: "2026-10-26",
      wishDate: "2026-10-30",
      positions: [{ ...position, unitPriceCents: 80_000 }],
      catalogById: new Map(),
      dailyOutputEur: 800,
    });

    expect(result).toMatchObject({
      achievableDate: "2026-11-03",
      wishDate: "2026-10-30",
      rating: "nicht_machbar",
      bufferWorkingDays: -2,
    });
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
});
