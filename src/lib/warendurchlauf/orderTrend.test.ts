import { describe, expect, it } from "vitest";
import { getLast7DaysOrderTrend } from "./orderTrend";

const NOW = new Date("2026-07-16T12:00:00.000Z");

describe("getLast7DaysOrderTrend", () => {
  it("keeps a real zero series instead of inventing demo activity", () => {
    expect(getLast7DaysOrderTrend([], NOW)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(getLast7DaysOrderTrend([{ intakeDate: "invalid" }], NOW))
      .toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("counts only valid past orders inside the seven-day window", () => {
    const trend = getLast7DaysOrderTrend([
      { intakeDate: "2026-07-16T10:00:00.000Z" },
      { rawIntakeDate: "2026-07-10T12:00:00.000Z" },
      { intakeDate: "2026-07-09T12:00:00.000Z" },
      { intakeDate: "2026-07-17T12:00:00.000Z" },
    ], NOW);

    expect(trend).toEqual([1, 0, 0, 0, 0, 0, 1]);
  });
});
