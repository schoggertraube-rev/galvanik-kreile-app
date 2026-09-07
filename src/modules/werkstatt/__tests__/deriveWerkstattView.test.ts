import { describe, expect, it } from "vitest";
import { buildWerkstattData } from "../server/deriveWerkstattView";
import type { WerkstattSurfaceOrder } from "../server/types";

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
    dueLabel: overrides.dueLabel ?? "Fällig in",
    dueValue: overrides.dueValue ?? "3 Tagen",
  };
}

const NOW = new Date("2026-09-07T08:00:00.000Z");

describe("buildWerkstattData", () => {
  it("classifies red/orange as dringend and yellow as weitere, excludes green from Heute sichern", () => {
    const red = order({ id: "r", orderNumber: "R-1", risk: "red" });
    const orange = order({ id: "o", orderNumber: "O-1", risk: "orange" });
    const yellow = order({ id: "y", orderNumber: "Y-1", risk: "yellow" });
    const green = order({ id: "g", orderNumber: "G-1", risk: "green" });

    const data = buildWerkstattData(
      { wareneingang: [green], galvanik: [red, orange, yellow], canCreateOrder: true, greetingName: null },
      NOW,
    );

    expect(data.dringendCount).toBe(2);
    expect(data.weitereCount).toBe(1);
    expect(data.held.map((h) => h.id)).toEqual(["r", "o", "y"]);
    expect(data.held.some((h) => h.id === "g")).toBe(false);
  });

  it("classifies blocked as dringend in Heute sichern, same as red/orange", () => {
    const blocked = order({ id: "b", orderNumber: "B-1", risk: "blocked" });
    const green = order({ id: "g", orderNumber: "G-1", risk: "green" });

    const data = buildWerkstattData(
      { wareneingang: [green], galvanik: [blocked], canCreateOrder: true, greetingName: null },
      NOW,
    );

    expect(data.dringendCount).toBe(1);
    expect(data.held.map((h) => h.id)).toEqual(["b"]);
    expect(data.held.find((h) => h.id === "b")?.heldGroup).toBe("crit");
  });

  it("sorts crit before soon and by due date ascending within a group", () => {
    const critLate = order({ id: "a", orderNumber: "A", risk: "red", dueDate: "2026-09-12" });
    const critEarly = order({ id: "b", orderNumber: "B", risk: "orange", dueDate: "2026-09-08" });
    const soon = order({ id: "c", orderNumber: "C", risk: "yellow", dueDate: "2026-09-07" });

    const data = buildWerkstattData(
      { wareneingang: [critLate], galvanik: [critEarly, soon], canCreateOrder: true, greetingName: null },
      NOW,
    );

    expect(data.held.map((h) => h.id)).toEqual(["b", "a", "c"]);
  });

  it("suggests a bundle only from the same held orders that its filter displays", () => {
    const a = order({ id: "a", orderNumber: "A", surfaceRequested: "Verzinken", risk: "orange" });
    const b = order({ id: "b", orderNumber: "B", surfaceRequested: "Verzinken", risk: "yellow" });
    const c = order({ id: "c", orderNumber: "C", surfaceRequested: "Passivieren" });

    const withBundle = buildWerkstattData(
      { wareneingang: [a, b], galvanik: [c], canCreateOrder: true, greetingName: null },
      NOW,
    );
    expect(withBundle.bundleSuggestion?.surfaceRequested).toBe("Verzinken");
    expect(withBundle.bundleSuggestion?.orders.map((o) => o.id).sort()).toEqual(["a", "b"]);

    const withoutBundle = buildWerkstattData(
      { wareneingang: [a], galvanik: [c], canCreateOrder: true, greetingName: null },
      NOW,
    );
    expect(withoutBundle.bundleSuggestion).toBeNull();
  });

  it("does not suggest an empty bundle when only green orders share a surface", () => {
    const first = order({ id: "green-a", orderNumber: "G-A", surfaceRequested: "Verzinken" });
    const second = order({ id: "green-b", orderNumber: "G-B", surfaceRequested: "Verzinken" });

    const data = buildWerkstattData(
      { wareneingang: [first], galvanik: [second], canCreateOrder: true, greetingName: null },
      NOW,
    );

    expect(data.held).toEqual([]);
    expect(data.bundleSuggestion).toBeNull();
  });

  it("derives wipCount from the real galvanik surface count only", () => {
    const data = buildWerkstattData(
      {
        wareneingang: [order({ id: "w1", orderNumber: "W1" }), order({ id: "w2", orderNumber: "W2" })],
        galvanik: [order({ id: "g1", orderNumber: "G1" })],
        canCreateOrder: true,
        greetingName: null,
      },
      NOW,
    );
    expect(data.wipCount).toBe(1);
  });

  it("counts dueThisWeek only for the Europe/Berlin calendar week up to Sunday", () => {
    const today = order({ id: "today", orderNumber: "T", dueDate: "2026-09-07" });
    const sunday = order({ id: "sunday", orderNumber: "S", dueDate: "2026-09-13" });
    const nextWeek = order({ id: "next", orderNumber: "N", dueDate: "2026-09-14" });
    const past = order({ id: "past", orderNumber: "P", dueDate: "2026-09-01" });

    const data = buildWerkstattData(
      { wareneingang: [today, sunday, nextWeek, past], galvanik: [], canCreateOrder: true, greetingName: null },
      NOW,
    );
    expect(data.dueThisWeekCount).toBe(2);
  });

  it("treats YYYY-MM-DD as a Europe/Berlin calendar date at the Sunday boundary", () => {
    const sunday = order({ id: "sunday", orderNumber: "S", dueDate: "2026-09-13" });
    const monday = order({ id: "monday", orderNumber: "M", dueDate: "2026-09-14" });

    const data = buildWerkstattData(
      { wareneingang: [sunday, monday], galvanik: [], canCreateOrder: true, greetingName: null },
      NOW,
    );
    expect(data.dueThisWeekCount).toBe(1);
  });

  it("keeps the UTC-to-Berlin Sunday/Monday boundary deterministic", () => {
    const berlinSunday = order({
      id: "berlin-sunday",
      orderNumber: "BER-SO",
      dueDate: "2026-09-13T21:59:59Z",
    });
    const berlinMonday = order({
      id: "berlin-monday",
      orderNumber: "BER-MO",
      dueDate: "2026-09-13T22:00:00Z",
    });

    const data = buildWerkstattData(
      {
        wareneingang: [berlinSunday, berlinMonday],
        galvanik: [],
        canCreateOrder: true,
        greetingName: null,
      },
      new Date("2026-09-13T21:30:00Z"),
    );

    expect(data.dueThisWeekCount).toBe(1);
  });

  it("orders pickerOrders galvanik-first, matching the existing picker contract", () => {
    const we = order({ id: "we-1", orderNumber: "WE-1" });
    const ga = order({ id: "ga-1", orderNumber: "GA-1" });
    const data = buildWerkstattData(
      { wareneingang: [we], galvanik: [ga], canCreateOrder: true, greetingName: null },
      NOW,
    );
    expect(data.pickerOrders.map((o) => o.id)).toEqual(["ga-1", "we-1"]);
  });
});
