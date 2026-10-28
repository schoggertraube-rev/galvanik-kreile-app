import { describe, expect, it } from "vitest";
import { classifyOrderForToday } from "@/lib/server/todayDashboardPolicy";

const TODAY = "2026-10-28";

function order(overrides: Partial<Parameters<typeof classifyOrderForToday>[0]> = {}) {
  return {
    dueDate: `${TODAY}T00:00:00.000Z`,
    risk: "green",
    station: "fertig",
    status: "fertig",
    ...overrides,
  };
}

describe("classifyOrderForToday", () => {
  it("shows only a finished order due today in Heute fällig", () => {
    expect(classifyOrderForToday(order(), TODAY)).toBe("today");
    expect(classifyOrderForToday(order({ station: "galvanik", status: "galvanik" }), TODAY)).toBe("action");
  });

  it("moves overdue and risky orders to Handlungsbedarf", () => {
    expect(classifyOrderForToday(order({ dueDate: "2026-10-27T00:00:00.000Z" }), TODAY)).toBe("action");
    expect(classifyOrderForToday(order({ risk: "blocked" }), TODAY)).toBe("action");
  });

  it("excludes collected, shipped, completed, and future healthy orders", () => {
    for (const terminal of ["abgeholt", "versendet", "raus", "completed", "erledigt"]) {
      expect(classifyOrderForToday(order({ station: terminal, status: terminal }), TODAY)).toBeNull();
    }
    expect(classifyOrderForToday(order({ dueDate: "2026-10-29T00:00:00.000Z" }), TODAY)).toBeNull();
  });
});
