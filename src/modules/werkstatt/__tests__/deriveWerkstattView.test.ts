import { describe, expect, it } from "vitest";
import { buildWerkstattData } from "../server/deriveWerkstattView";
import type { WerkstattKpiSnapshot, WerkstattSurfaceOrder } from "../server/types";

function order(overrides: Partial<WerkstattSurfaceOrder> & { id: string; orderNumber: string }): WerkstattSurfaceOrder {
  return {
    id: overrides.id,
    orderNumber: overrides.orderNumber,
    customerName: overrides.customerName ?? `Kunde ${overrides.id}`,
    title: overrides.title ?? "Titel",
    itemDescription: null,
    surfaceRequested: overrides.surfaceRequested ?? null,
    station: overrides.station ?? "wareneingang",
    status: overrides.status ?? "angenommen",
    statusText: overrides.statusText ?? "Angenommen",
    risk: overrides.risk ?? "green",
    dueDate: overrides.dueDate ?? "2026-09-10",
    dueLabel: overrides.dueLabel ?? "Faellig in",
    dueValue: overrides.dueValue ?? "3 Tagen",
  };
}

const KPIS: WerkstattKpiSnapshot = { wipCount: 7, dueThisWeekCount: 4 };

function build(input: {
  wareneingang: readonly WerkstattSurfaceOrder[];
  galvanik: readonly WerkstattSurfaceOrder[];
}) {
  return buildWerkstattData({
    ...input,
    canCreateOrder: true,
    greetingName: null,
    kpis: KPIS,
  });
}

describe("buildWerkstattData", () => {
  it("classifies red/orange/blocked as dringend, yellow as weitere, and excludes green", () => {
    const red = order({ id: "r", orderNumber: "R-1", risk: "red" });
    const orange = order({ id: "o", orderNumber: "O-1", risk: "orange" });
    const blocked = order({ id: "b", orderNumber: "B-1", risk: "blocked" });
    const yellow = order({ id: "y", orderNumber: "Y-1", risk: "yellow" });
    const green = order({ id: "g", orderNumber: "G-1", risk: "green" });

    const data = build({ wareneingang: [green], galvanik: [red, orange, blocked, yellow] });

    expect(data.dringendCount).toBe(3);
    expect(data.weitereCount).toBe(1);
    expect(data.held.map((entry) => entry.id)).toEqual(["r", "o", "b", "y"]);
  });

  it("sorts crit before soon and by due date ascending within a group", () => {
    const late = order({ id: "late", orderNumber: "L", risk: "red", dueDate: "2026-09-12" });
    const early = order({ id: "early", orderNumber: "E", risk: "orange", dueDate: "2026-09-08" });
    const soon = order({ id: "soon", orderNumber: "S", risk: "yellow", dueDate: "2026-09-07" });

    expect(build({ wareneingang: [late], galvanik: [early, soon] }).held.map((entry) => entry.id))
      .toEqual(["early", "late", "soon"]);
  });

  it("suggests a bundle only from displayed held orders with the same surface", () => {
    const first = order({ id: "a", orderNumber: "A", surfaceRequested: "Verzinken", risk: "orange" });
    const second = order({ id: "b", orderNumber: "B", surfaceRequested: "Verzinken", risk: "yellow" });
    const green = order({ id: "c", orderNumber: "C", surfaceRequested: "Verzinken" });

    const data = build({ wareneingang: [first, green], galvanik: [second] });
    expect(data.bundleSuggestion?.surfaceRequested).toBe("Verzinken");
    expect(data.bundleSuggestion?.orders.map((entry) => entry.id).sort()).toEqual(["a", "b"]);
  });

  it("does not suggest a bundle when only green orders share a surface", () => {
    const first = order({ id: "a", orderNumber: "A", surfaceRequested: "Verzinken" });
    const second = order({ id: "b", orderNumber: "B", surfaceRequested: "Verzinken" });
    const data = build({ wareneingang: [first], galvanik: [second] });
    expect(data.held).toEqual([]);
    expect(data.bundleSuggestion).toBeNull();
  });

  it("passes the SQL KPI snapshot through unchanged instead of deriving list counts", () => {
    const data = build({
      wareneingang: [order({ id: "w", orderNumber: "W" })],
      galvanik: [order({ id: "g", orderNumber: "G" })],
    });
    expect({ wipCount: data.wipCount, dueThisWeekCount: data.dueThisWeekCount }).toEqual(KPIS);
  });

  it("orders pickerOrders galvanik-first", () => {
    const wareneingang = order({ id: "we", orderNumber: "WE" });
    const galvanik = order({ id: "ga", orderNumber: "GA" });
    expect(build({ wareneingang: [wareneingang], galvanik: [galvanik] }).pickerOrders.map((entry) => entry.id))
      .toEqual(["ga", "we"]);
  });

  it("offers only canonical fertig orders as goods-out candidates", () => {
    const wareneingang = order({ id: "we", orderNumber: "WE", station: "wareneingang" });
    const galvanik = order({ id: "ga", orderNumber: "GA", station: "galvanik" });
    const fertig = order({ id: "fi", orderNumber: "FI", station: "fertig", status: "fertig" });

    const data = build({ wareneingang: [wareneingang], galvanik: [galvanik, fertig] });

    expect(data.goodsOutCandidates.map((entry) => entry.id)).toEqual(["fi"]);
    expect(data.pickerOrders.map((entry) => entry.id)).toEqual(["ga", "fi", "we"]);
  });

  it("keeps the goods-out candidates honestly empty when no order is at fertig", () => {
    const data = build({
      wareneingang: [order({ id: "we", orderNumber: "WE", station: "wareneingang" })],
      galvanik: [order({ id: "ga", orderNumber: "GA", station: "galvanik" })],
    });

    expect(data.goodsOutCandidates).toEqual([]);
  });
});
