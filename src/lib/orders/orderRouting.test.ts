import { describe, expect, it } from "vitest";
import {
  getBulkRoutingConflict,
  getHomogeneousRouteTransition,
  getHomogeneousTerminalRoute,
  isOrderReadyForStation,
} from "@/lib/orders/orderRouting";
import { createRouteSnapshot } from "@/lib/orders/routeSnapshot";

describe("isOrderReadyForStation", () => {
  it("admits only confirmed ready orders at the exact target station", () => {
    expect(isOrderReadyForStation({ currentStationId: "galvanik", status: "ready" }, "galvanik")).toBe(true);
    expect(isOrderReadyForStation({ currentStationId: "galvanik", status: "in_progress" }, "galvanik")).toBe(false);
    expect(isOrderReadyForStation({ currentStationId: "wareneingang", status: "blocked" }, "galvanik")).toBe(false);
    expect(isOrderReadyForStation({ currentStationId: "wareneingang", status: "completed" }, "galvanik")).toBe(false);
    expect(isOrderReadyForStation({ currentStationId: "wareneingang", status: "shipped" }, "galvanik")).toBe(false);
    expect(isOrderReadyForStation({ currentStationId: "wareneingang", status: "legacy-mystery" }, "galvanik")).toBe(false);
    expect(isOrderReadyForStation({ currentStationId: "schleiferei", status: "ready" }, "galvanik")).toBe(false);
  });

  it("fails closed for divergent or position-routed bulk completions", () => {
    expect(getBulkRoutingConflict([], "galvanik")).toBe("ORDER_WITHOUT_ITEMS");
    expect(getBulkRoutingConflict([{ currentStationId: "schleiferei", stationSequence: [], currentStep: 0 }], "galvanik"))
      .toBe("ITEM_STATION_DIVERGENCE");
    expect(getBulkRoutingConflict([{ currentStationId: "galvanik", stationSequence: ["galvanik", "warenausgang"], currentStep: 0 }], "galvanik"))
      .toBe("POSITION_ROUTE_REQUIRES_UNIT_ENGINE");
    expect(getBulkRoutingConflict([{ currentStationId: "galvanik", stationSequence: [], currentStep: 0 }], "galvanik"))
      .toBe("POSITION_ROUTE_REQUIRES_UNIT_ENGINE");
  });

  it("advances only matching explicit v1 snapshots at the same step", () => {
    const snapshot = createRouteSnapshot("direct_galvanik");
    const items = [
      { currentStationId: "galvanik", stationSequence: snapshot, currentStep: 1 },
      { currentStationId: "galvanik", stationSequence: snapshot, currentStep: 1 },
    ];
    expect(getBulkRoutingConflict(items, "galvanik")).toBeNull();
    expect(getHomogeneousRouteTransition(items, "galvanik")).toEqual({
      ok: true,
      data: {
        snapshot,
        completedStep: 1,
        nextStep: 2,
        nextStation: "qualitaetssicherung",
      },
    });
  });

  it("keeps mixed templates and legacy arrays quarantined", () => {
    expect(getBulkRoutingConflict([
      { currentStationId: "galvanik", stationSequence: createRouteSnapshot("direct_galvanik"), currentStep: 1 },
      { currentStationId: "galvanik", stationSequence: createRouteSnapshot("grinding_galvanik"), currentStep: 2 },
    ], "galvanik")).toBe("POSITION_ROUTE_REQUIRES_UNIT_ENGINE");
  });

  it("accepts a homogeneous route only at its explicit terminal station", () => {
    const snapshot = createRouteSnapshot("grinding_galvanik");
    expect(getHomogeneousTerminalRoute([
      { currentStationId: "warenausgang", stationSequence: snapshot, currentStep: 4 },
      { currentStationId: "warenausgang", stationSequence: snapshot, currentStep: 4 },
    ], "warenausgang")).toEqual({ ok: true, data: { snapshot, completedStep: 4 } });
    expect(getHomogeneousTerminalRoute([
      { currentStationId: "qualitaetssicherung", stationSequence: snapshot, currentStep: 3 },
    ], "qualitaetssicherung")).toEqual({
      ok: false,
      conflict: "POSITION_ROUTE_REQUIRES_UNIT_ENGINE",
    });
  });
});
