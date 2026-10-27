import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: vi.fn() }));

import { mapOrderCardIntakeItems } from "../orderCardRead";

const base = {
  id: "6c1d0919-0722-4682-b34d-2e80e4da57ee",
  position: 1,
  name: "Stoßstange",
  quantity: 1,
  material: "Stahl",
  surfaceRequested: "Chrom",
};

describe("order card intake snapshot contract", () => {
  it("reads the persisted legacy item shape", () => {
    expect(mapOrderCardIntakeItems([base])).toEqual([{ ...base, catalogServiceId: null, unit: null, unitPriceCents: null, vatRateBasisPoints: null, finished: false, extraWork: [] }]);
  });

  it("reads the current catalog and pricing item shape without creating a second card model", () => {
    expect(mapOrderCardIntakeItems([{
      ...base,
      catalogServiceId: "77777777-7777-4777-8777-777777777777",
      unit: "Stück",
      unitPriceCents: 1250,
      vatRateBasisPoints: 1900,
    }])).toEqual([{ ...base, catalogServiceId: "77777777-7777-4777-8777-777777777777", unit: "Stück", unitPriceCents: 1250, vatRateBasisPoints: 1900, finished: false, extraWork: [] }]);
  });

  it("rejects unversioned mixed shapes", () => {
    expect(() => mapOrderCardIntakeItems([{ ...base, unit: "Stück" }])).toThrow("ORDER_CARD_INTAKE_ITEM_SHAPE_INVALID");
  });
});
