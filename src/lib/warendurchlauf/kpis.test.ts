import { describe, expect, it } from "vitest";
import { calculateWarendurchlaufMetrics } from "@/lib/warendurchlauf/kpis";

describe("calculateWarendurchlaufMetrics", () => {
  it("uses only confirmed completion, due, and intake timestamps", () => {
    const metrics = calculateWarendurchlaufMetrics([
      {
        status: "completed",
        intakeDate: "2026-07-01T00:00:00.000Z",
        promisedDueDate: "2026-07-04T00:00:00.000Z",
        completedDate: "2026-07-03T00:00:00.000Z",
      },
      {
        status: "shipped",
        intakeDate: "2026-07-01T00:00:00.000Z",
        promisedDueDate: "2026-07-04T00:00:00.000Z",
        completedDate: "2026-07-07T00:00:00.000Z",
      },
    ]);

    expect(metrics.termintreue).toBe(50);
    expect(metrics.abgeschlosseneAuftraege).toBe(2);
    expect(metrics.termintreueMessbar).toBe(2);
    expect(metrics.durchlaufzeitTage).toBe(4);
    expect(metrics.durchlaufzeitMessbar).toBe(2);
    expect(metrics.durchlaufzeitOhneMessdaten).toBe(0);
  });

  it("reports missing completion evidence as unavailable instead of zero", () => {
    const metrics = calculateWarendurchlaufMetrics([
      { status: "completed", dueDate: "2026-07-04T00:00:00.000Z" },
    ]);

    expect(metrics.termintreue).toBeNull();
    expect(metrics.termintreueMessbar).toBe(0);
    expect(metrics.termintreueOhneMessdaten).toBe(1);
    expect(metrics.durchlaufzeitTage).toBeNull();
    expect(metrics.durchlaufzeitMessbar).toBe(0);
    expect(metrics.durchlaufzeitOhneMessdaten).toBe(1);
  });

  it("does not reinterpret an internal due date as a customer promise", () => {
    const metrics = calculateWarendurchlaufMetrics([{
      status: "shipped",
      dueDate: "2026-07-04T00:00:00.000Z",
      intakeDate: "2026-07-01T00:00:00.000Z",
      completedDate: "2026-07-03T00:00:00.000Z",
    }]);
    expect(metrics.termintreue).toBeNull();
    expect(metrics.termintreueMessbar).toBe(0);
    expect(metrics.durchlaufzeitMessbar).toBe(1);
  });

  it("excludes terminal and unknown statuses from the open backlog", () => {
    const metrics = calculateWarendurchlaufMetrics([
      { status: "ready", currentStationId: "galvanik" },
      { status: "blocked", currentStationId: "galvanik" },
      { status: "in_progress", currentStationId: "wareneingang" },
      { status: "cancelled", currentStationId: "wareneingang" },
      { status: "legacy-mystery", currentStationId: "galvanik" },
    ]);

    expect(metrics.offeneAuftraege).toBe(3);
    expect(metrics.unbekannteStatuswerte).toBe(1);
    expect(metrics.engpassStation).toBe("galvanik");
    expect(metrics.engpassCount).toBe(2);
  });

  it("does not invent a station for an open order with missing station data", () => {
    const metrics = calculateWarendurchlaufMetrics([
      { status: "ready" },
      { status: "in_progress", currentStationId: "galvanik" },
    ]);

    expect(metrics.offeneAuftraege).toBe(2);
    expect(metrics.offeneOhneStation).toBe(1);
    expect(metrics.engpassStation).toBe("galvanik");
    expect(metrics.engpassCount).toBe(1);
  });
});
