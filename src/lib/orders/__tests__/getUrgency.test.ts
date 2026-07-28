import { describe, expect, it } from "vitest";

import { getUrgency } from "@/lib/orders/getUrgency";

describe("getUrgency", () => {
  const now = new Date("2026-07-28T12:00:00.000Z");

  it("keeps a missing or invalid promised date unknown", () => {
    expect(getUrgency(undefined, now)).toBe("unbekannt");
    expect(getUrgency("not-a-date", now)).toBe("unbekannt");
  });

  it("only labels a plan state when a valid promised date exists", () => {
    expect(getUrgency("2026-07-30T12:00:00.000Z", now)).toBe("im_plan");
    expect(getUrgency("2026-07-27T12:00:00.000Z", now)).toBe("kritisch");
  });
});
